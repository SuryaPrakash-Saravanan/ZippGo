export function calculateSellerRisk(seller) {
  let riskScore = 0;
  const fraudTypes = new Set();
  const triggeredSignals = [];

  const add = (points, signal, fraudType) => {
    riskScore += points;
    triggeredSignals.push(signal);
    fraudTypes.add(fraudType);
  };

  if (seller.orderedSku !== seller.dispatchSku || seller.evidence?.productImageMismatch) {
    add(40, 'Ordered SKU does not match seller dispatch SKU or product image mismatch detected.', 'Wrong Product Dispatch');
  }

  if (seller.sealBroken || seller.scratchesDetected || seller.warrantyActivated || seller.conditionMarkedUsed) {
    add(35, 'Seal broken, scratches detected, warranty already activated, or product marked as used.', 'Used Product Sold as New');
  }

  if (seller.fakeListingDetected || seller.listingImageSuspicious || seller.titleSpecMismatch || seller.repeatedComplaints || seller.unrealisticallyLowPrice) {
    add(35, 'Listing image, title/specification, complaints, or price pattern indicates a misleading listing.', 'Misleading / Fake Listing');
  }

  if (seller.missingAccessoryCount > 0 || seller.accessoryChecklistIncomplete) {
    add(25, 'Required accessories are missing or accessory checklist is incomplete.', 'Missing Accessories Fraud');
  }

  if (seller.sellerFalseDamageClaim || (seller.sellerClaimsDamage && seller.returnPickupGoodCondition && seller.deliveryPickupProofSupportsCustomer)) {
    add(35, 'Seller damage claim conflicts with delivery and return pickup proof.', 'False Damage Claim by Seller');
  }

  if (seller.invoiceMismatch || seller.invoiceHashFailed || seller.invoiceDetailsChanged) {
    add(40, 'Invoice ID, QR/hash, price, date, or product details failed verification.', 'Seller Invoice Manipulation');
  }

  if (seller.packageWeightMismatch || seller.productProofMissing || seller.courierScanWeightMismatch) {
    add(50, 'Shipment proof missing or package/courier scan weight mismatch detected.', 'Fake Shipment / Empty Box');
  }

  if (seller.cancellationRate >= 18) {
    add(20, 'Seller accepts orders but cancels frequently.', 'Stock Manipulation');
  }

  if (seller.lateDispatchRate >= 20) {
    add(20, 'Seller has repeated late dispatches.', 'Stock Manipulation');
  }

  if (seller.fakeReviewDetected || seller.sameIpReviews || seller.reviewBurst || seller.repeatedReviewText) {
    add(30, 'Review pattern shows shared IP/device, burst reviews, or repeated review text.', 'Fake Review Pattern');
  }

  if (seller.returnDenialAgainstEvidence || seller.rejectsGenuineReturn) {
    add(35, 'Seller rejected a genuine return even though platform evidence supports the customer.', 'Unfair Return Denial');
  }

  riskScore = Math.min(100, riskScore);
  const riskLevel = riskScore <= 30 ? 'Trusted' : riskScore <= 70 ? 'Watchlist' : 'Suspended';
  const decision = riskScore <= 30 ? 'Trusted Seller' : riskScore <= 70 ? 'Watchlist / Manual Review' : 'Suspend / Investigate';

  return {
    riskScore,
    riskLevel,
    fraudTypes: [...fraudTypes],
    decision,
    triggeredSignals: triggeredSignals.length ? triggeredSignals : ['No seller-side fraud signals triggered.']
  };
}

