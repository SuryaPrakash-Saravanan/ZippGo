export function classifyRisk(score) {
  if (score <= 30) return { level: 'Low', decision: 'Auto Approve', tone: 'good' };
  if (score <= 70) return { level: 'Medium', decision: 'Manual Review', tone: 'warn' };
  return { level: 'High', decision: 'Reject / Investigate', tone: 'danger' };
}

function productFamily(product = {}) {
  const category = String(product.category || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  if (/(food|beverage|bakery|snacks|dairy|egg|fruit|prepared)/.test(category)) return 'Food & Beverages';
  if (/(dress|fashion|shoe|bag|travel|trolley|saree|jacket)/.test(`${category} ${name}`)) return 'Fashion';
  if (/(electronics|camera|gadget|oven|mobile|laptop|watch|charger|tv|refrigerator|washing machine)/.test(`${category} ${name}`)) return 'Electronics';
  if (/(tool|appliance|kitchen|furniture|sport|saw|cookware|table)/.test(`${category} ${name}`)) return 'Tools';
  return 'Standard';
}

function isYes(value) {
  return value === true || value === 'Yes';
}

function isNo(value) {
  return value === false || value === 'No';
}

function hasDeliveryProof(proof) {
  return Boolean(proof?.deliveryPhoto && proof?.otpVerified && proof?.timestamp);
}

export function calculateFraudRisk({ product, order, proof, returnRequest }) {
  const signals = [];
  const triggeredConditions = [];
  const fraudTypeSet = new Set();
  let score = 0;

  const add = (points, label, fraudType = null) => {
    score += points;
    signals.push({ points, label, fraudType });
    triggeredConditions.push(label);
    if (fraudType) fraudTypeSet.add(fraudType);
  };

  const deliveryProofExists = hasDeliveryProof(proof);
  const deliveryPhotoExists = Boolean(proof?.deliveryPhoto);
  const deliveryGoodCondition = deliveryPhotoExists && proof?.checks?.noDamage !== 'No' && proof?.checks?.noStains !== 'No';
  const visualMismatch = returnRequest.visualResult === 'Mismatch' || returnRequest.visualResult === 'Damage found';
  const returnDamageFound = returnRequest.visualResult === 'Damage found' || isNo(returnRequest.noDamage);
  const family = productFamily(product);
  const receiptMismatch =
    returnRequest.receiptId !== order.receiptId ||
    (returnRequest.receiptHash && returnRequest.receiptHash !== order.receiptHash) ||
    returnRequest.billQrMismatch ||
    (returnRequest.uploadedBillQrValue && returnRequest.billQrValue && returnRequest.uploadedBillQrValue !== returnRequest.billQrValue) ||
    returnRequest.receiptChanged ||
    returnRequest.priceChanged ||
    returnRequest.dateChanged ||
    returnRequest.productDetailsChanged;

  if (product.price > 20000) add(25, 'High-value product above Rs.20,000');
  if (!proof?.deliveryPhoto || !proof?.packagePhoto) add(40, 'Delivery proof missing');
  if (!proof?.otpVerified) add(30, 'OTP was not verified');
  if (!returnRequest.partnerVerificationPending && !returnRequest.returnOtpVerified) {
    add(30, 'Return pickup OTP did not match the original delivery OTP', 'Friendly Fraud');
  }
  if (returnRequest.reverseImageMatch || returnRequest.onlineImageMatched) {
    add(100, 'Reverse image lookup matched the return proof with an online/reused image source', 'Reverse Image Match Fraud');
  }

  if (returnRequest.reason === 'Item not received' && deliveryProofExists && deliveryPhotoExists) {
    add(30, 'Customer selected Item not received, but delivery photo, OTP, and timestamp exist', 'INR Abuse');
  }

  if (returnRequest.reason === 'Damaged product' && deliveryGoodCondition && visualMismatch && returnDamageFound) {
    add(35, 'Damage claim conflicts with good delivery photo and damaged/mismatched return proof', 'Fake Damage Claim');
  } else if (returnRequest.reason === 'Damaged product' && visualMismatch) {
    add(25, 'Damage claim has mismatched or damaged return comparison', 'Fake Damage Claim');
  }

  if (!returnRequest.partnerVerificationPending && returnRequest.colorMismatch) {
    add(35, 'Colour match failed: return product colour does not match delivery proof', 'Fake Damage Claim');
  }

  if (receiptMismatch) {
    add(40, 'Receipt ID, hash, price, date, or product details do not match original order', 'Receipt Manipulation');
  }

  if ((returnRequest.chargebackRisk || returnRequest.bankDispute || returnRequest.unauthorizedClaim) && deliveryProofExists) {
    add(40, 'Repeated chargeback/bank dispute despite verified delivery proof', 'Friendly Fraud');
  }

  const fraudRingSignals = [
    returnRequest.deviceLinked,
    returnRequest.sameIp,
    returnRequest.sameDevice,
    returnRequest.sameAddress,
    returnRequest.duplicateFace,
    returnRequest.livenessFailed,
    returnRequest.aiProfileImage
  ].filter(Boolean).length;

  if (fraudRingSignals > 0) {
    add(50, 'Linked IP/device/address or identity verification signals indicate a possible fraud ring', 'Fraud Ring');
  }

  if (!returnRequest.partnerVerificationPending) {
    if (family === 'Fashion') {
      if (!returnRequest.tagPhoto || ['Missing', 'Removed', 'Damaged'].includes(returnRequest.tagCondition)) {
        add(40, 'Fashion tag is missing, removed, or damaged during return verification', 'Wardrobing Fraud');
      }
      if (product.wardrobingRiskLevel === 'high' && returnRequest.after24Hours) {
        add(20, 'High-risk fashion product return requested after the 12-hour policy window', 'Wardrobing Fraud');
      }
    }

    if (family === 'Electronics') {
      if (isNo(returnRequest.serialMatches)) {
        add(40, 'Electronics serial number does not match the delivered product', 'Receipt Manipulation');
      }
      if (isYes(returnRequest.serialMatches) && isYes(returnRequest.usageHigh)) {
        add(35, 'Serial number matches, but usage or activation is high', 'Wardrobing Fraud');
      }
    }

    if (family === 'Tools' && isYes(returnRequest.scratchesOrDirt)) {
      add(30, 'Tool has scratches, dirt, or heavy usage marks', 'Wardrobing Fraud');
    }
  } else {
    signals.push({ points: 0, label: 'Product-specific checks assigned to delivery partner pickup', fraudType: null });
  }

  if (returnRequest.imageQualityGood && returnRequest.duplicatePassed && score > 0) {
    score = Math.max(0, score - 20);
    signals.push({ points: -20, label: 'Return image quality and duplicate checks passed', fraudType: null });
    triggeredConditions.push('Good return proof reduced risk by 20 points');
  }

  score = Math.min(100, Math.max(0, score));
  const classification = classifyRisk(score);
  const fraudTypes = [...fraudTypeSet];
  const typeText = fraudTypes.length ? fraudTypes.join(', ') : 'No fraud type detected';

  return {
    score,
    ...classification,
    fraudTypes,
    fraudTypeText: typeText,
    triggeredConditions: triggeredConditions.length ? triggeredConditions : ['No suspicious return conditions triggered'],
    signals: signals.length ? signals : [{ points: 0, label: 'No suspicious signals detected', fraudType: null }],
    explanation:
      classification.decision === 'Auto Approve'
        ? `No major fraud type was detected. Decision: ${classification.decision}.`
        : classification.decision === 'Manual Review'
          ? `Detected signals need reviewer attention. Fraud type detected: ${typeText}.`
          : `High-risk return case. Fraud type detected: ${typeText}. Reject or investigate before refund.`
  };
}