export function buildSellerMockData(products) {
  const product = (index) => products[index % products.length];
  const sellers = [
    {
      sellerId: 'SEL-1001',
      sellerName: 'Crown Mobile Hub',
      location: 'T. Nagar',
      category: 'Electronics',
      totalOrders: 820,
      cancellationRate: 6,
      lateDispatchRate: 8,
      returnDisputes: 14,
      wrongProductCount: 4,
      missingAccessoryCount: 0,
      orderedSku: 'IPH16-BLK-128',
      dispatchSku: 'IPH15-BLK-128',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(9), 'SKU mismatch found between order and dispatch proof.')
    },
    {
      sellerId: 'SEL-1002',
      sellerName: 'Madras Fashion Vault',
      location: 'Anna Nagar',
      category: 'Fashion',
      totalOrders: 430,
      cancellationRate: 5,
      lateDispatchRate: 11,
      returnDisputes: 22,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'DRESS-GOLD-M',
      dispatchSku: 'DRESS-GOLD-M',
      sealBroken: true,
      scratchesDetected: true,
      conditionMarkedUsed: true,
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(0), 'Customer reported used condition and tag wear.')
    },
    {
      sellerId: 'SEL-1003',
      sellerName: 'Budget Gadget Street',
      location: 'Ritchie Street',
      category: 'Gadgets',
      totalOrders: 260,
      cancellationRate: 12,
      lateDispatchRate: 15,
      returnDisputes: 31,
      wrongProductCount: 1,
      missingAccessoryCount: 2,
      orderedSku: 'CAM-Z-24',
      dispatchSku: 'CAM-Z-24',
      fakeListingDetected: true,
      listingImageSuspicious: true,
      titleSpecMismatch: true,
      unrealisticallyLowPrice: true,
      invoiceMismatch: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(14), 'Listing promised 5K camera, dispatched lower-spec model.')
    },
    {
      sellerId: 'SEL-1004',
      sellerName: 'ToolPro Chennai',
      location: 'Guindy',
      category: 'Tools',
      totalOrders: 510,
      cancellationRate: 8,
      lateDispatchRate: 13,
      returnDisputes: 19,
      wrongProductCount: 0,
      missingAccessoryCount: 6,
      accessoryChecklistIncomplete: true,
      orderedSku: 'DRILL-KIT-18V',
      dispatchSku: 'DRILL-KIT-18V',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(20), 'Battery and drill bit set missing from package.')
    },
    {
      sellerId: 'SEL-1005',
      sellerName: 'OMR Appliance Mart',
      location: 'OMR',
      category: 'Home',
      totalOrders: 740,
      cancellationRate: 7,
      lateDispatchRate: 9,
      returnDisputes: 26,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'VAC-S9',
      dispatchSku: 'VAC-S9',
      sellerFalseDamageClaim: true,
      sellerClaimsDamage: true,
      returnPickupGoodCondition: true,
      deliveryPickupProofSupportsCustomer: true,
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      evidence: evidenceFor(product(34), 'Return pickup image shows product in good condition.')
    },
    {
      sellerId: 'SEL-1006',
      sellerName: 'InvoicePlus Electronics',
      location: 'Velachery',
      category: 'Electronics',
      totalOrders: 390,
      cancellationRate: 5,
      lateDispatchRate: 7,
      returnDisputes: 18,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'TAB-AIR-11',
      dispatchSku: 'TAB-AIR-11',
      invoiceMismatch: true,
      invoiceHashFailed: true,
      invoiceDetailsChanged: true,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(40), 'Invoice hash failed and price/date were edited.')
    },
    {
      sellerId: 'SEL-1007',
      sellerName: 'FastShip Deals',
      location: 'Ambattur',
      category: 'Electronics',
      totalOrders: 610,
      cancellationRate: 10,
      lateDispatchRate: 18,
      returnDisputes: 39,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'SOUNDBAR-300',
      dispatchSku: 'SOUNDBAR-300',
      productProofMissing: true,
      packageWeightMismatch: true,
      courierScanWeightMismatch: true,
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(39), 'Seller marked shipped but product proof was missing.')
    },
    {
      sellerId: 'SEL-1008',
      sellerName: 'StockFlash Store',
      location: 'Porur',
      category: 'Shoes',
      totalOrders: 940,
      cancellationRate: 24,
      lateDispatchRate: 29,
      returnDisputes: 12,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'RUN-FOAM-9',
      dispatchSku: 'RUN-FOAM-9',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(31), 'Seller shows stock but frequently cancels after order acceptance.')
    },
    {
      sellerId: 'SEL-1009',
      sellerName: 'ReviewLift Bazaar',
      location: 'Tambaram',
      category: 'Home',
      totalOrders: 305,
      cancellationRate: 4,
      lateDispatchRate: 6,
      returnDisputes: 8,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'LAMP-LUX',
      dispatchSku: 'LAMP-LUX',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: true,
      sameIpReviews: true,
      reviewBurst: true,
      repeatedReviewText: true,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      evidence: evidenceFor(product(38), '42 reviews posted from repeated device/IP cluster.')
    },
    {
      sellerId: 'SEL-1010',
      sellerName: 'ReturnBlock Retail',
      location: 'Adyar',
      category: 'Fashion',
      totalOrders: 670,
      cancellationRate: 7,
      lateDispatchRate: 10,
      returnDisputes: 44,
      wrongProductCount: 0,
      missingAccessoryCount: 1,
      orderedSku: 'LEHENGA-RED-M',
      dispatchSku: 'LEHENGA-RED-M',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      returnDenialAgainstEvidence: true,
      rejectsGenuineReturn: true,
      evidence: evidenceFor(product(41), 'Platform evidence supports customer, but seller denied the return.')
    }
  ];

  return sellers.map((seller) => ({ ...seller, ...calculateSellerRisk(seller) }));
}

function evidenceFor(product, complaint) {
  return {
    orderedProductImage: product.image,
    sellerDispatchImage: product.image,
    packageImage: product.image,
    invoiceVerificationStatus: 'Checked against QR/hash database',
    skuMatchStatus: 'Verified by dispatch scan',
    serialNumberStatus: 'Serial captured at packing stage',
    accessoryChecklist: ['Main product', 'Manual', 'Cable/adapter', 'Warranty card'],
    packageWeight: '1.42 kg',
    courierScanWeight: '1.10 kg',
    customerComplaint: complaint,
    sellerResponse: 'Seller claims process followed correctly.',
    finalPlatformDecision: 'Evidence routed to seller integrity review.'
  };
}
