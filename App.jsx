import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  CreditCard,
  Heart,
  Lock,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Truck,
  Upload,
  User,
  XCircle
} from 'lucide-react';
import { categories, chennaiLocations, getDeliveryEstimate, normalizeCategory, products } from './data/products.js';
import { calculateFraudRisk } from './utils/fraud.js';
import { money, nowStamp, readStore, receiptHash, writeStore } from './utils/storage.js';

const CART_KEY = 'devx_v3_cart';
const WISH_KEY = 'devx_v3_wishlist';
const ORDERS_KEY = 'devx_v3_orders';
const RETURNS_KEY = 'devx_v3_returns';
const USERS_KEY = 'devx_v3_users';
const ACTIVE_USER_KEY = 'devx_v3_active_user';
const SELLERS_KEY = 'devx_v3_registered_sellers';
const ADMIN_KEY = 'devx_v3_admin_auth';
const LOCATION_KEY = 'devx_v3_location';
const RESET_KEY = 'devx_v3_storage_reset_done';
const ORDERS_RETURNS_RESET_KEY = 'devx_v3_orders_returns_reset_20260430_clean_orders_returns_v3';
const THEME_KEY = 'devx_v3_theme';
const SHOPSPHERE_BUY_KEY = 'devx_v3_shopsphere_buy';

const wardrobingPolicies = [
  { type: 'Clothes / Dresses', risk: 'High', window: '12 hours', solution: 'Return only if anti-return tag, seal, packaging, and freshness are intact.', proof: 'Delivery tag photo + return tag photo + stain/smell check' },
  { type: 'Electronics', risk: 'High', window: '24-72 hours', solution: 'Return only after usage hours, battery cycles, serial number, scratches, accessories, warranty status, and packaging are checked.', proof: 'Serial number photo + working video + accessory checklist' },
  { type: 'Tools', risk: 'High', window: '24-72 hours', solution: 'Return only if there are no dust, oil, scratches, missing parts, or heavy usage marks.', proof: 'Condition photos + usage mark checklist' },
  { type: 'Cosmetics / Personal Care', risk: 'Very High', window: 'No return after opening', solution: 'No return after seal is opened. Unopened products require original seal verification.', proof: 'Seal photo + unopened package proof' },
  { type: 'Books / Study Materials', risk: 'Medium', window: '3-7 days', solution: 'Return only if pages are not folded, torn, highlighted, or written on.', proof: 'Page-edge photo + inside-page inspection' },
  { type: 'Footwear', risk: 'High', window: '24-72 hours', solution: 'Return only if sole is clean, tag is intact, and footwear was not used outside.', proof: 'Sole condition photo + tag/box proof' }
];

const refundDecisions = [
  ['Unused, tag intact', 'Full refund'],
  ['Minor packaging damage', 'Small deduction'],
  ['Used but resellable', 'Partial refund'],
  ['Clearly used / damaged', 'Return rejected']
];

const rentalOptions = ['Party dresses', 'Cameras', 'Travel electronics', 'Power tools', 'Camping gear'];
const nonReturnableLabels = ['Innerwear', 'Opened cosmetics', 'Personal care items', 'Event wear after tag removal', 'Opened food/perishable items', 'Customized products'];

function getWardrobingPolicy(product = {}) {
  const category = normalizeCategory(product.category || '');
  const name = (product.name || '').toLowerCase();
  if (isFoodProduct(product)) return { type: 'Food / Beverages', risk: 'Very High', window: 'Same-day verification only', solution: 'Return is allowed only after app-only camera/video capture, metadata verification, motion check, and screen-fake detection.', proof: 'Live camera video/photo + 3-frame motion check + timestamp + device info', rental: false, nonReturnableWhen: 'Opened, consumed, expired, replaced, or screen-captured proof is detected.' };
  if (category === 'Fashion') return { ...wardrobingPolicies[0], rental: true, nonReturnableWhen: 'Tag removed, damaged, stained, perfumed, or visibly worn.' };
  if (category === 'Electronics') return { ...wardrobingPolicies[1], rental: name.includes('camera') || name.includes('projector'), nonReturnableWhen: 'Serial mismatch, high usage, warranty activated, dents, or missing accessories.' };
  if (category === 'Tools') return { ...wardrobingPolicies[2], rental: true, nonReturnableWhen: 'Oil, dust, scratches, missing parts, or heavy usage marks found.' };
  return { type: 'Normal / Home products', risk: product.price > 20000 ? 'Medium' : 'Low', window: product.price > 20000 ? '3-7 days' : '7-10 days', solution: 'Normal return process with packaging, accessory, and condition inspection.', proof: 'Product photo + package photo', rental: false, nonReturnableWhen: 'Damaged, used, missing parts, or not in resellable condition.' };
}

function getReasonProof(reason, product) {
  const policy = getWardrobingPolicy(product);
  const base = {
    'Damaged product': 'Upload clear damage photos/video. Pickup partner compares delivery photo against return condition.',
    'Wrong item received': 'Pickup partner checks product image, SKU, category, and dispatch proof.',
    'Wrong colour delivered': 'Colour match compares delivery proof and return image.',
    'Size issue': 'Product must be unused. Fashion items need tag, freshness, no stains, and no perfume/smell.',
    'Missing accessory': 'Accessory checklist must show which item is missing.',
    'Product not working': 'Electronics/tools need serial number and working-condition test by pickup partner.',
    'Quality issue': 'Upload product condition photo. Pickup partner checks whether usage marks exist.',
    Other: 'Type a clear reason and upload supporting photo if available.'
  };
  return `${base[reason] || base.Other} Policy: ${policy.solution}`;
}

function getPickupChecklist(product = {}) {
  const category = normalizeCategory(product.category || '');
  if (isFoodProduct(product)) return ['Live return proof captured', 'Metadata verified', 'Motion/depth check passed', 'Screen recapture not detected'];
  if (category === 'Fashion') return ['Anti-return tag attached', 'No perfume/smell/stain', 'No wrinkles or wear signs', 'Original packaging available'];
  if (category === 'Electronics') return ['Serial number matched', 'All accessories available', 'No scratches or dents', 'Device turns on', 'Usage hours/battery cycle acceptable'];
  if (category === 'Tools') return ['No dust or oil marks', 'No heavy scratches', 'No missing parts', 'Working condition verified'];
  return ['Product photo matches delivery proof', 'Package condition acceptable', 'Accessories available', 'No usage/damage marks'];
}

function getRefundOutcome(returnCase) {
  if (returnCase?.result?.decision === 'Refund Approved' || returnCase?.status?.includes('Refund approved')) return 'Money will be refunded within 12 hours';
  if (returnCase?.status?.includes('Food proof submitted')) return 'Food video proof sent to admin and ZippGo. Refund starts only after approval.';
  if (!returnCase?.deliveryPartnerChecks) return 'Pending pickup inspection';
  if (returnCase.partnerDecision === 'Cancelled') return 'Return rejected';
  if (returnCase.result?.decision === 'Reject / Investigate') return 'Return rejected or investigation hold';
  if (returnCase.result?.decision === 'Manual Review') return 'Manual review / possible partial refund';
  return 'Full refund eligible after final inspection';
}

function useLocalState(key, fallback) {
  const [value, setValue] = useState(() => readStore(key, fallback));

  useEffect(() => {
    const refresh = () => setValue(readStore(key, fallback));
    const sync = (event) => {
      if (event.detail?.key === key) setValue(event.detail.value);
    };
    const storageSync = (event) => {
      if (event.key === key) setValue(event.newValue ? JSON.parse(event.newValue) : fallback);
    };
    window.addEventListener('devx-store-change', sync);
    window.addEventListener('devx-delivery-completed', refresh);
    window.addEventListener('storage', storageSync);
    window.addEventListener('focus', refresh);
    window.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('devx-store-change', sync);
      window.removeEventListener('devx-delivery-completed', refresh);
      window.removeEventListener('storage', storageSync);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('visibilitychange', refresh);
    };
  }, [key]);

  const update = (next) => {
    const latest = readStore(key, value);
    const computed = typeof next === 'function' ? next(latest) : next;
    setValue(computed);
    writeStore(key, computed);
    window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key, value: computed } }));
  };
  return [value, update];
}

function notify(message) {
  window.dispatchEvent(new CustomEvent('devx-toast', { detail: message }));
}

function applyThemePreference(preference = 'system') {
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
}

function useThemePreference() {
  const [theme, setTheme] = useLocalState(THEME_KEY, 'system');
  useEffect(() => {
    applyThemePreference(theme);
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const sync = () => theme === 'system' && applyThemePreference('system');
    media?.addEventListener?.('change', sync);
    return () => media?.removeEventListener?.('change', sync);
  }, [theme]);
  return [theme, setTheme];
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskPhone(phone = '') {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone || 'customer phone';
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

function qrCodeImage(value = '') {
  const seed = [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const size = 25;
  const cell = 6;
  const pad = 18;
  const view = size * cell + pad * 2;
  const cells = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const finder =
        (row < 7 && col < 7) ||
        (row < 7 && col > size - 8) ||
        (row > size - 8 && col < 7);
      const innerFinder =
        ((row > 1 && row < 5 && col > 1 && col < 5) ||
          (row > 1 && row < 5 && col > size - 6 && col < size - 2) ||
          (row > size - 6 && row < size - 2 && col > 1 && col < 5));
      if (finder) return !innerFinder;
      return ((row * 31 + col * 17 + seed + (row % 3) * col) % 5 < 2);
    })
  );
  const rects = cells.flatMap((row, y) => row.map((filled, x) => filled ? `<rect x="${pad + x * cell}" y="${pad + y * cell}" width="${cell}" height="${cell}" rx="1"/>` : '')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${view}" height="${view}" viewBox="0 0 ${view} ${view}"><rect width="${view}" height="${view}" rx="18" fill="#fff"/><rect x="8" y="8" width="${view - 16}" height="${view - 16}" rx="14" fill="#fff" stroke="#dbeafe" stroke-width="2"/><g fill="#020617">${rects}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getBillPayload(orderId) {
  const hash = receiptHash(orderId);
  return {
    receiptId: `BILL-${orderId}`,
    receiptHash: hash,
    billQrValue: hash,
    billQrImage: qrCodeImage(hash),
    billGeneratedAt: nowStamp()
  };
}

function getDeliveredBill(order = {}) {
  const hash = order.receiptHash || receiptHash(order.id || `ORDER-${Date.now()}`);
  return {
    receiptId: order.receiptId || `BILL-${order.id}`,
    receiptHash: hash,
    billQrValue: order.billQrValue || hash,
    billQrImage: order.billQrImage || qrCodeImage(hash),
    billGeneratedAt: order.billGeneratedAt || order.deliveredAt || nowStamp()
  };
}

function getDynamicReturnPolicy(product = {}) {
  const category = normalizeCategory(product.category || '');
  const name = `${product.name || ''} ${category}`.toLowerCase();
  if (isFoodProduct(product)) {
    return {
      family: 'Food & Beverages',
      window: '2-3 second app video required',
      validReasons: ['Damaged product', 'Wrong item received', 'Quality issue', 'Other'],
      summary: 'Food and beverage returns require an app-only short video. File upload is disabled, and the system checks metadata, tilt/motion commands, torch state, screen re-capture, deepfake-like signals, and reverse image lookup before approval.',
      partnerChecks: ['App-only live video', 'Tilt challenge command', 'Torch on/off proof', 'Metadata and device verification', 'Deepfake/screen-fake checks']
    };
  }
  const isFashion = category === 'Fashion' || /(dress|shoe|bag|travel|trolley|saree|jacket)/.test(name);
  const isElectronics = category === 'Electronics' || /(oven|mobile|laptop|watch|camera|charger|tv|refrigerator|washing machine)/.test(name);
  const isTools = category === 'Tools' || /(appliance|kitchen|furniture|sport|saw|tool|cookware|table)/.test(name);
  if (isFashion) {
    return {
      family: 'Fashion',
      window: '12 hours',
      validReasons: ['Size issue', 'Wrong colour delivered', 'Damaged product'],
      summary: 'Fashion returns are allowed within 12 hours only for size issue, colour mismatch, or damage.',
      partnerChecks: ['Capture delivery image', 'Compare return product with delivery image', 'Approve only if product matches']
    };
  }
  if (isElectronics) {
    return {
      family: 'Electronics',
      window: 'External damage only',
      validReasons: ['Damaged product'],
      summary: 'Electronics returns are allowed only for external damage after serial number, usage, and image comparison checks.',
      partnerChecks: ['Verify serial number', 'Compare delivery and return image', 'Check usage/activation condition', 'Confirm original product match']
    };
  }
  if (isTools) {
    return {
      family: 'Tools',
      window: 'Inspection required',
      validReasons: ['Damaged product', 'Product not working', 'Quality issue'],
      summary: 'Tools and utility products require scratch, physical damage, and working-condition verification.',
      partnerChecks: ['Check scratches and physical damage', 'Verify working condition during delivery and return', 'Confirm no heavy usage marks']
    };
  }
  return {
    family: 'Standard',
    window: 'Normal return window',
    validReasons: ['Damaged product', 'Wrong item received', 'Missing accessory', 'Quality issue', 'Other'],
    summary: 'Standard products follow normal return checks with delivery proof and partner verification.',
    partnerChecks: ['Compare product proof', 'Check packaging', 'Verify delivery proof']
  };
}

function pendingReturnResult() {
  return {
    pending: true,
    score: null,
    level: 'Pending',
    decision: 'Waiting for delivery partner verification',
    tone: 'pending',
    fraudTypes: [],
    fraudTypeText: 'Pending partner verification',
    triggeredConditions: ['Risk score will be generated after the delivery partner checks product condition, colour, and proof photos.'],
    signals: [{ points: 0, label: 'Waiting for delivery partner product condition checks', fraudType: null }],
    explanation: 'Risk score is hidden until ZippGo verifies product match, condition, colour, and return proof photos.'
  };
}

function foodLiveReturnResult(analysis) {
  const score = analysis?.riskScore ?? 100;
  const level = score <= 30 ? 'Low' : score <= 70 ? 'Medium' : 'High';
  const decision = analysis?.reverseImageMatch || analysis?.deepfakeSuspected ? 'Reject / Investigate' : (level === 'Low' && analysis?.productMatchOk ? 'Food Proof Passed - Awaiting Approval' : level === 'Medium' ? 'Additional Verification Required' : 'Manual Review Required');
  const signals = [];
  if (analysis?.metadataIssue) signals.push({ points: 20, label: 'Metadata issue found in app-only proof video', fraudType: 'Food Return Video Fraud' });
  if (!analysis?.motionOk) signals.push({ points: 30, label: 'Tilt/depth motion was too low during the 2-3 second video', fraudType: 'Food Return Video Fraud' });
  if (!analysis?.torchOk) signals.push({ points: 15, label: 'Torch on/off challenge was not completed clearly', fraudType: 'Food Return Video Fraud' });
  if (!analysis?.productMatchOk) signals.push({ points: 45, label: analysis?.productMatchReason || 'The live proof does not confidently match the ordered product', fraudType: 'Wrong Product / Random Video Proof' });
  if (analysis?.screenDetected) signals.push({ points: 40, label: 'Possible screen-based video replay detected', fraudType: 'Food Return Video Fraud' });
  if (analysis?.deepfakeSuspected) signals.push({ points: 100, label: 'Deepfake or synthetic-video pattern suspected', fraudType: 'Deepfake Return Proof' });
  if (analysis?.reverseImageMatch) signals.push({ points: 100, label: 'Reverse image lookup matched this proof with an online/reused image source', fraudType: 'Reverse Image Match Fraud' });
  if (!signals.length) signals.push({ points: 0, label: 'App-only video, same-product, metadata, tilt, torch, and screen checks passed', fraudType: null });
  const fraudTypes = [...new Set(signals.map((signal) => signal.fraudType).filter(Boolean))];
  return {
    score,
    level,
    decision,
    pending: false,
    tone: decision === 'Reject / Investigate' || level === 'High' ? 'danger' : level === 'Medium' ? 'warn' : 'good',
    fraudTypes,
    fraudTypeText: fraudTypes.length ? fraudTypes.join(', ') : 'No fraud type detected',
    triggeredConditions: signals.map((signal) => signal.label),
    signals,
    explanation:
      analysis?.reverseImageMatch || analysis?.deepfakeSuspected
        ? 'The proof video matched a reused/online or synthetic-video signal. The return is rejected automatically to prevent proof fraud.'
        : level === 'Low' && analysis?.productMatchOk
        ? 'The app-only food proof video passed the same-product, metadata, tilt/motion, torch, and screen-fake checks. Money will be refunded within 12 hours. If the refund is not received, contact support.'
        : level === 'Medium'
          ? 'Food return proof needs additional verification because one signal was unclear. This avoids blocking genuine customers too quickly.'
          : 'Food return proof has high-risk signals and should be manually reviewed before refund.'
  };
}

function svgText(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shopSphereImage(productName, category, index) {
  const palettes = [
    ['#111827', '#38bdf8', '#a855f7'],
    ['#10130f', '#20c997', '#f59e0b'],
    ['#160d13', '#fb7185', '#60a5fa'],
    ['#111111', '#facc15', '#34d399'],
    ['#0b1220', '#818cf8', '#22d3ee']
  ];
  const [bg, accent, accentTwo] = palettes[index % palettes.length];
  const label = svgText(category.toUpperCase());
  const title = svgText(productName.split(' ').slice(0, 3).join(' '));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${accent}" stop-opacity=".92"/><stop offset="1" stop-color="${accentTwo}" stop-opacity=".88"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000" flood-opacity=".38"/></filter>
      </defs>
      <rect width="720" height="520" rx="42" fill="${bg}"/>
      <circle cx="620" cy="76" r="120" fill="${accentTwo}" opacity=".22"/>
      <circle cx="92" cy="438" r="150" fill="${accent}" opacity=".18"/>
      <rect x="86" y="82" width="548" height="356" rx="34" fill="#ffffff" opacity=".06"/>
      <g filter="url(#s)">
        <rect x="214" y="130" width="292" height="220" rx="28" fill="url(#g)"/>
        <rect x="246" y="160" width="228" height="150" rx="18" fill="#ffffff" opacity=".18"/>
        <circle cx="360" cy="390" r="32" fill="#fff7db"/>
      </g>
      <rect x="44" y="42" width="300" height="54" rx="16" fill="#000" opacity=".34"/>
      <text x="64" y="78" fill="#fff7db" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="900">${label}</text>
      <rect x="44" y="382" width="520" height="96" rx="18" fill="#000" opacity=".42"/>
      <text x="64" y="426" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="900">${title}</text>
      <text x="64" y="462" fill="${accent}" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800">Verified shop product ${String(index + 1).padStart(2, '0')}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getShopSpherePrimaryCategory(category, productName = '') {
  const value = `${category} ${productName}`.toLowerCase();
  if (/(dress|shoe|sneaker|saree|bag|backpack|trolley|travel|cosmetic|beauty|serum|skincare|makeup)/.test(value)) return 'Fashion';
  if (/(electronics|oven|mobile|laptop|watch|camera|charger|smartphone|refrigerator|ac|tv|washing machine|cooling|accessory)/.test(value)) return 'Electronics';
  return 'Tools';
}

const shopSphereSeed = [
  { productId: 'SSP-001', productName: 'AeroBake Smart Oven 45L', category: 'Oven', price: 24999, productRating: 4.7, customerReview: 'Oven works perfectly and packaging was safe.', shopName: 'Chennai HomeTech', shopLocation: 'T. Nagar', successfulDeliveries: 920, totalDeliveries: 1000 },
  { productId: 'SSP-002', productName: 'Urban Rose Party Dress', category: 'Dress', price: 3299, productRating: 4.5, customerReview: 'Dress quality is very good and delivery was fast.', shopName: 'Madras Fashion Studio', shopLocation: 'Anna Nagar', successfulDeliveries: 742, totalDeliveries: 820 },
  { productId: 'SSP-003', productName: 'StrideFlex Running Shoes', category: 'Shoes', price: 2799, productRating: 4.4, customerReview: 'Shoes are comfortable and worth the price.', shopName: 'UrbanStep Footwear', shopLocation: 'Velachery', successfulDeliveries: 658, totalDeliveries: 730 },
  { productId: 'SSP-004', productName: 'GlowMist Skincare Combo', category: 'Cosmetics', price: 1599, productRating: 4.2, customerReview: 'The skincare kit arrived sealed and felt premium.', shopName: 'GlowNest Beauty', shopLocation: 'Mylapore', successfulDeliveries: 614, totalDeliveries: 690 },
  { productId: 'SSP-005', productName: 'MagCharge Mobile Accessory Kit', category: 'Mobile accessories', price: 1199, productRating: 4.3, customerReview: 'Cable and charger quality is reliable for daily use.', shopName: 'CableKart Chennai', shopLocation: 'Guindy', successfulDeliveries: 810, totalDeliveries: 900 },
  { productId: 'SSP-006', productName: 'Aluminium Laptop Cooling Stand', category: 'Laptop accessories', price: 1899, productRating: 4.1, customerReview: 'Laptop stand is sturdy and cooling fan is quiet.', shopName: 'LapZone Accessories', shopLocation: 'OMR', successfulDeliveries: 696, totalDeliveries: 780 },
  { productId: 'SSP-007', productName: 'EcoWash Washing Machine 7kg', category: 'Home appliances', price: 32999, productRating: 4.6, customerReview: 'Washing machine installation was quick and smooth.', shopName: 'Prime Appliances Hub', shopLocation: 'Tambaram', successfulDeliveries: 521, totalDeliveries: 590 },
  { productId: 'SSP-008', productName: 'PulseFit AMOLED Smart Watch', category: 'Smart watches', price: 6499, productRating: 4.5, customerReview: 'Display is bright and battery lasted almost a week.', shopName: 'WristWorld India', shopLocation: 'Adyar', successfulDeliveries: 884, totalDeliveries: 940 },
  { productId: 'SSP-009', productName: 'MetroLite Office Backpack', category: 'Bags', price: 2199, productRating: 4.4, customerReview: 'Backpack has excellent padding and neat compartments.', shopName: 'BagStreet Co', shopLocation: 'Egmore', successfulDeliveries: 566, totalDeliveries: 640 },
  { productId: 'SSP-010', productName: 'Granite Nonstick Cookware Set', category: 'Kitchen items', price: 3499, productRating: 4.3, customerReview: 'Cookware looks classy and food does not stick.', shopName: 'KitchenCraft Mart', shopLocation: 'Porur', successfulDeliveries: 783, totalDeliveries: 870 },
  { productId: 'SSP-011', productName: 'CinemaView 43-inch Smart TV', category: 'Electronics', price: 28999, productRating: 4.6, customerReview: 'Picture quality is sharp and setup was simple.', shopName: 'ElectroPulse', shopLocation: 'Chromepet', successfulDeliveries: 709, totalDeliveries: 790 },
  { productId: 'SSP-012', productName: 'Velvet Matte Beauty Box', category: 'Beauty products', price: 2299, productRating: 4.0, customerReview: 'Makeup shades are fresh and packed carefully.', shopName: 'BloomCare Beauty', shopLocation: 'Nungambakkam', successfulDeliveries: 502, totalDeliveries: 620 },
  { productId: 'SSP-013', productName: 'Nordic Foldable Study Table', category: 'Furniture', price: 5999, productRating: 4.2, customerReview: 'The table is compact, stable, and easy to move.', shopName: 'WoodCasa Living', shopLocation: 'Ambattur', successfulDeliveries: 437, totalDeliveries: 520 },
  { productId: 'SSP-014', productName: 'ProGrip Badminton Kit', category: 'Sports items', price: 2599, productRating: 4.5, customerReview: 'Rackets feel balanced and the grip is comfortable.', shopName: 'Sportiva Arena', shopLocation: 'Besant Nagar', successfulDeliveries: 679, totalDeliveries: 760 },
  { productId: 'SSP-015', productName: 'VoyagePro Hard Shell Trolley', category: 'Travel items', price: 4999, productRating: 4.4, customerReview: 'The trolley rolls smoothly and feels durable.', shopName: 'TravelMate Gear', shopLocation: 'Thoraipakkam', successfulDeliveries: 602, totalDeliveries: 680 },
  { productId: 'SSP-016', productName: 'FrostMax Double Door Refrigerator', category: 'Home appliances', price: 45999, productRating: 4.7, customerReview: 'Cooling is powerful and delivery team handled it well.', shopName: 'CoolHome Refrigeration', shopLocation: 'Kodambakkam', successfulDeliveries: 478, totalDeliveries: 540 },
  { productId: 'SSP-017', productName: 'SilkWeave Festive Saree', category: 'Dress', price: 4299, productRating: 4.6, customerReview: 'Saree material is soft and colours look rich.', shopName: 'SareeSaga Boutique', shopLocation: 'Purasawalkam', successfulDeliveries: 718, totalDeliveries: 800 },
  { productId: 'SSP-018', productName: 'AirLite Casual Sneakers', category: 'Shoes', price: 2399, productRating: 4.1, customerReview: 'Sneakers are light and fit true to size.', shopName: 'SneakerSoul', shopLocation: 'Ashok Nagar', successfulDeliveries: 639, totalDeliveries: 710 },
  { productId: 'SSP-019', productName: 'LuxeGlow Hair Serum Pack', category: 'Beauty products', price: 999, productRating: 3.9, customerReview: 'Hair serum smells nice and reduced frizz.', shopName: 'LuxeCosmo Store', shopLocation: 'Perungudi', successfulDeliveries: 722, totalDeliveries: 890 },
  { productId: 'SSP-020', productName: 'FastDock Wireless Charger', category: 'Mobile accessories', price: 1699, productRating: 4.0, customerReview: 'Wireless charger is compact and charges steadily.', shopName: 'MobileMate Hub', shopLocation: 'Saidapet', successfulDeliveries: 711, totalDeliveries: 790 },
  { productId: 'SSP-021', productName: 'CreatorBook Pro Laptop', category: 'Electronics', price: 58999, productRating: 4.8, customerReview: 'Laptop is fast for coding and display is excellent.', shopName: 'DeskPro Tech', shopLocation: 'Velachery', successfulDeliveries: 448, totalDeliveries: 500 },
  { productId: 'SSP-022', productName: 'QuietCool Inverter AC', category: 'Home appliances', price: 38999, productRating: 4.5, customerReview: 'AC cools the room quickly and runs quietly.', shopName: 'BreezePoint Appliances', shopLocation: 'Medavakkam', successfulDeliveries: 497, totalDeliveries: 560 },
  { productId: 'SSP-023', productName: 'RunMaster Foldable Treadmill', category: 'Sports items', price: 62999, productRating: 4.7, customerReview: 'Treadmill feels gym-grade and folds neatly.', shopName: 'FitRun Equipment', shopLocation: 'Sholinganallur', successfulDeliveries: 348, totalDeliveries: 410 },
  { productId: 'SSP-024', productName: 'PixelShot Mirrorless Camera', category: 'Electronics', price: 54999, productRating: 4.8, customerReview: 'Camera autofocus is quick and travel photos look crisp.', shopName: 'LensCraft Camera House', shopLocation: 'Adyar', successfulDeliveries: 384, totalDeliveries: 430 },
  { productId: 'SSP-025', productName: 'ChronoLux Premium Watch', category: 'Smart watches', price: 27999, productRating: 4.6, customerReview: 'Premium watch finish is elegant and battery is strong.', shopName: 'PremiumWatch Gallery', shopLocation: 'Alwarpet', successfulDeliveries: 511, totalDeliveries: 580 },
  { productId: 'SSP-026', productName: 'Nova X Smartphone 256GB', category: 'Electronics', price: 74999, productRating: 4.9, customerReview: 'Phone camera and performance are flagship level.', shopName: 'SmartPhone Palace', shopLocation: 'Mount Road', successfulDeliveries: 691, totalDeliveries: 760 },
  { productId: 'SSP-027', productName: 'ChefMate Induction Cooktop', category: 'Kitchen items', price: 2499, productRating: 4.2, customerReview: 'Induction heats fast and controls are easy.', shopName: 'HomeChef Essentials', shopLocation: 'Kilpauk', successfulDeliveries: 573, totalDeliveries: 650 },
  { productId: 'SSP-028', productName: 'ComfortNest Recliner Chair', category: 'Furniture', price: 18999, productRating: 4.5, customerReview: 'Recliner is comfortable and looks premium in the hall.', shopName: 'HomeEase Furniture', shopLocation: 'Mogappair', successfulDeliveries: 455, totalDeliveries: 520 },
  { productId: 'SSP-029', productName: 'PowerHit Cricket Bat', category: 'Sports items', price: 3799, productRating: 4.3, customerReview: 'Bat pickup is good and sweet spot feels strong.', shopName: 'CricketPro Sports', shopLocation: 'Chepauk', successfulDeliveries: 733, totalDeliveries: 820 },
  { productId: 'SSP-030', productName: 'TrailPack Travel Organizer Set', category: 'Travel items', price: 1299, productRating: 3.8, customerReview: 'Organizer set keeps luggage clean and sorted.', shopName: 'VoyagePro Luggage', shopLocation: 'Pallavaram', successfulDeliveries: 621, totalDeliveries: 760 }
];

const shopSphereProducts = shopSphereSeed.map((product, index) => {
  const deliverySuccessPercentage = Number(((product.successfulDeliveries / product.totalDeliveries) * 100).toFixed(1));
  const category = getShopSpherePrimaryCategory(product.category, product.productName);
  return {
    ...product,
    originalCategory: product.category,
    category,
    productImage: shopSphereImage(product.productName, category, index),
    deliverySuccessPercentage,
    shopDeliveryRating: Number((deliverySuccessPercentage / 10).toFixed(1))
  };
});

const foodBeverageSeed = [
  { id: 1, name: 'Egg Fried Rice', category: 'Prepared Food', shop: 'Wok Street Kitchen', price: 180, rating: 4.6, review: 'Hot, fresh, and the egg flavour was perfect.' },
  { id: 2, name: 'Chicken Biryani', category: 'Prepared Food', shop: 'Madras Biryani House', price: 240, rating: 4.7, review: 'Aromatic biryani with good portion size.' },
  { id: 3, name: 'Paneer Butter Masala Meal', category: 'Prepared Food', shop: 'Tiffin Treats', price: 220, rating: 4.5, review: 'Creamy paneer and soft chapatis arrived warm.' },
  { id: 4, name: 'Masala Dosa with Chutney', category: 'Prepared Food', shop: 'South Spice Corner', price: 95, rating: 4.4, review: 'Crispy dosa and chutney tasted fresh.' },
  { id: 5, name: 'Idli Sambar Combo', category: 'Prepared Food', shop: 'Morning Tiffin Hub', price: 80, rating: 4.3, review: 'Soft idlis and sambar was neatly packed for delivery.' },
  { id: 6, name: 'Boiled Eggs Plate', category: 'Eggs', shop: 'Protein Bowl Cafe', price: 70, rating: 4.2, review: 'Fresh eggs and clean serving.' },
  { id: 7, name: 'Cheese Omelette', category: 'Eggs', shop: 'Egg Stop Chennai', price: 120, rating: 4.5, review: 'Fluffy omelette with good cheese filling.' },
  { id: 8, name: 'Fresh Fruit Bowl', category: 'Fruits', shop: 'FruitCart Express', price: 160, rating: 4.6, review: 'Fresh cut fruits, chilled and clean.' },
  { id: 9, name: 'Seasonal Fruit Basket', category: 'Fruits', shop: 'Farm Fresh Fruits', price: 260, rating: 4.4, review: 'Good mix of bananas, apples, and oranges.' },
  { id: 10, name: 'Tender Coconut Water', category: 'Fresh Beverage', shop: 'Coconut Bay', price: 65, rating: 4.3, review: 'Natural coconut water served fresh.' }
];

const foodLocations = ['T. Nagar', 'Mylapore', 'Adyar', 'Guindy', 'Velachery', 'Anna Nagar', 'Porur', 'Egmore', 'Tambaram', 'Chromepet'];

function foodProductImage(item, index) {
  const name = svgText(item.name);
  const category = svgText(item.category.toUpperCase());
  const lower = item.name.toLowerCase();
  const palettes = [
    ['#162014', '#34d399', '#facc15'],
    ['#21140c', '#fb923c', '#fef3c7'],
    ['#111827', '#60a5fa', '#f472b6'],
    ['#20140f', '#f59e0b', '#fff7ed']
  ];
  const [bg, accent, light] = palettes[index % palettes.length];
  let art = `<ellipse cx="360" cy="380" rx="190" ry="70" fill="#f8fafc"/><ellipse cx="360" cy="350" rx="155" ry="72" fill="${light}"/><circle cx="310" cy="330" r="18" fill="${accent}"/><circle cx="370" cy="315" r="16" fill="#22c55e"/><circle cx="420" cy="345" r="20" fill="#ef4444"/>`;
  if (lower.includes('egg') || lower.includes('omelette')) {
    art = lower.includes('omelette')
      ? `<ellipse cx="360" cy="360" rx="190" ry="92" fill="#facc15"/><ellipse cx="365" cy="350" rx="120" ry="48" fill="#fde68a"/><circle cx="280" cy="340" r="18" fill="#fff7ed"/><circle cx="452" cy="374" r="16" fill="#fff7ed"/>`
      : `<ellipse cx="360" cy="395" rx="185" ry="64" fill="#f8fafc"/><g>${[270,330,390,450].map((x) => `<ellipse cx="${x}" cy="345" rx="44" ry="58" fill="#fff7ed"/><circle cx="${x}" cy="355" r="18" fill="#facc15"/>`).join('')}</g>`;
  } else if (lower.includes('biryani') || lower.includes('fried rice')) {
    art = `<ellipse cx="360" cy="415" rx="200" ry="58" fill="#d1d5db"/><path d="M190 300h340l-42 120H232z" fill="#f8fafc"/><ellipse cx="360" cy="300" rx="170" ry="75" fill="#f59e0b"/><g fill="#22c55e">${[245,310,390,460].map((x, i) => `<circle cx="${x}" cy="${285 + i * 12}" r="13"/>`).join('')}</g><circle cx="420" cy="290" r="22" fill="#fef3c7"/>`;
  } else if (lower.includes('dosa')) {
    art = `<path d="M180 410c120-175 310-210 435-60-135 75-275 96-435 60z" fill="#f59e0b"/><path d="M240 385c95-92 210-112 312-42" stroke="#fde68a" stroke-width="28" stroke-linecap="round" fill="none"/><circle cx="575" cy="395" r="42" fill="#22c55e"/><circle cx="635" cy="388" r="38" fill="#f8fafc"/>`;
  } else if (lower.includes('idli')) {
    art = `<ellipse cx="360" cy="420" rx="205" ry="52" fill="#d1d5db"/><g fill="#fff7ed">${[265,360,455].map((x) => `<ellipse cx="${x}" cy="350" rx="68" ry="54"/>`).join('')}</g><circle cx="560" cy="360" r="58" fill="#f97316"/><circle cx="635" cy="365" r="42" fill="#22c55e"/>`;
  } else if (lower.includes('fruit')) {
    art = `<ellipse cx="360" cy="405" rx="205" ry="62" fill="#f8fafc"/><g><circle cx="275" cy="340" r="48" fill="#ef4444"/><circle cx="350" cy="315" r="48" fill="#facc15"/><circle cx="420" cy="350" r="46" fill="#fb923c"/><path d="M490 332c42-34 92-18 105 28-42 34-94 18-105-28z" fill="#22c55e"/><path d="M345 270c26-34 58-32 80 0" stroke="#22c55e" stroke-width="14" fill="none" stroke-linecap="round"/></g>`;
  } else if (lower.includes('coconut')) {
    art = `<ellipse cx="360" cy="420" rx="185" ry="58" fill="#d1d5db"/><circle cx="335" cy="340" r="95" fill="#22c55e"/><circle cx="390" cy="345" r="86" fill="#a7f3d0"/><circle cx="390" cy="345" r="48" fill="#f8fafc"/><path d="M455 250c70 10 118 48 140 112" stroke="#34d399" stroke-width="20" fill="none" stroke-linecap="round"/>`;
  } else if (lower.includes('paneer')) {
    art = `<ellipse cx="360" cy="405" rx="190" ry="65" fill="#f8fafc"/><rect x="250" y="275" width="230" height="150" rx="34" fill="#fb923c"/><g fill="#fff7ed">${[290,350,415].map((x, i) => `<rect x="${x}" y="${315 + i * 8}" width="58" height="42" rx="10"/>`).join('')}</g><path d="M515 305h105M510 360h130" stroke="#fde68a" stroke-width="18" stroke-linecap="round"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520"><rect width="720" height="520" rx="42" fill="${bg}"/><circle cx="610" cy="85" r="105" fill="${accent}" opacity=".22"/><circle cx="96" cy="450" r="135" fill="${light}" opacity=".16"/><rect x="56" y="48" width="300" height="54" rx="16" fill="#000" opacity=".36"/><text x="78" y="84" fill="#fff7db" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="900">${category}</text>${art}<rect x="56" y="404" width="560" height="82" rx="18" fill="#000" opacity=".48"/><text x="76" y="450" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="900">${name}</text><text x="76" y="478" fill="${accent}" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800">Fresh delivery item</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const foodBeverageProducts = foodBeverageSeed.map((item, index) => {
  const totalDeliveries = 420 + index * 47;
  const successfulDeliveries = totalDeliveries - (18 + index * 3);
  const deliverySuccessPercentage = Number(((successfulDeliveries / totalDeliveries) * 100).toFixed(1));
  return {
    productId: `FOOD-${String(item.id).padStart(3, '0')}`,
    productName: item.name,
    category: 'Food & Beverages',
    originalCategory: item.category,
    productImage: foodProductImage(item, index),
    price: item.price,
    productRating: item.rating,
    customerReview: item.review,
    shopName: item.shop,
    shopLocation: foodLocations[index],
    successfulDeliveries,
    totalDeliveries,
    deliverySuccessPercentage,
    shopDeliveryRating: Number((deliverySuccessPercentage / 10).toFixed(1)),
    foodReturnMode: true
  };
});

function shopSphereToCatalogProduct(product) {
  const highValue = product.price > 20000;
  const categoryMap = {
    Fashion: 'Dresses / Fashion',
    Electronics: 'Electronics',
    Tools: 'Tools',
    'Food & Beverages': 'Food & Beverages'
  };
  const isFood = product.category === 'Food & Beverages';
  return {
    id: product.productId,
    name: product.productName,
    category: categoryMap[product.category] || product.category,
    displayCategory: product.originalCategory,
    image: product.productImage,
    price: product.price,
    originalPrice: Math.round(product.price * 1.14),
    discount: 12,
    rating: product.productRating,
    reviews: product.customerReview,
    description: `${product.productName} from ${product.shopName}. ${product.customerReview}`,
    specifications: [
      `Shop: ${product.shopName}`,
      `Location: ${product.shopLocation}`,
      `Delivery success: ${product.deliverySuccessPercentage}%`,
      `Shop rating: ${product.shopDeliveryRating}/10`
    ],
    seller: product.shopName,
    stock: 'In stock',
    returnPolicy: isFood ? 'Food and beverage returns require app-only live camera capture, metadata check, motion check, and screen-fake verification.' : (highValue ? 'High-value item: OTP, delivery image, and partner verification required.' : 'Standard return with delivery proof verification.'),
    wardrobingRiskLevel: isFood ? 'high' : (highValue ? 'high' : product.category === 'Fashion' ? 'medium' : 'low'),
    verificationType: isFood ? 'Live camera capture + metadata + motion + screen-fake checks' : (highValue ? 'OTP + delivery image comparison' : 'Delivery image comparison'),
    warehouseLocation: product.shopLocation
  };
}

const shopSphereCatalogProducts = shopSphereProducts.map(shopSphereToCatalogProduct);
const foodBeverageCatalogProducts = foodBeverageProducts.map(shopSphereToCatalogProduct);
const catalogProducts = [...products, ...shopSphereCatalogProducts, ...foodBeverageCatalogProducts];

function findCatalogProduct(productId) {
  return catalogProducts.find((product) => product.id === productId);
}

function isFoodProduct(product = {}) {
  return product.category === 'Food & Beverages' || ['Food', 'Bakery', 'Snacks', 'Dairy', 'Beverage', 'Prepared Food', 'Eggs', 'Fruits', 'Fresh Beverage'].includes(product.displayCategory);
}

function simulateReverseImageLookup(file, preview = '', product = {}) {
  const fileName = (file?.name || '').toLowerCase();
  const suspiciousName = /(google|internet|online|stock|download|screenshot|screen|pinterest|web|image_search|reverse|catalog)/.test(fileName);
  const reusedCatalogImage = Boolean(preview && product?.image && preview === product.image);
  const tinyFile = Number(file?.size || 0) > 0 && Number(file?.size || 0) < 9000;
  const matched = suspiciousName || reusedCatalogImage || tinyFile;
  return {
    checked: true,
    matched,
    confidence: matched ? (reusedCatalogImage ? 98 : suspiciousName ? 91 : 78) : 7,
    source: reusedCatalogImage ? 'Product catalog / online listing image' : suspiciousName ? 'Public web image index simulation' : tinyFile ? 'Compressed reused-image signature' : 'No online match found',
    reason: matched ? 'Reverse image lookup found this proof image online or reused.' : 'Reverse image lookup did not find a public online match.'
  };
}

function simulateBillQrScan(file, order = {}) {
  const bill = getDeliveredBill(order);
  const fileName = (file?.name || '').toLowerCase();
  const editedBill = /(fake|wrong|mismatch|edited|invalid|tamper|other-order|old-bill)/.test(fileName);
  const uploadedBillLooksValid = /(bill|invoice|receipt|qr|order)/.test(fileName) || file?.type?.includes('pdf') || file?.type?.startsWith('image/');
  const extractedValue = editedBill ? `QR-MISMATCH-${order.id || Date.now()}` : bill.billQrValue;
  return {
    checked: true,
    matched: uploadedBillLooksValid && extractedValue === bill.billQrValue,
    extractedValue,
    storedValue: bill.billQrValue,
    message: uploadedBillLooksValid && extractedValue === bill.billQrValue
      ? 'QR extracted from uploaded bill matched the stored order bill QR.'
      : 'QR extracted from uploaded bill does not match the stored order bill QR.'
  };
}

function reverseImageRejectResult(lookup) {
  return {
    score: 100,
    level: 'High',
    decision: 'Reject / Investigate',
    tone: 'danger',
    fraudTypes: ['Reverse Image Match Fraud'],
    fraudTypeText: 'Reverse Image Match Fraud',
    triggeredConditions: [lookup?.reason || 'Uploaded proof image matched an online image source'],
    signals: [{ points: 100, label: lookup?.reason || 'Uploaded proof image matched an online image source', fraudType: 'Reverse Image Match Fraud' }],
    explanation: `Return rejected automatically because reverse image lookup matched the proof image with an online/reused source. Match confidence: ${lookup?.confidence || 100}%.`
  };
}

function compactImageData(value, maxLength = 420000) {
  return typeof value === 'string' && value.length <= maxLength ? value : '';
}

function isDeliveredOrder(order = {}) {
  return (
    order.status === 'Delivered' ||
    order.status === 'Returned' ||
    order.deliveryStatus === 'Delivered' ||
    order.deliveryCompleted === true ||
    Boolean(order.deliveryProof?.completed && order.deliveryProof?.otpVerified) ||
    Boolean(order.deliveryProof?.otpVerified && order.deliveryProof?.deliveryPhoto && order.deliveryProof?.packagePhoto)
  );
}

function buildDeliveredOrder(item, { deliveredAt = nowStamp(), form = {}, product = {}, completionReason = 'OTP verified by delivery partner' } = {}) {
  const bill = getDeliveredBill({ ...item, deliveredAt });
  const existingProof = item.deliveryProof || {};
  return {
    ...item,
    ...bill,
    status: 'Delivered',
    deliveryStatus: 'Delivered',
    deliveryCompleted: true,
    deliveredAt: item.deliveredAt || deliveredAt,
    statusUpdatedAt: deliveredAt,
    completedBy: 'ZippGo delivery partner',
    deliveryProof: {
      ...existingProof,
      deliveryPhoto: form.deliveryPhotoPreview || existingProof.deliveryPhoto || product.image || '',
      packagePhoto: form.deliveryPhotoPreview || existingProof.packagePhoto || existingProof.deliveryPhoto || product.image || '',
      serialPhoto: form.serialPreview || existingProof.serialPhoto || '',
      workingVideo: form.workingVideoPreview || existingProof.workingVideo || '',
      billQrValue: bill.billQrValue,
      billQrImage: bill.billQrImage,
      otpVerified: true,
      completed: true,
      timestamp: existingProof.timestamp || deliveredAt,
      completionReason,
      checks: { ...(existingProof.checks || {}), ...form, otpVerified: true }
    }
  };
}

function saveDeliveredOrder(orderId, { deliveredAt = nowStamp(), form = {}, product = {}, completionReason = 'All delivery checks completed' } = {}) {
  const storedOrders = readStore(ORDERS_KEY, []);
  const currentOrders = Array.isArray(storedOrders) ? storedOrders : [];
  let deliveredOrder = null;
  const updatedOrders = currentOrders.map((item) => {
    if (item.id !== orderId) return item;
    deliveredOrder = buildDeliveredOrder(item, { deliveredAt, form, product, completionReason });
    return deliveredOrder;
  });
  if (!deliveredOrder) return null;
  try {
    writeStore(ORDERS_KEY, updatedOrders);
  } catch {
    const compactOrders = updatedOrders.map((order) => ({
      ...order,
      billQrImage: '',
      deliveryProof: order.id === orderId ? {
        otpVerified: true,
        completed: true,
        timestamp: deliveredAt,
        deliveryPhoto: product.image || '',
        packagePhoto: product.image || '',
        completionReason
      } : order.deliveryProof
    }));
    writeStore(ORDERS_KEY, compactOrders);
    deliveredOrder = compactOrders.find((order) => order.id === orderId);
    window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: compactOrders } }));
    window.dispatchEvent(new CustomEvent('devx-delivery-completed', { detail: { orderId, deliveredAt, order: deliveredOrder } }));
    return { updatedOrders: compactOrders, deliveredOrder };
  }
  window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
  window.dispatchEvent(new CustomEvent('devx-delivery-completed', { detail: { orderId, deliveredAt, order: deliveredOrder } }));
  return { updatedOrders, deliveredOrder };
}

function savePlacedOrders(newOrders = []) {
  if (!newOrders.length) return [];
  const storedOrders = readStore(ORDERS_KEY, []);
  const currentOrders = Array.isArray(storedOrders) ? storedOrders : [];
  const updatedOrders = [...currentOrders, ...newOrders];
  try {
    writeStore(ORDERS_KEY, updatedOrders);
  } catch {
    const compactOrders = updatedOrders.map((order) => ({
      ...order,
      billQrImage: '',
      deliveryProof: order.deliveryProof ? {
        ...order.deliveryProof,
        deliveryPhoto: '',
        packagePhoto: '',
        serialPhoto: '',
        workingVideo: ''
      } : order.deliveryProof
    }));
    writeStore(ORDERS_KEY, compactOrders);
    window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: compactOrders } }));
    return compactOrders;
  }
  window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
  return updatedOrders;
}

function saveAdminConfirmedOrder(orderId) {
  const currentOrders = readStore(ORDERS_KEY, []);
  let confirmedOrder = null;
  const updatedOrders = currentOrders.map((order) => {
    if (order.id !== orderId) return order;
    confirmedOrder = {
      ...order,
      deliveryOtp: order.deliveryOtp || generateOtp(),
      status: 'Waiting for delivery partner',
      adminConfirmedAt: nowStamp()
    };
    return confirmedOrder;
  });
  if (!confirmedOrder) return null;
  writeStore(ORDERS_KEY, updatedOrders);
  window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
  return { updatedOrders, confirmedOrder };
}

function getStoredDeliveryPhoto(order = {}, product = {}) {
  const storedOrders = readStore(ORDERS_KEY, []);
  const storedOrder = Array.isArray(storedOrders) ? storedOrders.find((item) => item.id === order.id) : null;
  return storedOrder?.deliveryProof?.deliveryPhoto || order.deliveryProof?.deliveryPhoto || '';
}

function orderDisplayStatus(order = {}) {
  return isDeliveredOrder(order) ? 'Delivered' : order.status;
}

function formatShortInr(value = 0) {
  const amount = Math.max(0, Math.round(value));
  if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(amount >= 1000000 ? 1 : 2).replace(/\.0$/, '')}L`;
  if (amount >= 1000) return `Rs. ${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `Rs. ${amount.toLocaleString('en-IN')}`;
}

function buildLiveRiskSurveyMetrics(users = [], orders = [], returns = []) {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const productPrice = (productId) => findCatalogProduct(productId)?.price || 0;
  const proofOrders = orders.filter((order) => order.deliveryProof?.deliveryPhoto && order.deliveryProof?.packagePhoto && order.deliveryProof?.otpVerified);
  const protectedOrderIds = new Set(proofOrders.map((order) => order.id));
  returns.forEach((item) => {
    const score = Number(item.result?.score || 0);
    if (item.partnerDecision === 'Cancelled' || score > 30 || item.result?.decision === 'Manual Review' || item.result?.decision === 'Reject / Investigate') {
      protectedOrderIds.add(item.orderId);
    }
  });
  const valueProtected = [...protectedOrderIds].reduce((total, orderId) => {
    const order = orderById.get(orderId);
    return total + productPrice(order?.productId);
  }, 0);

  const pendingReview = returns.filter((item) =>
    item.result?.pending ||
    item.status === 'Partner visit requested' ||
    item.result?.decision === 'Manual Review'
  ).length;
  const proofPercent = orders.length ? Math.round((proofOrders.length / orders.length) * 100) : 0;

  const customerRisk = new Map();
  users.forEach((user) => customerRisk.set(user.id, {
    label: user.name || user.phone || user.id,
    score: Number(user.risk || 0)
  }));
  orders.forEach((order) => {
    const key = order.userId || order.phone || order.customer || order.id;
    if (!customerRisk.has(key)) {
      customerRisk.set(key, { label: order.customer || order.phone || 'Customer', score: 0 });
    }
  });
  returns.forEach((item) => {
    const order = orderById.get(item.orderId);
    const key = order?.userId || order?.phone || item.customer || item.id;
    const current = customerRisk.get(key) || { label: item.customer || 'Customer', score: 0 };
    const score = Number(item.result?.score || 0);
    customerRisk.set(key, { ...current, score: Math.max(current.score, score) });
  });

  const totalCustomers = customerRisk.size;
  const distribution = [
    { key: 'low', label: 'Low Risk', range: '0-39', count: 0, color: '#20c997' },
    { key: 'medium', label: 'Medium Risk', range: '40-79', count: 0, color: '#f59e0b' },
    { key: 'high', label: 'High Risk', range: '80-100', count: 0, color: '#ff4757' }
  ];
  [...customerRisk.values()].forEach((customer) => {
    if (customer.score >= 80) distribution[2].count += 1;
    else if (customer.score >= 40) distribution[1].count += 1;
    else distribution[0].count += 1;
  });
  distribution.forEach((row) => {
    row.percent = totalCustomers ? Math.round((row.count / totalCustomers) * 100) : 0;
  });

  const alerts = returns
    .filter((item) => !item.result?.pending && Number(item.result?.score || 0) >= 70)
    .sort((a, b) => Number(b.result?.score || 0) - Number(a.result?.score || 0))
    .slice(0, 3)
    .map((item) => ({
      label: item.result?.fraudTypes?.[0] || item.result?.fraudTypeText || 'High-risk return',
      score: Number(item.result?.score || 0),
      customer: item.customer,
      value: productPrice(item.productId)
    }));

  return {
    valueProtected,
    totalReturns: returns.length,
    pendingReview,
    proofPercent,
    proofComplete: proofOrders.length,
    proofTotal: orders.length,
    totalCustomers,
    distribution,
    alerts
  };
}

function addProductToCart(cart, setCart, productId) {
  const exists = cart.some((item) => item.productId === productId);
  setCart(exists ? cart.map((item) => item.productId === productId ? { ...item, qty: (item.qty || 1) + 1 } : item) : [...cart, { productId, qty: 1 }]);
}

function getCheckoutProducts(cart = [], { allowPendingBuy = true } = {}) {
  const safeCart = Array.isArray(cart) ? cart : [];
  const cartProducts = safeCart.flatMap((item) => {
    const product = findCatalogProduct(item.productId);
    if (!product) return [];
    return Array.from({ length: Math.max(1, item.qty || 1) }, () => product);
  });
  if (cartProducts.length) return cartProducts;
  if (!allowPendingBuy) return [];
  const pendingBuy = readStore(SHOPSPHERE_BUY_KEY, null);
  const pendingProduct = pendingBuy?.productId ? findCatalogProduct(pendingBuy.productId) : null;
  return pendingProduct ? [pendingProduct] : [];
}

function clearLegacyDemoData() {
  if (localStorage.getItem(RESET_KEY)) return;
  [
    'trustkart_cart',
    'trustkart_orders',
    'trustkart_user',
    'trustkart_location',
    'trustkart_returns',
    'devx_v2_cart',
    'devx_v2_wishlist',
    'devx_v2_orders',
    'devx_v2_returns',
    'devx_v2_users',
    'devx_v2_active_user',
    'devx_v2_admin_auth',
    'devx_v2_location'
  ].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(RESET_KEY, 'true');
}

function clearPreviousOrdersAndReturnsOnce() {
  if (localStorage.getItem(ORDERS_RETURNS_RESET_KEY)) return;
  [
    ORDERS_KEY,
    RETURNS_KEY,
    SHOPSPHERE_BUY_KEY,
    'trustkart_orders',
    'trustkart_returns',
    'devx_v2_orders',
    'devx_v2_returns',
    'devx_v2_shopsphere_buy'
  ].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(ORDERS_RETURNS_RESET_KEY, 'true');
}

function ToastHost() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const show = (event) => {
      setMessage(event.detail);
      window.clearTimeout(show.timer);
      show.timer = window.setTimeout(() => setMessage(''), 1800);
    };
    window.addEventListener('devx-toast', show);
    return () => window.removeEventListener('devx-toast', show);
  }, []);

  return message ? <div className="toast">{message}</div> : null;
}

function ThemeSelector() {
  const [theme, setTheme] = useThemePreference();
  return (
    <label className="theme-picker" title="Theme">
      <span>Theme</span>
      <select value={theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
  );
}

function ProfileMenu({ user, setUser }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const name = user?.name || 'Guest';
  const close = () => setOpen(false);
  const logout = () => {
    setUser(null);
    close();
    notify('Logged out');
    navigate('/user/login');
  };
  return (
    <div className="profile-menu-wrap">
      <button type="button" className="profile-chip profile-trigger" onClick={() => setOpen(!open)}>
        {user ? <span className="avatar">{name[0]?.toUpperCase() || 'U'}</span> : <User size={28} />}
        <span>{user ? name : 'Login'}</span>
      </button>
      {open && (
        <section className="profile-menu">
          <div className="profile-menu-head">
            <span className="avatar large">{name[0]?.toUpperCase() || 'U'}</span>
            <div>
              <strong>{name}</strong>
              <small>{user?.phone || user?.email || 'Sign in to manage account'}</small>
            </div>
          </div>
          <ThemeSelector />
          {user ? (
            <>
              <Link to="/user/profile" onClick={close}>View and edit profile</Link>
              <Link to="/user/orders" onClick={close}>My orders</Link>
              <button type="button" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/user/login" onClick={close}>Login</Link>
              <Link to="/user/signup" onClick={close}>Create account</Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Brand({ small = false }) {
  return (
    <Link to="/" className={small ? 'brand small-brand' : 'brand'}>
      <img className="brand-logo" src="/assets/zippgo-logo.png" alt="ZippGo logo" />
      <span>ZippGo</span>
      <b>devX</b>
    </Link>
  );
}

function PortalShell({ type = 'user', children }) {
  const [cart] = useLocalState(CART_KEY, []);
  const [wish] = useLocalState(WISH_KEY, []);
  const [user, setUser] = useLocalState(ACTIVE_USER_KEY, null);
  const location = useLocation();
  const navItems = {
    user: [
      { to: '/user', label: 'Home', icon: ShoppingBag, exact: true },
      { to: '/shopsphere', label: 'Shop', icon: ShoppingCart },
      { to: '/user/orders', label: 'Orders', icon: Package },
      { to: '/user/returns', label: 'Return Center', icon: ShieldCheck },
      { to: '/wardrobing-policy', label: 'Wardrobing Policy', icon: AlertTriangle },
      { to: '/seller-register', label: 'Join as seller', icon: PackageCheck }
    ],
    admin: [
      { to: '/admin', label: 'Dashboard', icon: BarChart3 },
      { to: '/seller-integrity', label: 'Seller Integrity', icon: AlertTriangle },
      { to: '/wardrobing-policy', label: 'Policy Engine', icon: ShieldCheck },
      { to: '/seller-register', label: 'Seller Join', icon: PackageCheck },
      { to: '/', label: 'Portals', icon: LogOut, exact: true }
    ],
    delivery: [
      { to: '/delivery', label: 'Delivery', icon: Truck, exact: true },
      { to: '/delivery/returns', label: 'Return Pickup', icon: PackageCheck },
      { to: '/wardrobing-policy', label: 'Pickup Checklist', icon: ShieldCheck },
      { to: '/', label: 'Portals', icon: LogOut, exact: true }
    ]
  };
  const portalMeta = {
    user: { search: 'Search products, orders, returns...', agent: 'Shopping Agent', role: 'Customer protection' },
    admin: { search: 'Search orders, customers, return IDs...', agent: 'System Agent', role: 'Fraud analyst' },
    delivery: { search: 'Search delivery tasks and return pickups...', agent: 'ZippGo Agent', role: 'Proof collector' }
  };
  const active = (item) => item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  return (
    <div className={`app-shell ${type}-shell`}>
      <aside className="side-nav">
        <Brand small />
        <nav>
          {navItems[type].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={active(item) ? 'active' : ''}>
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side-agent">
          <span>DX</span>
          <div>
            <strong>{portalMeta[type].agent}</strong>
            <small>{portalMeta[type].role}</small>
          </div>
        </div>
      </aside>
      <section className="app-workspace">
        <header className="topbar">
          <Link to={type === 'user' ? '/shopsphere' : type === 'delivery' ? '/delivery' : '/admin'} className="nav-search">
            <Search size={19} />
            <span>{portalMeta[type].search}</span>
          </Link>
          <div className="top-actions">
            {type === 'user' && <>
              <Link to="/user/wishlist" className="icon-link"><Heart size={18} /><span>{wish.length}</span></Link>
              <Link to="/user/cart" className="icon-link"><ShoppingCart size={18} /><span>{cart.length}</span></Link>
            </>}
            {type !== 'user' && <ThemeSelector />}
            {type === 'user' && <ProfileMenu user={user} setUser={setUser} />}
          </div>
        </header>
        <div className="page-swap">{children}</div>
      </section>
      <ToastHost />
    </div>
  );
}

function LandingPage() {
  const [users] = useLocalState(USERS_KEY, []);
  const [orders] = useLocalState(ORDERS_KEY, []);
  const [returns, setReturns] = useLocalState(RETURNS_KEY, []);
  const riskSurvey = useMemo(() => buildLiveRiskSurveyMetrics(users, orders, returns), [users, orders, returns]);
  const roleCards = [
    { to: '/user', icon: ShoppingBag, tone: 'commerce', title: 'User commerce', text: 'Shop products, track admin approval, receive OTP delivery, and request returns only after delivery.' },
    { to: '/seller-register', icon: PackageCheck, tone: 'seller', title: 'Seller onboarding', text: 'Shops register with GST, pickup address, category, and onboarding verification before selling.' },
    { to: '/admin-login', icon: Lock, tone: 'admin', title: 'Admin control', text: 'Confirm orders, watch user risk, return cases, fraud type signals, and delivery status.' },
    { to: '/delivery', icon: Truck, tone: 'delivery', title: 'ZippGo partner', text: 'Send and verify OTP, capture proof, inspect return condition, and check product colour and condition.' }
  ];
  return (
    <main className="portal-landing">
      <div className="landing-toolbar">
        <Brand />
        <ThemeSelector />
      </div>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">Return fraud prevention prototype</span>
          <h1>ZippGo devX</h1>
          <p>Premium commerce with admin approval, OTP delivery proof, partner return verification, photo checks, and automatic fraud type detection.</p>
          <div className="hero-actions">
            <Link className="primary" to="/user"><ShoppingBag size={18} /> Enter user site</Link>
            <Link className="secondary" to="/seller-register"><PackageCheck size={18} /> Join as seller</Link>
            <Link className="secondary" to="/admin-login"><Lock size={18} /> Admin console</Link>
            <Link className="secondary" to="/delivery"><Truck size={18} /> Delivery portal</Link>
          </div>
        </div>
        <div className="proof-orbit dashboard-preview">
          <div className="preview-top">
            <span><Search size={17} /> Search orders, customers, return IDs...</span>
            <strong>Live risk survey</strong>
          </div>
          <div className="preview-metrics">
            <article><span>Value Protected</span><strong>{formatShortInr(riskSurvey.valueProtected)}</strong><small>{riskSurvey.proofComplete} verified order proof{riskSurvey.proofComplete === 1 ? '' : 's'}</small></article>
            <article><span>Total Returns</span><strong>{riskSurvey.totalReturns}</strong><small>{riskSurvey.pendingReview} pending review</small></article>
            <article><span>Proof Checks</span><strong>{riskSurvey.proofPercent}%</strong><small>{riskSurvey.proofComplete}/{riskSurvey.proofTotal} orders secured</small></article>
          </div>
          <div className="preview-bottom">
            <article className="preview-donut">
              <CustomerRiskChart metrics={riskSurvey} />
            </article>
            <article className="preview-alerts">
              <h3>High-Risk Alerts</h3>
              {riskSurvey.alerts.length ? riskSurvey.alerts.map((alert) => (
                <div key={`${alert.label}-${alert.customer}-${alert.score}`}>
                  <AlertTriangle size={18} />
                  <span>{alert.label}<small>{alert.customer || 'Customer'} · {formatShortInr(alert.value)}</small></span>
                  <strong>{alert.score}</strong>
                </div>
              )) : (
                <div className="safe-alert"><CheckCircle2 size={18} /><span>No live high-risk return alerts yet</span><strong>0</strong></div>
              )}
            </article>
          </div>
        </div>
      </section>
      <section className="role-grid">
        {roleCards.map(({ to, icon: Icon, tone, title, text }) => (
          <Link to={to} className={`role-card ${tone}`} key={title}>
            <Icon size={28} />
            <h2>{title}</h2>
            <p>{text}</p>
          </Link>
        ))}
      </section>
      <section className="flow-strip">
        {['Order placed', 'Admin confirms', 'OTP delivery', 'Return request', 'Partner checks', 'Fraud type result'].map((step, index) => (
          <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>
        ))}
      </section>
    </main>
  );
}

function CustomerRiskChart({ metrics }) {
  const rows = metrics.distribution;
  let offset = 0;
  return (
    <>
      <div className="chart-head">
        <div>
          <h3>Total Customer Risk Distribution</h3>
          <span>Hover chart or rows to inspect customer risk groups.</span>
        </div>
        <strong>{metrics.totalCustomers}</strong>
      </div>
      <div className="customer-chart">
        <svg viewBox="0 0 120 120" role="img" aria-label="Total customer risk distribution">
          <circle className="chart-track" cx="60" cy="60" r="42" />
          {rows.map((row) => {
            const segment = (
              <circle
                key={row.key}
                className={`risk-segment ${row.key}`}
                cx="60"
                cy="60"
                r="42"
                pathLength="100"
                stroke={row.color}
                strokeDasharray={`${row.percent} ${100 - row.percent}`}
                strokeDashoffset={-offset}
              >
                <title>{`${row.label}: ${row.count} customer${row.count === 1 ? '' : 's'} (${row.percent}%), score ${row.range}`}</title>
              </circle>
            );
            offset += row.percent;
            return segment;
          })}
          <text x="60" y="56" textAnchor="middle">Total</text>
          <text x="60" y="72" textAnchor="middle">{metrics.totalCustomers}</text>
        </svg>
        <div className="customer-chart-legend">
          {rows.map((row) => (
            <div className={`customer-risk-row ${row.key}`} key={row.key} data-tip={`${row.count} customer${row.count === 1 ? '' : 's'} scored ${row.range}. ${row.percent}% of actual registered/order customers.`}>
              <i style={{ background: row.color }} />
              <span>{row.label} ({row.range})</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LocationSelector({ value, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const mapSuggestions = useMemo(() => [
    ...chennaiLocations,
    'Ramapuram',
    'Saidapet',
    'Besant Nagar',
    'Perungudi',
    'Sholinganallur',
    'Kodambakkam',
    'Ashok Nagar',
    'Vadapalani',
    'Pallavaram',
    'Kilpauk'
  ], []);
  const filtered = mapSuggestions
    .filter((location) => location.toLowerCase().includes((value || '').toLowerCase()))
    .slice(0, 6);
  return (
    <div className={compact ? 'select compact map-input' : 'select map-input'}>
      <MapPin size={17} />
      <input
        value={value || ''}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 130)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder="Enter Chennai location"
      />
      {open && filtered.length > 0 && (
        <div className="map-suggestions">
          {filtered.map((location) => (
            <button type="button" key={location} onMouseDown={() => onChange(location)}>
              <MapPin size={14} />
              <span>{location}, Chennai</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, location, onAdd, onWish, onBuy }) {
  return (
    <article className="product-card store-card">
      <Link to={`/user/product/${product.id}`} className="product-image-wrap">
        <img src={product.image} alt={product.name} />
        <span className="discount">{product.discount}% off</span>
      </Link>
      <div className="product-body">
        <div className="card-top"><span>{normalizeCategory(product.category)}</span><span className={`risk ${product.wardrobingRiskLevel}`}>{product.wardrobingRiskLevel}</span></div>
        <Link to={`/user/product/${product.id}`} className="product-name">{product.name}</Link>
        <div className="rating"><Star size={16} fill="currentColor" /> {product.rating} <span>({product.reviews})</span></div>
        <div className="price-row"><strong>{money(product.price)}</strong><del>{money(product.originalPrice)}</del></div>
        <div className="delivery-chip"><Truck size={15} /> Delivery in {getDeliveryEstimate(location, product.warehouseLocation)}</div>
        <div className="mini-actions">
          <button className="secondary small" onClick={() => onWish(product)}><Heart size={15} /> Wishlist</button>
          <button className="secondary small" onClick={() => onAdd(product)}><ShoppingCart size={15} /> Cart</button>
          <button className="primary small" onClick={() => onBuy(product)}>Buy</button>
        </div>
      </div>
    </article>
  );
}

function UserHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useLocalState(LOCATION_KEY, 'Guindy');
  const [cart, setCart] = useLocalState(CART_KEY, []);
  const [wish, setWish] = useLocalState(WISH_KEY, []);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toast, setToast] = useState('');
  const featured = [...shopSphereProducts.slice(0, 3), ...foodBeverageProducts.slice(0, 3)];
  const addCart = (product) => {
    addProductToCart(cart, setCart, product.productId);
    setToast(`${product.productName} added to cart`);
    window.clearTimeout(addCart.timer);
    addCart.timer = window.setTimeout(() => setToast(''), 1800);
  };
  const buyNow = (product) => {
    setCart([{ productId: product.productId, qty: 1 }]);
    writeStore(SHOPSPHERE_BUY_KEY, { productId: product.productId, productName: product.productName, shopName: product.shopName, price: product.price, startedAt: nowStamp() });
    notify(`Buying ${product.productName}`);
    navigate('/user/checkout');
  };
  const addWish = (product) => {
    setWish(wish.some((item) => item.productId === product.productId) ? wish : [...wish, { productId: product.productId }]);
    setToast(`${product.productName} added to wishlist`);
    window.clearTimeout(addWish.timer);
    addWish.timer = window.setTimeout(() => setToast(''), 1800);
  };
  const searchShopSphere = () => {
    navigate(query.trim() ? `/shopsphere?search=${encodeURIComponent(query.trim())}` : '/shopsphere');
  };
  return (
    <PortalShell type="user">
      <main>
        <section className="store-hero">
          <div>
            <span className="eyebrow">ZippGo devX</span>
            <h1>Shop verified products in Chennai</h1>
            <p>Delivery estimates are calculated from the selected Chennai location. Returns use product-specific proof rules.</p>
          </div>
          <LocationSelector value={location} onChange={setLocation} />
        </section>
        <section className="quick-actions">
          <Link to="/shopsphere"><Search size={20} /><strong>ShopSphere</strong><span>Shop verified sellers</span></Link>
          <Link to="/user/orders"><Package size={20} /><strong>Track orders</strong><span>Admin and delivery status</span></Link>
          <Link to="/user/returns"><ShieldCheck size={20} /><strong>Return center</strong><span>Pickup verification flow</span></Link>
          <Link to="/wardrobing-policy"><AlertTriangle size={20} /><strong>Wardrobing rules</strong><span>Smart policy engine</span></Link>
          <Link to="/seller-register"><PackageCheck size={20} /><strong>Join as seller</strong><span>Register shop profile</span></Link>
        </section>
        <section className="amazon-search">
          <Search size={22} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search oven, dress, laptop, camera, watch..." autoFocus />
          <button className="primary" onClick={searchShopSphere}>Search</button>
        </section>
        <section className="section-head"><h2>Featured from ShopSphere</h2><Link to="/shopsphere">View shop products</Link></section>
        <ShopSphereProductGrid products={featured} onAdd={addCart} onBuy={buyNow} onWish={addWish} onView={setSelectedProduct} />
        {selectedProduct && <ShopSphereProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addCart} onBuy={buyNow} onWish={addWish} />}
        <ShopSphereToastNotification message={toast} />
      </main>
    </PortalShell>
  );
}

function ProductGrid({ items, location, onAdd, onWish, onBuy }) {
  return <div className="product-grid">{items.map((product) => <ProductCard key={product.id} product={product} location={location} onAdd={onAdd} onWish={onWish} onBuy={onBuy} />)}</div>;
}

function UserProducts() {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(params.get('category') || 'All');
  const [location, setLocation] = useLocalState(LOCATION_KEY, 'Guindy');
  const [cart, setCart] = useLocalState(CART_KEY, []);
  const [wish, setWish] = useLocalState(WISH_KEY, []);
  const navigate = useNavigate();
  const filtered = products.filter((product) => {
    const categoryMatch = category === 'All' || normalizeCategory(product.category) === category;
    const queryMatch = `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch;
  });
  return (
    <PortalShell type="user">
      <main>
        <section className="toolbar">
          <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" /></div>
          <LocationSelector value={location} onChange={setLocation} compact />
        </section>
        <section className="filters">{categories.map((item) => <button className={item === category ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</section>
        <ProductGrid
          items={filtered}
          location={location}
          onAdd={(product) => {
            setCart([...cart, { productId: product.id, qty: 1 }]);
            notify(`${product.name} added to cart`);
          }}
          onWish={(product) => {
            setWish(wish.some((item) => item.productId === product.id) ? wish : [...wish, { productId: product.id }]);
            notify(`${product.name} added to wishlist`);
          }}
          onBuy={(product) => {
            setCart([{ productId: product.id, qty: 1 }]);
            notify(`Buying ${product.name}`);
            navigate('/user/checkout');
          }}
        />
      </main>
    </PortalShell>
  );
}

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useLocalState(LOCATION_KEY, 'Guindy');
  const [cart, setCart] = useLocalState(CART_KEY, []);
  const [wish, setWish] = useLocalState(WISH_KEY, []);
  const product = findCatalogProduct(id);
  if (!product) return <Navigate to="/user/products" />;
  const policy = getWardrobingPolicy(product);
  return (
    <PortalShell type="user">
      <main className="detail-page">
        <img className="detail-image" src={product.image} alt={product.name} />
        <section className="detail-info">
          <span className="eyebrow">{normalizeCategory(product.category)}</span>
          <h1>{product.name}</h1>
          <div className="rating"><Star size={18} fill="currentColor" /> {product.rating} rating from {product.reviews} reviews</div>
          <div className="big-price">{money(product.price)} <del>{money(product.originalPrice)}</del> <span>{product.discount}% off</span></div>
          <p>{product.description}</p>
          <div className="proof-strip">
            <span><ShieldCheck size={17} /> {product.verificationType}</span>
            <span><Truck size={17} /> Delivery in {getDeliveryEstimate(location, product.warehouseLocation)}</span>
            <span>{product.returnPolicy}</span>
          </div>
          <section className="policy-card">
            <h2>Wardrobing return policy</h2>
            <div className="policy-pill-row">
              <span>{policy.risk} risk</span>
              <span>{policy.window}</span>
              <span>{policy.rental ? 'Rental option suggested' : 'Purchase return policy'}</span>
            </div>
            <p>{policy.solution}</p>
            <strong>Required proof: {policy.proof}</strong>
            {policy.rental && <button className="ghost small" onClick={() => notify('Rental option opened for short-term use')}>Need it short-term? Rent instead</button>}
          </section>
          <LocationSelector value={location} onChange={setLocation} />
          <div className="spec-grid">{product.specifications.map((spec) => <span key={spec}>{spec}</span>)}</div>
          <div className="button-row">
            <button className="secondary" onClick={() => { setWish([...wish, { productId: product.id }]); notify(`${product.name} added to wishlist`); }}><Heart size={18} /> Add wishlist</button>
            <button className="secondary" onClick={() => { setCart([...cart, { productId: product.id, qty: 1 }]); notify(`${product.name} added to cart`); }}><ShoppingCart size={18} /> Add to cart</button>
            <button className="primary" onClick={() => { setCart([{ productId: product.id, qty: 1 }]); notify(`Buying ${product.name}`); navigate('/user/checkout'); }}><CreditCard size={18} /> Buy now</button>
          </div>
        </section>
      </main>
    </PortalShell>
  );
}

function UserLogin() {
  const navigate = useNavigate();
  const [users] = useLocalState(USERS_KEY, []);
  const [active, setActive] = useLocalState(ACTIVE_USER_KEY, null);
  const [, setLocation] = useLocalState(LOCATION_KEY, 'Guindy');
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  if (active) return <Navigate to="/user/profile" />;
  const submit = () => {
    const phone = form.phone.replace(/\D/g, '');
    const user = users.find((item) => item.phone.replace(/\D/g, '') === phone && item.password === form.password);
    if (!user) {
      setError('Invalid phone number or password.');
      return;
    }
    setActive(user);
    setLocation(user.location || 'Guindy');
    notify(`Welcome back, ${user.name}`);
    navigate('/user');
  };
  return (
    <PortalShell type="user">
      <main className="auth-page">
        <section className="form-card">
          <h1>Login</h1>
          <input type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="password" placeholder="Strong password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <div className="alert"><Lock size={18} /> {error}</div>}
          <button className="primary" disabled={form.phone.replace(/\D/g, '').length < 10 || form.password.length < 8} onClick={submit}>Login</button>
          <div className="auth-switch">New to ZippGo? <Link to="/user/signup">Create account</Link></div>
        </section>
      </main>
    </PortalShell>
  );
}

function UserSignup() {
  const navigate = useNavigate();
  const [users, setUsers] = useLocalState(USERS_KEY, []);
  const [active, setActive] = useLocalState(ACTIVE_USER_KEY, null);
  const [, setLocation] = useLocalState(LOCATION_KEY, 'Guindy');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', address: '', location: 'Guindy' });
  const [error, setError] = useState('');
  if (active) return <Navigate to="/user/profile" />;
  const submit = () => {
    const phone = form.phone.replace(/\D/g, '');
    if (users.some((user) => user.phone.replace(/\D/g, '') === phone)) {
      setError('An account already exists with this phone number.');
      return;
    }
    const user = { id: `USR-${Date.now()}`, risk: 0, status: 'good', ...form, phone };
    setUsers([...users, user]);
    setActive(user);
    setLocation(user.location || 'Guindy');
    notify('Account created successfully');
    navigate('/user');
  };
  return (
    <PortalShell type="user">
      <main className="auth-page">
        <section className="form-card">
          <h1>Sign up</h1>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Gmail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <LocationSelector value={form.location} onChange={(location) => setForm({ ...form, location })} />
          <input type="password" placeholder="Strong password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <div className="alert"><Lock size={18} /> {error}</div>}
          <button className="primary" disabled={!form.name || form.phone.replace(/\D/g, '').length < 10 || form.password.length < 8} onClick={submit}>Create account</button>
          <div className="auth-switch">Already have an account? <Link to="/user/login">Login</Link></div>
        </section>
      </main>
    </PortalShell>
  );
}

function UserProfile() {
  const navigate = useNavigate();
  const [active, setActive] = useLocalState(ACTIVE_USER_KEY, null);
  const [users, setUsers] = useLocalState(USERS_KEY, []);
  const [, setLocation] = useLocalState(LOCATION_KEY, active?.location || 'Guindy');
  const [form, setForm] = useState(active || { name: '', phone: '', email: '', address: '', location: 'Guindy' });
  if (!active) return <Navigate to="/user/login" />;
  const save = () => {
    const updated = { ...active, ...form };
    setActive(updated);
    setUsers(users.map((user) => user.id === active.id ? updated : user));
    setLocation(updated.location || 'Guindy');
    notify('Profile updated. Shopping location changed.');
    navigate('/user');
  };
  const logout = () => {
    setActive(null);
    navigate('/user');
  };
  return (
    <PortalShell type="user">
      <main className="auth-page">
        <section className="form-card">
          <div className="profile-top"><span className="avatar large">{form.name?.[0]?.toUpperCase() || 'U'}</span><h1>Profile</h1></div>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Gmail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <LocationSelector value={form.location} onChange={(location) => setForm({ ...form, location })} />
          <div className="button-row">
            <button className="primary" onClick={save}>Save profile</button>
            <button className="ghost" onClick={logout}>Logout</button>
          </div>
        </section>
      </main>
    </PortalShell>
  );
}

function CartPage({ wishlist = false }) {
  const navigate = useNavigate();
  const [cart, setCart] = useLocalState(wishlist ? WISH_KEY : CART_KEY, []);
  const items = getCheckoutProducts(cart, { allowPendingBuy: false });
  return (
    <PortalShell type="user">
      <main>
        <section className="section-head"><h1>{wishlist ? 'Wishlist' : 'Cart'}</h1><span>{items.length} products</span></section>
        <section className="stack">
          {items.map((product, index) => <article className="line-card" key={`${product.id}-${index}`}><img src={product.image} alt={product.name} /><div><h3>{product.name}</h3><p>{product.returnPolicy}</p><strong>{money(product.price)}</strong></div><button className="ghost" onClick={() => setCart(cart.filter((_, i) => i !== index))}>Remove</button></article>)}
        </section>
        {!wishlist && <aside className="summary cart-summary"><strong>{money(items.reduce((sum, product) => sum + product.price, 0))}</strong><button className="primary" disabled={!items.length} onClick={() => navigate('/user/checkout')}>Checkout</button></aside>}
      </main>
    </PortalShell>
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const placingRef = useRef(false);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  const [cart, setCart] = useLocalState(CART_KEY, []);
  const [orders, setOrders] = useLocalState(ORDERS_KEY, []);
  const [payment, setPayment] = useState('UPI');
  const items = getCheckoutProducts(cart);
  if (!active) return <Navigate to="/user/login" />;
  const place = () => {
    if (placingRef.current) return;
    placingRef.current = true;
    try {
      const checkoutItems = items.length ? items : getCheckoutProducts(readStore(CART_KEY, []));
      if (!checkoutItems.length) {
        notify('Select a product before placing an order.');
        placingRef.current = false;
        window.location.href = '/shopsphere';
        return;
      }
      const newOrders = checkoutItems.map((product, index) => {
        const orderId = `DX-${Date.now()}-${index + 1}-${product.id}`;
        let bill = {};
        try {
          bill = getBillPayload(orderId);
        } catch {
          bill = { receiptId: `BILL-${orderId}`, receiptHash: `BILL-${orderId}`, billQrValue: `BILL-${orderId}`, billQrImage: '', billGeneratedAt: nowStamp() };
        }
        return {
          id: orderId,
          productId: product.id,
          userId: active.id,
          customer: active.name,
          phone: active.phone,
          address: active.address,
          location: active.location || readStore(LOCATION_KEY, 'Guindy'),
          payment,
          status: 'Waiting for admin confirmation',
          placedAt: nowStamp(),
          deliveryOtp: generateOtp(),
          otpSentAt: '',
          receiptId: bill.receiptId,
          receiptHash: bill.receiptHash,
          billQrValue: bill.billQrValue,
          billQrImage: bill.billQrImage,
          billGeneratedAt: bill.billGeneratedAt,
        };
      });
      const updatedOrders = savePlacedOrders(newOrders);
      setOrders(updatedOrders);
      setCart([]);
      writeStore(CART_KEY, []);
      localStorage.removeItem(SHOPSPHERE_BUY_KEY);
      notify('Order placed. Waiting for admin confirmation.');
      window.location.href = '/user/orders';
    } catch (error) {
      console.error(error);
      try {
        const product = items[0] || findCatalogProduct(readStore(CART_KEY, [])[0]?.productId);
        if (!product) throw error;
        const orderId = `DX-${Date.now()}-FAST-${product.id}`;
        const currentOrders = Array.isArray(readStore(ORDERS_KEY, [])) ? readStore(ORDERS_KEY, []) : [];
        const fallbackOrder = {
          id: orderId,
          productId: product.id,
          userId: active.id,
          customer: active.name,
          phone: active.phone,
          address: active.address,
          location: active.location || 'Guindy',
          payment,
          status: 'Waiting for admin confirmation',
          placedAt: nowStamp(),
          deliveryOtp: generateOtp(),
          otpSentAt: '',
          receiptId: `BILL-${orderId}`,
          receiptHash: `BILL-${orderId}`,
          billQrValue: `BILL-${orderId}`,
          billQrImage: '',
          billGeneratedAt: nowStamp()
        };
        writeStore(ORDERS_KEY, [...currentOrders, fallbackOrder]);
        writeStore(CART_KEY, []);
        localStorage.removeItem(SHOPSPHERE_BUY_KEY);
        window.location.href = '/user/orders';
      } catch {
        placingRef.current = false;
        notify('Order could not be placed. Storage is blocked.');
      }
    }
  };
  const submitPlace = (event) => {
    event.preventDefault();
    place();
  };
  const touchPlace = () => {
    place();
  };
  const clickPlace = (event) => {
    if (!placingRef.current) {
      event.preventDefault();
      place();
    }
  };
  return (
    <PortalShell type="user">
      <main className="checkout">
        <form className="form-card checkout-form" onSubmit={submitPlace}>
          <h1>Order page</h1>
          <input value={active.name} readOnly />
          <input value={active.phone} readOnly />
          <textarea value={active.address} readOnly />
          <select value={payment} onChange={(e) => setPayment(e.target.value)}><option>COD</option><option>UPI</option><option>App Pay</option></select>
          <a href="/user/orders" className="primary checkout-place-order" onMouseDown={touchPlace} onTouchStart={touchPlace} onClick={clickPlace}>Place order</a>
        </form>
        <section className="stack">{items.map((product) => <article className="line-card" key={product.id}><img src={product.image} alt={product.name} /><div><h3>{product.name}</h3><p>Estimated delivery: {getDeliveryEstimate(active.location || 'Guindy', product.warehouseLocation)}</p><strong>{money(product.price)}</strong></div></article>)}</section>
        <a href="/user/orders" className="primary checkout-floating-order" onMouseDown={touchPlace} onTouchStart={touchPlace} onClick={clickPlace}>Place order</a>
      </main>
    </PortalShell>
  );
}

function OrderTimeline({ status, order }) {
  const stages = ['Order placed', 'Admin confirmation', 'Waiting for delivery partner', 'Delivered'];
  const statusStep = {
    'Waiting for admin confirmation': 1,
    'Waiting for delivery partner': 2,
    'Out for delivery': 2,
    Delivered: 3
  };
  const active = isDeliveredOrder(order) ? 3 : (statusStep[status] ?? 0);
  return <div className="timeline">{stages.map((stage, index) => <div className={index <= active ? 'done' : ''} key={stage}><span>{index + 1}</span><p>{stage}</p></div>)}</div>;
}

function UserOrders() {
  const [orders] = useLocalState(ORDERS_KEY, []);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  if (!active) return <Navigate to="/user/login" />;
  const myOrders = orders.filter((order) => order.userId === active.id && order.status !== 'Returned');
  const activeOrders = myOrders.filter((order) => !isDeliveredOrder(order));
  const deliveredOrders = myOrders.filter((order) => isDeliveredOrder(order));
  return (
    <PortalShell type="user">
      <main>
        <section className="section-head"><h1>My orders</h1><span>Orders go to admin confirmation before the delivery partner receives them.</span></section>
        {!myOrders.length && <EmptyState title="No orders yet" to="/shopsphere" action="Shop now" />}
        {!!activeOrders.length && (
          <>
            <section className="section-head compact-head"><h2>Active delivery</h2><span>Waiting for admin or ZippGo partner completion.</span></section>
            <section className="stack">{activeOrders.map((order) => <OrderCard key={order.id} order={order} />)}</section>
          </>
        )}
        {!!deliveredOrders.length && (
          <>
            <section className="section-head compact-head"><h2>Delivered</h2><span>Delivery partner completed OTP and proof checks.</span></section>
            <section className="stack">{deliveredOrders.map((order) => <OrderCard key={order.id} order={order} />)}</section>
          </>
        )}
      </main>
    </PortalShell>
  );
}

function OrderCard({ order }) {
  const product = findCatalogProduct(order.productId);
  const delivered = isDeliveredOrder(order);
  return (
    <article className="line-card wide-line">
      <img src={product.image} alt={product.name} />
      <div>
        <h3>{product.name}</h3>
        {delivered && <div className="status-pill good">Delivered by ZippGo partner</div>}
        <p>{order.id} · {getDeliveryEstimate(order.location, product.warehouseLocation)} estimated delivery</p>
        {order.otpSentAt && <DeliveryOtpCard order={order} />}
        <OrderTimeline status={order.status} order={order} />
        {order.deliveryProof?.deliveryPhoto && <DeliveryProofPreview order={order} />}
      </div>
      <div className="order-actions">
        <Link className="secondary small" to={`/user/order/${order.id}`}>Details</Link>
        {delivered ? <Link className="primary small" to="/user/returns">Return</Link> : <span className="ghost small disabled-link">Return after delivery</span>}
      </div>
    </article>
  );
}

function OtpDigits({ value = '' }) {
  const digits = String(value || '').padEnd(6, ' ').slice(0, 6).split('');
  return (
    <div className="otp-boxes" aria-label={`OTP ${String(value || '').split('').join(' ')}`}>
      {digits.map((digit, index) => <span key={index}>{digit.trim() || '-'}</span>)}
    </div>
  );
}

function OtpInput({ value, onChange, label = 'Enter OTP' }) {
  return (
    <label className="otp-digit-input">
      <span>{label}</span>
      <input
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label={label}
      />
      <OtpDigits value={value} />
    </label>
  );
}

function DeliveryOtpCard({ order }) {
  return (
    <div className="otp-card otp-display-card">
      <div>
        <strong>Delivery OTP</strong>
        <span>Sent to {maskPhone(order.phone)} at {order.otpSentAt}. Share it with the ZippGo partner.</span>
      </div>
      <OtpDigits value={order.deliveryOtp} />
    </div>
  );
}

function UserOrderDetails() {
  const { id } = useParams();
  const [orders] = useLocalState(ORDERS_KEY, []);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  if (!active) return <Navigate to="/user/login" />;
  const order = orders.find((item) => item.id === id && item.userId === active.id);
  if (!order) return <Navigate to="/user/orders" />;
  const product = findCatalogProduct(order.productId);
  return (
    <PortalShell type="user">
      <main className="order-detail-page">
        <section className="section-head">
          <div>
            <h1>Order details</h1>
            <span>{order.id} · delivery proof visible only to this account and admin</span>
          </div>
          <Link className="secondary" to="/user/orders">Back to orders</Link>
        </section>
        <article className="order-detail-card">
          <img src={product.image} alt={product.name} />
          <div>
            <h2>{product.name}</h2>
            <p>{order.customer} · {order.address}</p>
            <strong>{money(product.price)}</strong>
            {order.otpSentAt && <DeliveryOtpCard order={order} />}
            <OrderTimeline status={order.status} order={order} />
          </div>
        </article>
        <DeliveryProofPreview order={order} large />
        <BillQrCard order={order} />
        <SellerProofPreview order={order} product={product} />
      </main>
    </PortalShell>
  );
}

function DeliveryProofPreview({ order, large = false }) {
  if (!order.deliveryProof?.deliveryPhoto) {
    return <section className={large ? 'proof-preview large-proof' : 'proof-preview'}><Camera size={18} /><span>Delivery image proof will appear after OTP delivery completion.</span></section>;
  }
  return (
    <section className={large ? 'proof-preview large-proof' : 'proof-preview'}>
      <div>
        <strong>Delivery image proof</strong>
        <span>Captured by delivery partner at {order.deliveryProof.timestamp}</span>
      </div>
      <img src={order.deliveryProof.deliveryPhoto} alt="Delivery proof" />
      <img src={order.deliveryProof.packagePhoto} alt="Package proof" />
    </section>
  );
}

function UserReturns() {
  const [orders] = useLocalState(ORDERS_KEY, []);
  const [returns, setReturns] = useLocalState(RETURNS_KEY, []);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  if (!active) return <Navigate to="/user/login" />;
  const myOrders = orders.filter((order) => order.userId === active.id);
  const myReturns = returns.filter((item) => myOrders.some((order) => order.id === item.orderId));
  const delivered = myOrders.filter((order) => isDeliveredOrder(order));
  return (
    <PortalShell type="user">
      <main>
        <section className="section-head"><h1>Returns after delivery</h1><span>A return can be requested only after the product is delivered.</span></section>
        <section className="stack">
          {myOrders.map((order) => {
            const product = findCatalogProduct(order.productId);
            const canReturn = isDeliveredOrder(order);
            const returnCase = myReturns.find((item) => item.orderId === order.id);
            const partnerAccepted = returnCase?.partnerDecision === 'Accepted' || /accepted|approved/i.test(`${returnCase?.status || ''} ${returnCase?.pickupStatus || ''}`);
            const partnerDone = Boolean(returnCase?.deliveryPartnerChecks || returnCase?.partnerDecision || partnerAccepted);
            return (
              <article className="line-card" key={order.id}>
                <img src={product.image} alt={product.name} />
                <div>
                  <h3>{product.name}</h3>
                  <p>{canReturn ? 'Delivered. You can request a pickup verification return.' : 'Return unlocks after delivery is completed.'}</p>
                  {returnCase && (
                    <div className={partnerDone ? (partnerAccepted ? 'status-pill good' : 'status-pill danger') : 'status-pill'}>
                      {partnerDone ? (partnerAccepted ? 'Delivery partner accepted the return' : 'Delivery partner cancelled the return') : 'Waiting for delivery partner return verification'}
                    </div>
                  )}
                </div>
                <Link className={canReturn ? 'primary small' : 'ghost'} to={returnCase ? `/user/fraud-result/${returnCase.id}` : (canReturn ? `/user/return/${order.id}` : '/user/orders')}>{returnCase ? 'View status' : (canReturn ? 'Request return' : 'Not available yet')}</Link>
              </article>
            );
          })}
          {!delivered.length && <div className="alert"><AlertTriangle size={18} /> No delivered product is available for return yet.</div>}
        </section>
      </main>
    </PortalShell>
  );
}

function ReturnRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const submitReturnRef = useRef(false);
  const [orders, setOrders] = useLocalState(ORDERS_KEY, []);
  const [returns, setReturns] = useLocalState(RETURNS_KEY, []);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  if (!active) return <Navigate to="/user/login" />;
  const order = orders.find((item) => item.id === id && item.userId === active.id);
  if (!order) return <Navigate to="/user/orders" />;
  const product = findCatalogProduct(order.productId);
  const foodReturn = isFoodProduct(product);
  const otpDeliveryConfirmed = Boolean(order.deliveryProof?.otpVerified);
  const policy = getWardrobingPolicy(product);
  const dynamicPolicy = getDynamicReturnPolicy(product);
  const bill = getDeliveredBill(order);
  const returnReasons = [...dynamicPolicy.validReasons];
  if (!otpDeliveryConfirmed && !returnReasons.includes('Item not received')) returnReasons.push('Item not received');
  const [request, setRequest] = useState({
    reason: returnReasons[0] || 'Damaged product',
    typedReason: '',
    receiptId: bill.receiptId,
    receiptHash: bill.receiptHash,
    billQrValue: bill.billQrValue,
    uploadedBillQrValue: '',
    billQrUploaded: false,
    billQrMatched: false,
    billQrPreview: '',
    billQrCheckMessage: '',
    visualResult: 'Match',
    imageQualityGood: true,
    duplicatePassed: true,
    partnerVerificationPending: true,
    issuePhoto: false,
    liveCaptureDone: false,
    liveCaptureAnalysis: null
  });
  const liveFoodValid = !foodReturn || Boolean(request.liveCaptureDone && request.liveCaptureAnalysis);
  const billQrValid = Boolean(request.billQrUploaded && request.billQrMatched);
  const canSubmitReturn = true;
  const submit = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (submitReturnRef.current) return;
    submitReturnRef.current = true;
    const finalRequest = {
      ...request,
      receiptId: bill.receiptId,
      receiptHash: bill.receiptHash,
      billQrValue: bill.billQrValue,
      billQrMatched: request.billQrMatched || request.billQrUploaded,
      billQrMismatch: request.billQrUploaded ? !request.billQrMatched : false
    };
    const result = finalRequest.reverseImageMatch ? reverseImageRejectResult(finalRequest.reverseLookup) : (foodReturn ? foodLiveReturnResult(finalRequest.liveCaptureAnalysis) : pendingReturnResult());
    const rejectedBeforePickup = request.reverseImageMatch || result.decision === 'Reject / Investigate';
    const foodProofPassed = foodReturn && result.decision === 'Food Proof Passed - Awaiting Approval';
    const storedRequest = {
      ...finalRequest,
      issuePhotoPreview: compactImageData(finalRequest.issuePhotoPreview),
      liveCaptureAnalysis: finalRequest.liveCaptureAnalysis ? {
        ...finalRequest.liveCaptureAnalysis,
        capturedImage: compactImageData(finalRequest.liveCaptureAnalysis.capturedImage),
        recordedVideoDataUrl: compactImageData(finalRequest.liveCaptureAnalysis.recordedVideoDataUrl, 900000),
        recordedVideoUrl: finalRequest.liveCaptureAnalysis.recordedVideoDataUrl ? '' : finalRequest.liveCaptureAnalysis.recordedVideoUrl
      } : null
    };
    const returnCase = {
      id: `RET-${Date.now()}`,
      orderId: order.id,
      productId: product.id,
      customer: order.customer,
      location: order.location,
      request: storedRequest,
      result,
      createdAt: nowStamp(),
      status: rejectedBeforePickup ? 'Return rejected before pickup' : foodProofPassed ? 'Food proof submitted - waiting for admin and ZippGo approval' : foodReturn ? 'Additional verification required - contact support' : 'Partner visit requested'
    };
    const currentReturns = Array.isArray(readStore(RETURNS_KEY, [])) ? readStore(RETURNS_KEY, []) : [];
    const updatedReturns = [...currentReturns, returnCase];
    try {
      writeStore(RETURNS_KEY, updatedReturns);
      window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: RETURNS_KEY, value: updatedReturns } }));
      setReturns(updatedReturns);
    } catch {
      try {
        const compactCase = {
          ...returnCase,
          request: {
            reason: finalRequest.reason,
            typedReason: finalRequest.typedReason,
            receiptId: finalRequest.receiptId,
            receiptHash: finalRequest.receiptHash,
            billQrMatched: finalRequest.billQrMatched,
            partnerVerificationPending: true,
            liveCaptureDone: finalRequest.liveCaptureDone,
            issuePhotoPreview: compactImageData(finalRequest.issuePhotoPreview),
            liveCaptureAnalysis: finalRequest.liveCaptureAnalysis ? {
              ...finalRequest.liveCaptureAnalysis,
              capturedImage: compactImageData(finalRequest.liveCaptureAnalysis.capturedImage),
              recordedVideoDataUrl: compactImageData(finalRequest.liveCaptureAnalysis.recordedVideoDataUrl, 900000),
              recordedVideoUrl: ''
            } : null
          }
        };
        const compactReturns = [...currentReturns, compactCase];
        writeStore(RETURNS_KEY, compactReturns);
        window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: RETURNS_KEY, value: compactReturns } }));
        setReturns(compactReturns);
      } catch {
        submitReturnRef.current = false;
        notify('Return request could not be saved. Clear old demo data and try again.');
        return;
      }
    }
    notify(rejectedBeforePickup ? 'Return proof rejected before pickup.' : foodProofPassed ? 'Food video proof sent to admin and ZippGo for approval.' : (foodReturn ? 'Food return needs additional verification. Please contact support.' : returnCase.status));
    window.location.href = `/user/fraud-result/${returnCase.id}`;
  };
  return (
    <PortalShell type="user">
      <main className="return-screen">
        <section className="return-product"><img src={product.image} alt={product.name} /><div><h2>{product.name}</h2><strong>{money(product.price)}</strong><span>{product.price > 20000 ? 'High value item - extra verification' : 'Standard product rules'}</span></div></section>
        <section className="form-card wide">
          <h1>Request return</h1>
          <p>{foodReturn ? 'Tell us why you want to return this food item. Food returns must use app-only video proof first. If the same-product and live-proof checks pass, the video is sent to admin and ZippGo for approval before refund starts.' : 'Tell us why you want to return this delivered product. After you submit, a ZippGo delivery partner visits your location and confirms the product details before pickup.'}</p>
          <section className="policy-card inline-policy">
            <h2>{dynamicPolicy.family} return policy</h2>
            <div className="policy-pill-row"><span>{dynamicPolicy.window}</span><span>{policy.risk} wardrobing risk</span><span>{foodReturn ? 'App video proof required' : 'Partner proof required'}</span></div>
            <p>{dynamicPolicy.summary}</p>
            <div className="refund-list">{dynamicPolicy.partnerChecks.map((check) => <div key={check}><span>{check}</span><strong>Required</strong></div>)}</div>
          </section>
          {otpDeliveryConfirmed && <div className="pending-check"><ShieldCheck size={18} /><span>Item not received is disabled because this delivery was confirmed with OTP proof.</span></div>}
          <select value={request.reason} onChange={(e) => setRequest({ ...request, reason: e.target.value })}>{returnReasons.map((reason) => <option key={reason}>{reason}</option>)}</select>
          <div className="pending-check"><Camera size={18} /><span>{getReasonProof(request.reason, product)}</span></div>
          <textarea placeholder="Type return reason clearly" value={request.typedReason} onChange={(e) => setRequest({ ...request, typedReason: e.target.value })} />
          <BillQrCard order={order} />
          <FileMock label="Upload order bill / invoice" accept="image/*,.pdf" done={request.billQrUploaded} onDone={(file, preview) => {
            const scan = simulateBillQrScan(file, order);
            setRequest({
              ...request,
              billQrUploaded: true,
              billQrPreview: preview,
              uploadedBillQrValue: scan.extractedValue,
              billQrMatched: scan.matched,
              billQrCheckMessage: scan.message
            });
          }} />
          {request.billQrUploaded && (
            <div className={request.billQrMatched ? 'status-pill good' : 'alert'}>
              {request.billQrMatched ? <><CheckCircle2 size={18} /> {request.billQrCheckMessage}</> : <><XCircle size={18} /> {request.billQrCheckMessage}</>}
              <small>Uploaded QR: {request.uploadedBillQrValue}</small>
              <small>Stored QR: {bill.billQrValue}</small>
            </div>
          )}
          {foodReturn ? (
            <LiveFoodReturnCapture product={product} onComplete={(analysis) => setRequest({ ...request, issuePhoto: true, issuePhotoPreview: analysis.capturedImage, liveCaptureDone: true, liveCaptureAnalysis: analysis })} />
          ) : (
            <FileMock label="Upload issue photo if available" done={request.issuePhoto} onDone={(file, preview) => {
              const lookup = simulateReverseImageLookup(file, preview, product);
              setRequest({ ...request, issuePhoto: true, issuePhotoPreview: preview, reverseLookup: lookup, reverseImageMatch: lookup.matched });
            }} />
          )}
          {request.reverseLookup?.checked && (
            <div className={request.reverseImageMatch ? 'status-pill danger' : 'status-pill good'}>
              {request.reverseImageMatch ? `Reverse image match found (${request.reverseLookup.confidence}%) - return will be rejected` : 'Reverse image lookup passed'}
            </div>
          )}
          <div className="pending-check">
            <Truck size={18} />
            <span>{foodReturn ? 'If the camera, motion, torch, screen-fake, and same-product checks pass, the proof video is sent to admin and ZippGo. Refund starts only after approval.' : 'After submission, ZippGo will send a delivery partner to your location. Product detail verification will appear after the partner confirms the return.'}</span>
          </div>
          <button type="button" className="primary force-click return-submit-button" onPointerDown={submit} onMouseDown={submit} onTouchStart={submit} onClick={submit}>Submit return request</button>
        </section>
      </main>
    </PortalShell>
  );
}

function BillQrCard({ order }) {
  const bill = getDeliveredBill(order);
  return (
    <section className="bill-card">
      <img src={bill.billQrImage} alt="Order bill QR" />
      <div>
        <h2>Order bill QR</h2>
        <strong>{bill.receiptId}</strong>
        <span>{bill.receiptHash}</span>
        <p>This QR is generated for the order bill and stored with the order. During return, the uploaded bill must produce the same QR value.</p>
      </div>
    </section>
  );
}

function SellerProofPreview({ order, product }) {
  const proof = order.sellerProof;
  if (!proof?.packagePhoto && !proof?.openedPhoto) {
    return (
      <section className="proof-preview large-proof">
        <PackageCheck size={18} />
        <span>Seller package and open-box proof will appear here after the seller uploads it by order ID.</span>
      </section>
    );
  }
  return (
    <section className="seller-proof-panel">
      <div>
        <h2>Seller package proof</h2>
        <span>{proof.uploadedAt ? `Uploaded at ${proof.uploadedAt}` : 'Uploaded by seller'}</span>
        <p>These photos stay with the order so delivery partners can compare the return product with the delivered product.</p>
      </div>
      <figure>
        <img src={proof.packagePhoto || product.image} alt="Seller package proof" />
        <figcaption>Package before opening</figcaption>
      </figure>
      <figure>
        <img src={proof.openedPhoto || product.image} alt="Seller open-box proof" />
        <figcaption>After opening / product proof</figcaption>
      </figure>
    </section>
  );
}

function LiveFoodReturnCapture({ product, onComplete }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingStep, setRecordingStep] = useState('');
  const [recordedVideoUrl, setRecordedVideoUrl] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const challenges = [
    { text: 'Tilt the food box slowly left and right', torchRequired: false },
    { text: 'Move camera slightly left, then closer', torchRequired: false },
    { text: 'Turn torch on and show the faulty area', torchRequired: true },
    { text: 'Turn torch off, then rotate the item once', torchRequired: false }
  ];

  useEffect(() => () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
  }, [recordedVideoUrl]);

  const openCamera = async () => {
    setError('');
    setAnalysis(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const track = stream.getVideoTracks?.()[0];
      setTorchSupported(Boolean(track?.getCapabilities?.().torch));
      setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
      setCameraOn(true);
      return true;
    } catch {
      setError('Camera permission is required for food and beverage return proof.');
      return false;
    }
  };

  const recordVideoClip = (durationMs = 2800) => new Promise((resolve) => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      resolve({ url: '', dataUrl: '', size: 0 });
      return;
    }
    recordedChunksRef.current = [];
    const options = MediaRecorder.isTypeSupported?.('video/webm;codecs=vp8') ? { mimeType: 'video/webm;codecs=vp8' } : {};
    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
      if (!blob.size) {
        resolve({ url: '', dataUrl: '', size: 0 });
        return;
      }
      const url = URL.createObjectURL(blob);
      if (blob.size > 900000) {
        resolve({ url, dataUrl: '', size: blob.size });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve({ url, dataUrl: String(reader.result || ''), size: blob.size });
      reader.onerror = () => resolve({ url, dataUrl: '', size: blob.size });
      reader.readAsDataURL(blob);
    };
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  });

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    const next = !torchOn;
    try {
      if (track?.getCapabilities?.().torch) {
        await track.applyConstraints({ advanced: [{ torch: next }] });
      }
      setTorchOn(next);
    } catch {
      setTorchOn(next);
    }
  };

  const grabFrame = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      image: canvas.toDataURL('image/jpeg', 0.82),
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data
    };
  };

  const averageDiff = (a, b) => {
    if (!a || !b) return 0;
    let diff = 0;
    let count = 0;
    for (let i = 0; i < a.length; i += 64) {
      diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      count += 3;
    }
    return diff / Math.max(1, count);
  };

  const brightnessStats = (pixels) => {
    let total = 0;
    let totalSq = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 80) {
      const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      total += value;
      totalSq += value * value;
      count += 1;
    }
    const mean = total / Math.max(1, count);
    const variance = totalSq / Math.max(1, count) - mean * mean;
    return { mean, variance };
  };

  const colourStats = (pixels) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      count += 1;
    }
    r /= Math.max(1, count);
    g /= Math.max(1, count);
    b /= Math.max(1, count);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max ? (max - min) / max : 0;
    return {
      r,
      g,
      b,
      brightness: (r + g + b) / 3,
      saturation
    };
  };

  const checkProductMatch = (stats) => {
    const name = `${product.name || ''} ${product.displayCategory || ''}`.toLowerCase();
    const brightEnough = stats.brightness > 48;
    const hasFoodColour = stats.saturation > 0.035;
    const warmTone = stats.r + stats.g > stats.b * 1.35;
    const lightTone = stats.brightness > 82;
    const fruitTone = stats.saturation > 0.08 && Math.max(stats.r, stats.g) > stats.b * 0.88;

    if (/fried rice|biryani|dosa|paneer|omelette/.test(name)) {
      return {
        ok: brightEnough && hasFoodColour && warmTone,
        reason: 'Live colour profile must look like the ordered warm food item, not a random video.'
      };
    }
    if (/fruit/.test(name)) {
      return {
        ok: brightEnough && fruitTone,
        reason: 'Live colour profile must look like fresh fruits with visible natural colour variation.'
      };
    }
    if (/egg|idli|coconut/.test(name)) {
      return {
        ok: lightTone || (brightEnough && hasFoodColour),
        reason: 'Live colour profile must match a light food/beverage item such as eggs, idli, or coconut.'
      };
    }
    return {
      ok: brightEnough && hasFoodColour,
      reason: 'Live proof must show a visible food item with enough colour/texture to match the order.'
    };
  };

  const analyzeFrames = (frames, proofMeta) => {
    const timestamp = nowStamp();
    const deviceInfo = navigator.userAgent.replace(/\s+/g, ' ').slice(0, 90);
    const motionValue = Math.max(...frames.slice(1).map((frame, index) => averageDiff(frames[index].pixels, frame.pixels)));
    const stats = brightnessStats(frames[Math.min(1, frames.length - 1)].pixels);
    const productColourStats = colourStats(frames[Math.min(1, frames.length - 1)].pixels);
    const metadataIssue = !timestamp || !deviceInfo;
    const motionOk = motionValue > 1.45;
    const torchOk = !proofMeta.challenge?.torchRequired || proofMeta.torchOn;
    const durationOk = proofMeta.durationMs >= 2200 && proofMeta.durationMs <= 4200;
    const uniformBrightness = stats.variance < 75;
    const repeatingPattern = Math.round(stats.mean) % 17 === 0;
    const screenDetected = uniformBrightness || repeatingPattern;
    const productMatch = checkProductMatch(productColourStats);
    const productMatchOk = productMatch.ok && !screenDetected && motionOk;
    const deepfakeSuspected = screenDetected && !motionOk && !torchOk;
    const reverseImageMatch = screenDetected && (!motionOk || repeatingPattern) && stats.variance < 35;
    const reverseLookup = {
      checked: true,
      matched: reverseImageMatch,
      confidence: reverseImageMatch ? 91 : 6,
      source: reverseImageMatch ? 'Public web image index simulation' : 'No online match found',
      reason: reverseImageMatch ? 'Reverse image lookup found a matching online/screen video signature.' : 'No public online match found.'
    };
    const riskScore = Math.min(100, (metadataIssue ? 20 : 0) + (!motionOk ? 30 : 0) + (!torchOk ? 15 : 0) + (!durationOk ? 10 : 0) + (!productMatchOk ? 45 : 0) + (screenDetected ? 40 : 0) + (deepfakeSuspected || reverseImageMatch ? 100 : 0));
    const decision = deepfakeSuspected || reverseImageMatch ? 'Reject / Investigate' : (riskScore <= 30 && productMatchOk ? 'Food Proof Passed - Awaiting Approval' : riskScore <= 70 ? 'Additional Verification Required' : 'Manual Review Required');
    return {
      capturedImage: frames[Math.min(1, frames.length - 1)].image,
      timestamp,
      deviceInfo,
      locationVerified: true,
      metadataIssue,
      metadataStatus: metadataIssue ? 'Suspicious' : 'Metadata Verified',
      motionValue: Number(motionValue.toFixed(2)),
      motionOk,
      torchOk,
      torchOn: proofMeta.torchOn,
      torchSupported: proofMeta.torchSupported,
      durationMs: proofMeta.durationMs,
      durationOk,
      challengeText: proofMeta.challenge?.text || 'Video challenge completed',
      productMatchOk,
      productMatchConfidence: productMatchOk ? Math.max(82, Math.round(96 - Math.abs(productColourStats.brightness - 128) / 3)) : Math.max(18, Math.round(58 - Math.abs(productColourStats.brightness - 128) / 4)),
      productMatchReason: productMatchOk ? `${product.name} matched live colour, motion, and screen-fake checks.` : productMatch.reason,
      screenDetected,
      deepfakeSuspected,
      reverseImageMatch,
      reverseLookup,
      riskScore,
      riskLevel: riskScore <= 30 ? 'Low' : riskScore <= 70 ? 'Medium' : 'High',
      decision
    };
  };

  const capture = async () => {
    if (!cameraOn || !streamRef.current) {
      const opened = await openCamera();
      if (!opened) return;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const activeChallenge = challenge || challenges[0];
    setLoading(true);
    setRecording(true);
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl('');
    const frames = [];
    const start = Date.now();
    const videoPromise = recordVideoClip(2800);
    setRecordingStep(activeChallenge.text);
    frames.push(grabFrame());
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRecordingStep(activeChallenge.torchRequired ? 'Keep torch on and show the fault clearly' : 'Keep tilting slowly');
    frames.push(grabFrame());
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRecordingStep('Move closer for final proof');
    frames.push(grabFrame());
    await new Promise((resolve) => setTimeout(resolve, 700));
    frames.push(grabFrame());
    const durationMs = Date.now() - start;
    const videoProof = await videoPromise;
    setRecordedVideoUrl(videoProof.url);
    const result = { ...analyzeFrames(frames, { challenge: activeChallenge, torchOn, torchSupported, durationMs }), recordedVideoUrl: videoProof.url, recordedVideoDataUrl: videoProof.dataUrl, recordedVideoSize: videoProof.size };
    setAnalysis(result);
    setRecording(false);
    setLoading(false);
    setRecordingStep('');
    onComplete(result);
  };

  const retry = () => {
    setAnalysis(null);
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl('');
    setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
  };

  return (
    <section className="live-capture-card">
      <div className="live-capture-head">
        <div>
          <h2>App-only food return video</h2>
          <span>File upload is disabled. Record a 2-3 second live video with tilt and torch checks.</span>
        </div>
        <span className="status-pill good">Location Verified</span>
      </div>
      <section className="video-proof-required">
        <Camera size={28} />
        <div>
          <strong>Video verification required</strong>
          <span>The app will access the device camera, record a short proof video, capture analysis photos, and verify the command response before return approval.</span>
        </div>
      </section>
      <div className="camera-preview">
        <video ref={videoRef} autoPlay playsInline muted />
        {!cameraOn && <div className="camera-placeholder"><Camera size={42} /><strong>Open camera to start</strong></div>}
        {cameraOn && <div className="camera-overlay"><span>Align food clearly in frame</span><b>{recordingStep || challenge?.text}</b></div>}
      </div>
      {error && <div className="alert"><XCircle size={18} /> {error}</div>}
      {cameraOn && (
        <div className="video-command-strip">
          <span>{challenge?.text}</span>
          <button type="button" className={torchOn ? 'primary small' : 'secondary small'} onClick={toggleTorch}>{torchOn ? 'Torch On' : 'Torch Off'}</button>
          <small>{torchSupported ? 'Device torch supported' : 'Torch simulated if device does not expose flash control'}</small>
        </div>
      )}
      <div className="capture-controls">
        <button type="button" className="secondary" onClick={openCamera}>{cameraOn ? 'Restart Camera' : 'Start video verification'}</button>
        <button type="button" className="capture-button" disabled={loading} onClick={capture}>{recording ? 'Recording...' : loading ? 'Analyzing...' : 'Record 3s Video'}</button>
        {analysis && <button type="button" className="ghost" onClick={retry}>Retry</button>}
      </div>
      {loading && <div className="analysis-loader"><span /> Analyzing metadata, tilt motion, torch proof, screen replay, and deepfake-like signals...</div>}
      {analysis && (
        <section className={`food-analysis-result ${analysis.riskLevel.toLowerCase()}`}>
          <div className="proof-media-stack">
            {recordedVideoUrl ? <video className="recorded-proof-video" src={recordedVideoUrl} controls muted playsInline /> : <img src={analysis.capturedImage} alt={`${product.name} live return proof`} />}
            <img src={analysis.capturedImage} alt={`${product.name} captured analysis frame`} />
          </div>
          <div>
            <h3>{analysis.decision}</h3>
            {analysis.decision === 'Food Proof Passed - Awaiting Approval' && (
              <div className="refund-success-note">
                Video proof passed. It is now sent to admin and ZippGo; refund starts only after approval.
              </div>
            )}
            <div className="food-check-grid">
              <span className={analysis.metadataIssue ? 'warn' : 'good'}>{analysis.metadataStatus} {analysis.metadataIssue ? 'Warning' : 'OK'}</span>
              <span className={analysis.productMatchOk ? 'good' : 'warn'}>{analysis.productMatchOk ? `Same product matched (${analysis.productMatchConfidence}%)` : 'Product match unclear'}</span>
              <span className={analysis.motionOk ? 'good' : 'warn'}>{analysis.motionOk ? 'Tilt/motion passed' : 'Low depth detected'}</span>
              <span className={analysis.torchOk ? 'good' : 'warn'}>{analysis.torchOk ? 'Torch challenge passed' : 'Torch challenge unclear'}</span>
              <span className={analysis.durationOk ? 'good' : 'warn'}>{analysis.durationOk ? '2-3 sec video accepted' : 'Video duration unclear'}</span>
              <span className={analysis.screenDetected ? 'danger' : 'good'}>{analysis.screenDetected ? 'Possible screen-based image detected' : 'Screen check passed'}</span>
              <span className={analysis.deepfakeSuspected ? 'danger' : 'good'}>{analysis.deepfakeSuspected ? 'Deepfake-like pattern suspected' : 'Synthetic-video check passed'}</span>
              <span className={analysis.reverseImageMatch ? 'danger' : 'good'}>{analysis.reverseImageMatch ? 'Reverse image match found' : 'Reverse image lookup passed'}</span>
              <span className="good">Location Verified OK</span>
            </div>
            {(analysis.reverseImageMatch || analysis.deepfakeSuspected) && <div className="alert"><XCircle size={18} /> Strong reused/synthetic proof signal found. Return will be rejected automatically.</div>}
            <p>Timestamp: {analysis.timestamp}</p>
            <p>Device: {analysis.deviceInfo}</p>
            <p>Command: {analysis.challengeText} · Motion score {analysis.motionValue} · Duration {(analysis.durationMs / 1000).toFixed(1)}s</p>
            <p>Reverse lookup: {analysis.reverseLookup.source} · Confidence {analysis.reverseLookup.confidence}%</p>
            <div className="risk-meter">
              <span style={{ width: `${analysis.riskScore}%` }} />
            </div>
            <strong>Risk score: {analysis.riskScore} / 100 · {analysis.riskLevel}</strong>
          </div>
        </section>
      )}
    </section>
  );
}

function ProductProofInputs({ product, request, setRequest }) {
  if (product.category === 'Dresses / Fashion') return <FileMock label="Upload dress tag photo" done={request.tagPhoto} onDone={() => setRequest({ ...request, tagPhoto: product.image })} />;
  if (product.category === 'Electronics' || product.category === 'Cameras / Gadgets') return <FileMock label="Upload serial number/accessory photo" done={request.serialPhoto} onDone={() => setRequest({ ...request, serialPhoto: product.image })} />;
  if (product.category === 'Shoes') return <FileMock label="Upload sole condition photo" done={request.solePhoto} onDone={() => setRequest({ ...request, solePhoto: product.image })} />;
  if (product.category === 'Tools') return <FileMock label="Upload scratch/dirt condition photo" done={request.conditionPhoto} onDone={() => setRequest({ ...request, conditionPhoto: product.image })} />;
  return <FileMock label="Upload product condition photo" done={request.normalPhoto} onDone={() => setRequest({ ...request, normalPhoto: product.image })} />;
}

function WardrobingPolicyPage() {
  const [sampleProduct, setSampleProduct] = useState(products.find((item) => item.category === 'Dresses / Fashion')?.id || products[0].id);
  const product = products.find((item) => item.id === sampleProduct) || products[0];
  const policy = getWardrobingPolicy(product);
  const checklist = getPickupChecklist(product);
  const solutionCards = [
    ['1. Product-based return policy', 'One rule is not used for every product. Each category has its own risk level, return window, and proof requirement.'],
    ['2. Tamper-proof tags', 'Fashion items need visible anti-return tags. Delivery and pickup tag photos are compared before approval.'],
    ['3. Electronics usage detection', 'Usage hours, battery cycles, warranty activation, serial number, scratches, accessories, and packaging are checked.'],
    ['4. Risk-based return window', 'Low-risk products get 7-10 days, medium risk gets 3-7 days, and high-risk categories get 24-72 hours.'],
    ['5. Reason-based approval', 'Damage, size issue, wrong item, missing accessory, and not-working reasons trigger different proof requirements.'],
    ['6. Delivery photo/video proof', 'Delivery partner captures product, package, tag/seal, serial number, and customer confirmation proof.'],
    ['7. Wardrobing risk score', 'Score uses category, customer history, return timing, tag/seal removal, photos, repeated event/weekend returns, and value.'],
    ['8. Partial refund model', 'Unused returns get full refund, minor packaging damage gets deduction, used but resellable items get partial refund, clear usage is rejected.'],
    ['9. Non-returnable labels', 'High-risk items are marked before purchase so the customer knows the unopened/unused/sealed rule.'],
    ['10. Rental option', 'Products commonly used temporarily can be rented instead of bought and returned.'],
    ['11. Customer return limit', 'Repeated high-risk returns move the account to manual approval instead of punishing genuine users.'],
    ['12. Pickup agent checklist', 'The pickup partner must complete a category-specific checklist before the return is accepted.']
  ];

  return (
    <PortalShell type="user">
      <main className="policy-page">
        <section className="section-head seller-head">
          <div>
            <span className="eyebrow">Wardrobing policy engine</span>
            <h1>Product-based temporary-use return prevention</h1>
            <span>Smart, fair, category-specific rules for dresses, electronics, tools, cosmetics, books, footwear, and normal products.</span>
          </div>
        </section>

        <section className="table-wrap">
          <h2>Product-based return policy</h2>
          <table>
            <thead><tr><th>Product Type</th><th>Wardrobing Risk</th><th>Return Window</th><th>Policy Solution</th><th>Proof Required</th></tr></thead>
            <tbody>{wardrobingPolicies.map((row) => <tr key={row.type}><td>{row.type}</td><td>{row.risk}</td><td>{row.window}</td><td>{row.solution}</td><td>{row.proof}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="policy-grid">
          {solutionCards.map(([title, text]) => <article className="policy-card" key={title}><h2>{title}</h2><p>{text}</p></article>)}
        </section>

        <section className="split">
          <article className="form-card">
            <h2>Live product policy preview</h2>
            <select value={sampleProduct} onChange={(event) => setSampleProduct(event.target.value)}>
              {products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <div className="return-product inline-return-product">
              <img src={product.image} alt={product.name} />
              <div><h2>{product.name}</h2><strong>{policy.risk} risk</strong><span>{policy.window}</span></div>
            </div>
            <p>{policy.solution}</p>
            <strong>Proof required: {policy.proof}</strong>
            <div className="policy-pill-row">
              <span>{policy.rental ? 'Rental option shown' : 'No rental prompt'}</span>
              <span>{policy.nonReturnableWhen}</span>
            </div>
          </article>
          <article className="form-card">
            <h2>Pickup checklist for this product</h2>
            <div className="pickup-checklist standalone">
              {checklist.map((item) => <span key={item}><CheckCircle2 size={16} /> {item}</span>)}
            </div>
            <h2>Partial refund rules</h2>
            <div className="refund-list">{refundDecisions.map(([condition, decision]) => <div key={condition}><span>{condition}</span><strong>{decision}</strong></div>)}</div>
          </article>
        </section>

        <section className="policy-grid two">
          <article className="policy-card">
            <h2>Non-returnable labels</h2>
            <div className="policy-pill-row">{nonReturnableLabels.map((item) => <span key={item}>{item}</span>)}</div>
          </article>
          <article className="policy-card">
            <h2>Rental instead of return abuse</h2>
            <p>When a product is commonly used for a short period, TrustKart can convert risky buy-use-return behavior into a legal rental flow.</p>
            <div className="policy-pill-row">{rentalOptions.map((item) => <span key={item}>{item}</span>)}</div>
          </article>
        </section>

        <section className="best-policy">
          <ShieldCheck size={28} />
          <div>
            <h2>Best return policy statement</h2>
            <p>To prevent temporary-use returns, all returned products must be unused, undamaged, and returned with original tags, seals, packaging, accessories, and serial numbers. High-risk categories such as fashion wear, electronics, tools, and travel-use products will go through additional verification. If usage signs are found, the return may be rejected or a partial refund may be issued. Customers with repeated suspicious return patterns may be moved to manual approval to protect sellers and genuine buyers.</p>
          </div>
        </section>
      </main>
    </PortalShell>
  );
}

function FraudResultPage() {
  const { id } = useParams();
  const [returns] = useLocalState(RETURNS_KEY, []);
  const [orders] = useLocalState(ORDERS_KEY, []);
  const [active] = useLocalState(ACTIVE_USER_KEY, null);
  if (!active) return <Navigate to="/user/login" />;
  const item = returns.find((returnCase) => {
    const order = orders.find((orderItem) => orderItem.id === returnCase.orderId);
    return returnCase.id === id && order?.userId === active.id;
  });
  if (!item) return <Navigate to="/user/returns" />;
  const product = findCatalogProduct(item.productId);
  const policy = getWardrobingPolicy(product);
  const pendingRisk = item.result.pending;
  const rejected = item.result.decision === 'Reject / Investigate';
  const partnerDone = Boolean(item.deliveryPartnerChecks);
  const partnerAccepted = item.partnerDecision ? item.partnerDecision === 'Accepted' : item.pickupStatus?.includes('accepted');
  const partnerCancelled = item.partnerDecision === 'Cancelled' || item.status?.includes('cancelled by delivery partner');
  const foodRefundApproved = item.result.decision === 'Refund Approved';
  return (
    <PortalShell type="user">
      <main>
        <section className="result-hero">
          <article className={`score-card ${item.result.tone}`}><ShieldCheck size={34} /><span>Risk score</span><strong>{pendingRisk ? 'Pending' : item.result.score}</strong><p>{pendingRisk ? 'Partner check required' : `${item.result.level} risk`}</p></article>
          <div><h1>{pendingRisk ? 'Waiting for delivery partner verification' : (partnerCancelled ? 'Return closed by delivery partner' : (rejected ? 'Return cancelled' : item.result.decision))}</h1><p>{pendingRisk ? item.result.explanation : (partnerCancelled ? 'The delivery partner cancelled this return after product, image, or condition verification failed. It has been cleared from the pickup queue.' : (rejected ? 'Fraud signals were found, so this return is cancelled and sent for investigation.' : item.result.explanation))}</p></div>
        </section>
        {partnerDone && (
          <div className={partnerAccepted ? 'partner-decision accepted' : 'partner-decision cancelled'}>
            <strong>{partnerAccepted ? 'Delivery partner accepted the return' : 'Delivery partner cancelled the return'}</strong>
            <span>{item.pickupStatus}</span>
          </div>
        )}
        <section className="policy-grid">
          <article className="policy-card">
            <h2>Wardrobing policy applied</h2>
            <div className="policy-pill-row"><span>{policy.risk} risk</span><span>{policy.window}</span></div>
            <p>{policy.solution}</p>
          </article>
          <article className="policy-card">
            <h2>Refund outcome</h2>
            <strong>{getRefundOutcome(item)}</strong>
            <p>If usage signs, missing accessories, or damaged packaging are found, the refund may be reduced or rejected after inspection.</p>
          </article>
        </section>
        <section className="fraud-summary">
          <article>
            <h2>Fraud type detected</h2>
            <div className="fraud-badges">
              {(item.result.fraudTypes?.length ? item.result.fraudTypes : ['No fraud type detected']).map((type) => <span key={type}>{type}</span>)}
            </div>
          </article>
          <article>
            <h2>Triggered conditions</h2>
            <ul>
              {(item.result.triggeredConditions || item.result.signals.map((signal) => signal.label)).map((condition) => <li key={condition}>{condition}</li>)}
            </ul>
          </article>
        </section>
        {!pendingRisk && <section className="signals">{item.result.signals.map((signal) => <article key={signal.label}><strong>{signal.points > 0 ? `+${signal.points}` : signal.points}</strong><span>{signal.label}</span></article>)}</section>}
        {item.deliveryPartnerChecks ? (
          <section className="trust-tags">
            <span>ZippGo partner visited the location and verified product condition</span>
            <span>{partnerAccepted ? 'Good request proof reduces risk by -20' : 'Return pickup closed by partner decision'}</span>
            <span>Delivery proof checked</span>
            <span>Image match: {item.deliveryPartnerChecks.visualResult}</span>
            <span>Colour match: {item.deliveryPartnerChecks.colourMatches === 'Yes' ? 'Matched' : 'Mismatch'}</span>
          </section>
        ) : foodRefundApproved ? (
          <div className="pending-check">
            <CheckCircle2 size={18} />
            <span>Food return approved by app-only video checks. Money will be refunded within 12 hours. If it is not received, contact support.</span>
          </div>
        ) : (
          <div className="pending-check">
            <Truck size={18} />
            <span>Waiting for the ZippGo delivery partner to visit the customer location and confirm product details.</span>
          </div>
        )}
        <section className="compare single-proof"><img src={product.image} alt="Verified product proof" /></section>
      </main>
    </PortalShell>
  );
}

function AdminLogin() {
  const navigate = useNavigate();
  const [, setAdmin] = useLocalState(ADMIN_KEY, false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = () => {
    if (password === 'devxadmin') {
      setAdmin(true);
      navigate('/admin');
    } else {
        setError('Invalid admin password.');
    }
  };
  return (
    <main className="auth-page">
      <section className="form-card">
        <Brand />
        <h1>Admin login</h1>
        <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="alert"><Lock size={18} /> {error}</div>}
        <button className="primary" onClick={login}>Open admin website</button>
      </section>
    </main>
  );
}

function AdminDashboard() {
  const [admin, setAdmin] = useLocalState(ADMIN_KEY, false);
  const [users] = useLocalState(USERS_KEY, []);
  const [orders, setOrders] = useLocalState(ORDERS_KEY, []);
  const [returns] = useLocalState(RETURNS_KEY, []);
  if (!admin) return <Navigate to="/admin-login" />;
  const good = users.filter((user) => user.status === 'good' || user.risk <= 30).length;
  const medium = users.filter((user) => user.risk > 30 && user.risk <= 70).length;
  const fraudUsers = users.filter((user) => user.risk > 70 || user.status === 'fraud').length + returns.filter((item) => item.result.score > 70).length;
  const pendingAdmin = orders.filter((order) => order.status === 'Waiting for admin confirmation');
  const waiting = orders.filter((order) => !isDeliveredOrder(order)).length;
  const received = orders.filter((order) => isDeliveredOrder(order)).length;
  const confirmOrder = (orderId, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const saved = saveAdminConfirmedOrder(orderId);
    if (!saved) {
      notify('Order could not be found. Refresh admin page and try again.');
      return;
    }
    setOrders(saved.updatedOrders);
    notify('Order confirmed by admin. Sent to delivery partner.');
  };
  const approveFoodRefund = (returnId, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const currentReturns = Array.isArray(readStore(RETURNS_KEY, [])) ? readStore(RETURNS_KEY, []) : returns;
    const target = currentReturns.find((item) => item.id === returnId);
    if (!target) {
      notify('Return case could not be found.');
      return;
    }
    const approvedAt = nowStamp();
    const updatedReturns = currentReturns.map((item) => item.id === returnId ? {
      ...item,
      status: 'Refund approved by admin - within 12 hours',
      adminDecision: 'Approved',
      adminApprovedAt: approvedAt,
      result: {
        ...(item.result || {}),
        score: 0,
        level: 'Low',
        tone: 'good',
        decision: 'Refund Approved',
        explanation: 'Admin approved the food return video proof. Refund will be initiated within 12 hours.',
        triggeredConditions: ['Food return video proof reviewed and approved by admin.']
      }
    } : item);
    const currentOrders = Array.isArray(readStore(ORDERS_KEY, [])) ? readStore(ORDERS_KEY, []) : orders;
    const updatedOrders = currentOrders.map((order) => order.id === target.orderId ? { ...order, status: 'Returned', returnedAt: approvedAt, refundStatus: 'Money will be refunded within 12 hours' } : order);
    writeStore(RETURNS_KEY, updatedReturns);
    writeStore(ORDERS_KEY, updatedOrders);
    window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: RETURNS_KEY, value: updatedReturns } }));
    window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
    setReturns(updatedReturns);
    setOrders(updatedOrders);
    notify('Food refund approved. Refund will be initiated within 12 hours.');
  };
  return (
    <PortalShell type="admin">
      <main>
        <section className="section-head"><h1>Admin website</h1><button className="ghost" onClick={() => setAdmin(false)}><LogOut size={18} /> Logout</button></section>
        <section className="admin-stats">
          <Stat icon={User} label="Registered customers" value={users.length} />
          <Stat icon={CheckCircle2} label="Good users" value={good} />
          <Stat icon={AlertTriangle} label="Medium users" value={medium} />
          <Stat icon={XCircle} label="Fraud marked users" value={fraudUsers} />
          <Stat icon={Lock} label="Admin pending" value={pendingAdmin.length} />
          <Stat icon={Truck} label="Waiting orders" value={waiting} />
          <Stat icon={PackageCheck} label="Received orders" value={received} />
          <Stat icon={ShieldCheck} label="Return cases" value={returns.length} />
        </section>
        <AdminOrderApprovals orders={pendingAdmin} onConfirm={confirmOrder} />
        <AdminOrderStatusTable orders={orders} />
        <AdminOrderProofLookup orders={orders} />
        <AdminBillQrPanel orders={orders} />
        <section className="charts"><Chart title="User risk split" rows={[['Good', good || 1], ['Medium', medium || 1], ['Fraud', fraudUsers || 1]]} /><Chart title="Order status" rows={[['Waiting', waiting || 1], ['Delivered', received || 1], ['Returns', returns.length || 1]]} /></section>
        <AdminTable returns={returns} orders={orders} onApproveFoodRefund={approveFoodRefund} />
      </main>
    </PortalShell>
  );
}

function AdminOrderProofLookup({ orders }) {
  const [query, setQuery] = useState('');
  const order = orders.find((item) => item.id.toLowerCase() === query.trim().toLowerCase());
  const product = order ? findCatalogProduct(order.productId) : null;
  return (
    <section className="approval-panel">
      <div className="section-head compact-head">
        <div>
          <h2>Order proof lookup</h2>
          <span>Search any order ID to access bill QR, delivery proof, and seller package/open-box photos anytime.</span>
        </div>
      </div>
      <div className="seller-proof-search">
        <Search size={19} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exact order ID" />
      </div>
      {query && !order && <div className="alert"><AlertTriangle size={18} /> No order found for this ID.</div>}
      {order && product && (
        <div className="seller-proof-workspace">
          <article className="line-card">
            <img src={product.image} alt={product.name} />
            <div>
              <h3>{product.name}</h3>
              <p>{order.id} · {order.customer} · {order.status}</p>
              <strong>{money(product.price)}</strong>
            </div>
          </article>
          <BillQrCard order={order} />
          <DeliveryProofPreview order={order} />
          <SellerProofPreview order={order} product={product} />
        </div>
      )}
    </section>
  );
}

function AdminOrderApprovals({ orders, onConfirm }) {
  return (
    <section className="approval-panel">
      <div className="section-head compact-head">
        <h2>Order confirmation queue</h2>
        <span>User orders appear here first. Confirmed orders move to the delivery partner portal.</span>
      </div>
      <div className="stack">
        {orders.map((order) => {
          const product = findCatalogProduct(order.productId);
          return (
            <article className="line-card" key={order.id}>
              <img src={product.image} alt={product.name} />
              <div>
                <h3>{product.name}</h3>
                <p>{order.customer} · {order.location} · {order.payment}</p>
                <strong>{money(product.price)}</strong>
              </div>
              <button type="button" className="primary small force-click" onPointerDown={(event) => onConfirm(order.id, event)} onClick={(event) => onConfirm(order.id, event)}>Confirm order</button>
            </article>
          );
        })}
        {!orders.length && <section className="empty small-empty"><PackageCheck size={34} /><h2>No orders waiting for admin confirmation</h2></section>}
      </div>
    </section>
  );
}

function AdminOrderStatusTable({ orders }) {
  return (
    <section className="table-wrap admin-order-status">
      <div className="section-head compact-head">
        <div>
          <h2>Customer orders and delivery status</h2>
          <span>Admin can see who ordered each product and where the delivery currently stands.</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Product</th>
            <th>Payment</th>
            <th>Location</th>
            <th>Delivery Status</th>
            <th>Placed At</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const product = findCatalogProduct(order.productId);
            const status = orderDisplayStatus(order);
            return (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.customer || 'Customer'}</td>
                <td>{maskPhone(order.phone)}</td>
                <td>{product?.name || order.productId}</td>
                <td>{order.payment}</td>
                <td>{order.location}</td>
                <td><span className={status === 'Delivered' ? 'status-pill good' : 'status-pill'}>{status}</span></td>
                <td>{order.placedAt || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!orders.length && <p>No customer orders yet.</p>}
    </section>
  );
}

function AdminBillQrPanel({ orders }) {
  const tracked = orders.slice(-6).reverse();
  return (
    <section className="approval-panel">
      <div className="section-head compact-head">
        <h2>Bill QR monitor</h2>
        <span>Admin-only view of generated online bill QR codes.</span>
      </div>
      <div className="admin-track-grid">
        {tracked.map((order) => {
          const product = findCatalogProduct(order.productId);
          return (
            <article className="admin-track-card" key={order.id}>
              <img src={product?.image} alt={product?.name} />
              <div>
                <strong>{product?.name}</strong>
                <span>{order.customer} · {order.status}</span>
                <small>{order.receiptId || 'Bill pending'}</small>
              </div>
              <img className="mini-qr" src={getDeliveredBill(order).billQrImage} alt="Bill QR" />
            </article>
          );
        })}
        {!tracked.length && <section className="empty small-empty"><ShieldCheck size={34} /><h2>No bill QR records yet</h2></section>}
      </div>
    </section>
  );
}

function DeliveryDashboard({ returnsMode = false }) {
  const [orders, setOrders] = useLocalState(ORDERS_KEY, []);
  const [returns, setReturns] = useLocalState(RETURNS_KEY, []);
  const deliveryTasks = orders.filter((order) => !isDeliveredOrder(order) && (order.status === 'Waiting for delivery partner' || order.status === 'Out for delivery'));
  const returnTasks = returns.filter((item) => item.status === 'Partner visit requested' || item.status === 'Food proof submitted - waiting for admin and ZippGo approval');
  const tasks = returnsMode ? returnTasks : deliveryTasks;
  return (
    <PortalShell type="delivery">
      <main>
        <section className="section-head"><h1>Delivery partner portal</h1><span>Delivery and return pickup are handled in separate sections.</span></section>
        <section className="delivery-tabs">
          <Link className={!returnsMode ? 'active' : ''} to="/delivery">
            <Truck size={22} />
            <strong>Delivery</strong>
            <span>{deliveryTasks.length} confirmed order{deliveryTasks.length === 1 ? '' : 's'} waiting</span>
          </Link>
          <Link className={returnsMode ? 'active' : ''} to="/delivery/returns">
            <PackageCheck size={22} />
            <strong>Return</strong>
            <span>{returnTasks.length} request{returnTasks.length === 1 ? '' : 's'} waiting</span>
          </Link>
        </section>
        <section className="section-head compact-head"><h2>{returnsMode ? 'Return pickup verification' : 'Delivery orders'}</h2><span>{returnsMode ? 'Visit the customer location and confirm product details before pickup.' : 'Only admin-confirmed orders appear here.'}</span></section>
        <section className="stack">
          {tasks.map((task) => {
            const order = returnsMode ? orders.find((item) => item.id === task.orderId) : task;
            const product = findCatalogProduct(order?.productId);
            return <DeliveryTask key={task.id} task={task} order={order} product={product} returnsMode={returnsMode} setOrders={setOrders} orders={orders} setReturns={setReturns} returnsList={returns} />;
          })}
          {!tasks.length && <section className="empty"><Package size={38} /><h2>{returnsMode ? 'No return requests yet' : 'No delivery orders yet'}</h2></section>}
        </section>
      </main>
    </PortalShell>
  );
}

function DeliveryTask({ task, order, product, returnsMode, setOrders, orders, setReturns, returnsList }) {
  const deliveryFinishRef = useRef(false);
  const returnFinishRef = useRef(false);
  const [form, setForm] = useState({
    otp: '',
    productType: normalizeCategory(product?.category || 'Electronics'),
    photo: false,
    packagePhoto: false,
    deliveryPhotoPreview: '',
    deliveryPackagePreview: '',
    returnPhotoPreview: '',
    returnComparisonPreview: '',
    serial: false,
    workingVideo: false,
    serialPreview: '',
    workingVideoPreview: '',
    productMatches: 'Yes',
    noDamage: 'Yes',
    noStains: 'Yes',
    visualResult: 'Match',
    tagCondition: 'Present',
    after24Hours: 'No',
    serialMatches: 'Yes',
    usageHigh: 'No',
    scratchesOrDirt: 'No',
    soleWorn: 'No',
    colourMatches: 'Yes',
  });
  if (!order || !product) return null;
  const returnPolicy = getDynamicReturnPolicy(product);
  const productFamily = returnPolicy.family;
  const otpVerified = Boolean(order.otpSentAt && form.otp === order.deliveryOtp);
  const returnOtpVerified = Boolean(returnsMode && form.otp === order.deliveryOtp);
  const deliveryImageUploaded = Boolean(form.photo && form.deliveryPhotoPreview);
  const deliveryRequiredMissing = [
    !otpVerified && 'customer OTP',
    !deliveryImageUploaded && 'product photo'
  ].filter(Boolean);
  const deliveryOk = deliveryRequiredMissing.length === 0;
  const productSpecificOk =
    (productFamily !== 'Fashion' || (form.tagCondition === 'Present' && form.after24Hours === 'No')) &&
    (productFamily !== 'Electronics' || (form.serialMatches === 'Yes' && form.usageHigh === 'No')) &&
    (productFamily !== 'Tools' || form.scratchesOrDirt === 'No');
  const imageAuthentic = form.colourMatches === 'Yes';
  const reverseRejected = Boolean(form.reverseImageMatch);
  const returnMatched = form.photo && form.visualResult === 'Match' && form.productMatches === 'Yes' && imageAuthentic && !reverseRejected;
  const returnOk = returnOtpVerified && returnMatched && productSpecificOk;
  const sendOtp = () => {
    setOrders((currentOrders) => currentOrders.map((item) => item.id === order.id ? { ...item, status: 'Waiting for delivery partner', deliveryOtp: item.deliveryOtp || generateOtp(), otpSentAt: nowStamp() } : item));
    notify(`OTP sent to ${maskPhone(order.phone)}`);
  };
  const finishDelivery = (completionReason = 'OTP and delivery images verified', proofForm = form) => {
    if (returnsMode || isDeliveredOrder(order)) return false;
    if (deliveryFinishRef.current) return false;
    deliveryFinishRef.current = true;
    const deliveredAt = nowStamp();
    const saved = saveDeliveredOrder(order.id, {
      deliveredAt,
      form: proofForm,
      product,
      completionReason
    });
    if (!saved) {
      deliveryFinishRef.current = false;
      notify('Order could not be found. Refresh delivery portal and try again.');
      return false;
    }
    setOrders(saved.updatedOrders);
    notify('Delivery completed. Customer order is now Delivered.');
    return true;
  };
  const updateDeliveryProof = (patch, completionReason) => {
    const nextForm = { ...form, ...patch };
    setForm(nextForm);
    const proofReady =
      !returnsMode &&
      !isDeliveredOrder(order) &&
      Boolean(order.otpSentAt && nextForm.otp === order.deliveryOtp) &&
      Boolean(nextForm.photo && nextForm.deliveryPhotoPreview);
    if (proofReady) {
      window.setTimeout(() => finishDelivery(completionReason, nextForm), 0);
    }
  };
  const completeDelivery = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    finishDelivery('Delivery force completed by partner');
    window.setTimeout(() => {
      window.location.href = '/delivery';
    }, 80);
  };
  const completeReturn = (approved = returnOk, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (returnFinishRef.current) return;
    returnFinishRef.current = true;
    const storedDeliveryPhoto = getStoredDeliveryPhoto(order, product);
    const compactReturnPhoto = compactImageData(form.returnPhotoPreview);
    const partnerRequest = {
      reason: task.request?.reason || 'Return requested',
      typedReason: task.request?.typedReason || '',
      receiptId: task.request?.receiptId || order.receiptId,
      receiptHash: task.request?.receiptHash || order.receiptHash,
      billQrValue: task.request?.billQrValue || order.billQrValue,
      uploadedBillQrValue: task.request?.uploadedBillQrValue,
      billQrMatched: task.request?.billQrMatched,
      uploadedBillQrImageName: task.request?.uploadedBillQrImageName,
      liveCaptureDone: task.request?.liveCaptureDone,
      liveCaptureAnalysis: task.request?.liveCaptureAnalysis ? {
        status: task.request.liveCaptureAnalysis.status,
        riskScore: task.request.liveCaptureAnalysis.riskScore,
        decision: task.request.liveCaptureAnalysis.decision,
        productMatchConfidence: task.request.liveCaptureAnalysis.productMatchConfidence,
        productMatchReason: task.request.liveCaptureAnalysis.productMatchReason,
        capturedImage: compactImageData(task.request.liveCaptureAnalysis.capturedImage),
        recordedVideoDataUrl: compactImageData(task.request.liveCaptureAnalysis.recordedVideoDataUrl, 900000),
        recordedVideoUrl: task.request.liveCaptureAnalysis.recordedVideoDataUrl ? '' : task.request.liveCaptureAnalysis.recordedVideoUrl
      } : null,
      partnerVerificationPending: false,
      visualResult: form.visualResult,
      productMatches: form.productMatches,
      noDamage: form.noDamage,
      noStains: form.noStains,
      tagPhoto: productFamily === 'Fashion' && form.tagCondition === 'Present',
      tagCondition: form.tagCondition,
      after24Hours: form.after24Hours === 'Yes',
      serialMatches: form.serialMatches,
      usageHigh: form.usageHigh,
      scratchesOrDirt: form.scratchesOrDirt === 'Yes',
      soleWorn: form.soleWorn === 'Yes',
      colorMismatch: form.colourMatches === 'No',
      reverseImageMatch: form.reverseImageMatch,
      reverseLookup: form.reverseLookup,
      returnPhoto: compactReturnPhoto,
      deliveryComparisonPhoto: '',
      imageQualityGood: approved ? true : returnOk,
      returnOtpVerified,
      duplicatePassed: true
    };
    const baseResult = form.reverseImageMatch ? reverseImageRejectResult(form.reverseLookup) : calculateFraudRisk({ product, order, proof: order.deliveryProof, returnRequest: partnerRequest });
    const result = approved && isFoodProduct(product) && !form.reverseImageMatch ? {
      ...baseResult,
      score: 0,
      level: 'Low',
      decision: 'Refund Approved',
      tone: 'good',
      explanation: 'Food proof video was verified and approved by ZippGo. Refund will be initiated within 12 hours.',
      triggeredConditions: ['Customer app-only video proof sent to delivery partner and approved.']
    } : baseResult;
    const partnerCancelled = !approved;
    const partnerDecision = partnerCancelled ? 'Cancelled' : 'Accepted';
    const status = approved && isFoodProduct(product) && !form.reverseImageMatch
      ? 'Refund approved by ZippGo - within 12 hours'
      : partnerCancelled
      ? 'Return closed - cancelled by delivery partner'
      : result.decision === 'Reject / Investigate'
        ? 'Return closed - sent for investigation'
        : 'Return accepted by delivery partner';
    const updatedReturnCase = {
      ...task,
      request: partnerRequest,
      result,
      status,
      partnerDecision,
      closedAt: nowStamp(),
      pickupStatus: form.reverseImageMatch ? 'Return rejected automatically because reverse image lookup matched an online source' : (approved && isFoodProduct(product) ? 'Food video proof approved by ZippGo. Refund will be initiated within 12 hours.' : (approved ? 'Return approved after pickup verification' : 'Return closed and cleared from pickup queue because image/check verification failed')),
      deliveryPartnerChecks: {
        productType: form.productType,
        productMatches: form.productMatches,
        noDamage: form.noDamage,
        noStains: form.noStains,
        visualResult: form.visualResult,
        tagCondition: form.tagCondition,
        after24Hours: form.after24Hours,
        serialMatches: form.serialMatches,
        usageHigh: form.usageHigh,
        scratchesOrDirt: form.scratchesOrDirt,
        colourMatches: form.colourMatches,
        reverseLookup: form.reverseLookup,
        reverseImageMatch: form.reverseImageMatch,
        returnPhoto: compactReturnPhoto,
        deliveryComparisonPhoto: ''
      }
    };
    const currentReturns = Array.isArray(readStore(RETURNS_KEY, [])) ? readStore(RETURNS_KEY, []) : returnsList;
    const updatedReturns = currentReturns.map((item) => item.id === task.id ? updatedReturnCase : item);
    try {
      writeStore(RETURNS_KEY, updatedReturns);
      window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: RETURNS_KEY, value: updatedReturns } }));
      setReturns(updatedReturns);
      if (approved && !form.reverseImageMatch) {
        const currentOrders = Array.isArray(readStore(ORDERS_KEY, [])) ? readStore(ORDERS_KEY, []) : orders;
        const updatedOrders = currentOrders.map((item) => item.id === order.id ? { ...item, status: 'Returned', returnedAt: nowStamp(), returnApproved: true } : item);
        writeStore(ORDERS_KEY, updatedOrders);
        window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
        setOrders(updatedOrders);
      }
    } catch {
      try {
        const minimalReturnCase = {
          id: task.id,
          orderId: task.orderId,
          productId: task.productId,
          customer: task.customer,
          location: task.location,
          request: {
            reason: partnerRequest.reason,
            typedReason: partnerRequest.typedReason,
            visualResult: partnerRequest.visualResult,
            productMatches: partnerRequest.productMatches,
            returnOtpVerified: partnerRequest.returnOtpVerified
          },
          result,
          status,
          partnerDecision,
          closedAt: nowStamp(),
          pickupStatus: approved ? 'Return approved after pickup verification' : 'Return cancelled by delivery partner',
          deliveryPartnerChecks: {
            visualResult: form.visualResult,
            productMatches: form.productMatches,
            noDamage: form.noDamage,
            noStains: form.noStains
          }
        };
        const minimalReturns = currentReturns.map((item) => item.id === task.id ? minimalReturnCase : item);
        writeStore(RETURNS_KEY, minimalReturns);
        window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: RETURNS_KEY, value: minimalReturns } }));
        setReturns(minimalReturns);
        if (approved && !form.reverseImageMatch) {
          const currentOrders = Array.isArray(readStore(ORDERS_KEY, [])) ? readStore(ORDERS_KEY, []) : orders;
          const updatedOrders = currentOrders.map((item) => item.id === order.id ? { ...item, status: 'Returned', returnedAt: nowStamp(), returnApproved: true } : item);
          writeStore(ORDERS_KEY, updatedOrders);
          window.dispatchEvent(new CustomEvent('devx-store-change', { detail: { key: ORDERS_KEY, value: updatedOrders } }));
          setOrders(updatedOrders);
        }
      } catch {
        returnFinishRef.current = false;
        notify('Return action could not be saved. Clear old browser storage and try again.');
        return;
      }
    }
    notify(form.reverseImageMatch ? 'Reverse image match found. Return rejected automatically.' : (approved ? 'Return approved and cleared from pickup queue' : 'Return cancelled, closed, and cleared from pickup queue'));
    window.setTimeout(() => {
      window.location.href = '/delivery/returns';
    }, 80);
  };
  useEffect(() => {
    if (!returnsMode || !form.reverseImageMatch || form.reverseAutoClosed) return;
    setForm((current) => ({ ...current, reverseAutoClosed: true }));
    window.setTimeout(() => completeReturn(false), 0);
  }, [returnsMode, form.reverseImageMatch, form.reverseAutoClosed]);
  return (
    <article className="delivery-task">
      <img src={product.image} alt={product.name} />
      <div className="delivery-task-body">
        <h2>{product.name}</h2>
        <p>{order.customer} · {order.address} · ETA {getDeliveryEstimate(order.location, product.warehouseLocation)}</p>
        <select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}><option>Fashion</option><option>Electronics</option><option>Tools</option><option>Food & Beverages</option></select>
        {returnsMode ? <ReturnPartnerChecks product={product} order={order} task={task} form={form} setForm={setForm} returnOtpVerified={returnOtpVerified} /> : <DeliveryPartnerChecks product={product} order={order} form={form} setForm={updateDeliveryProof} otpVerified={otpVerified} onSendOtp={sendOtp} />}
        <div className="button-row">
          {!returnsMode && <a href="/delivery" className="primary force-click" onMouseDown={completeDelivery} onTouchStart={completeDelivery} onClick={completeDelivery}>Continue</a>}
          {!returnsMode && !deliveryOk && <span className="policy-note">Enter all delivery details: {deliveryRequiredMissing.join(', ')}.</span>}
          {!returnsMode && deliveryOk && <span className="policy-note">OTP and delivery images are complete. Tap Continue to finish delivery.</span>}
          {returnsMode && <>
            <button type="button" className="primary force-click return-action-button" onPointerDown={(event) => completeReturn(true, event)} onMouseDown={(event) => completeReturn(true, event)} onTouchStart={(event) => completeReturn(true, event)} onClick={(event) => completeReturn(true, event)}>Approve return</button>
            <button type="button" className="secondary force-click return-action-button" onPointerDown={(event) => completeReturn(false, event)} onMouseDown={(event) => completeReturn(false, event)} onTouchStart={(event) => completeReturn(false, event)} onClick={(event) => completeReturn(false, event)}>Cancel return</button>
          </>}
        </div>
      </div>
    </article>
  );
}

function DeliveryPartnerChecks({ product, order, form, setForm, otpVerified, onSendOtp }) {
  return (
    <div className="mock-checks">
      <div className="otp-verify">
        <strong>Customer OTP verification</strong>
        <span>{order.otpSentAt ? `OTP sent to ${maskPhone(order.phone)} at ${order.otpSentAt}` : `Send OTP to ${maskPhone(order.phone)} when you reach the customer.`}</span>
        <button type="button" className="secondary small" onClick={onSendOtp}>{order.otpSentAt ? 'Resend OTP' : 'Send OTP'}</button>
      </div>
      <OtpInput label="Enter customer OTP" value={form.otp} onChange={(otp) => setForm({ ...form, otp })} />
      <div className={otpVerified ? 'status-pill good' : 'status-pill'}>{otpVerified ? 'OTP verified' : 'OTP not verified'}</div>
      <FileMock label="Take product photo" done={form.photo} onDone={(_, preview) => setForm({ ...form, photo: true, deliveryPhotoPreview: preview })} />
      <span className="policy-note">Delivery completes with OTP and one product photo. Tap Continue after uploading.</span>
    </div>
  );
}

function ReturnPartnerChecks({ product, order, task, form, setForm, returnOtpVerified }) {
  const checklist = getPickupChecklist(product);
  const productFamily = getDynamicReturnPolicy(product).family;
  const storedDeliveryPhoto = getStoredDeliveryPhoto(order, product);
  return (
    <div className="mock-checks">
      <div className="otp-verify">
        <strong>Return pickup OTP verification</strong>
        <span>Ask the customer for the original delivery OTP. Return pickup is allowed only when it matches.</span>
      </div>
      <OtpInput label="Re-enter original delivery OTP" value={form.otp} onChange={(otp) => setForm({ ...form, otp })} />
      <div className={returnOtpVerified ? 'status-pill good' : 'status-pill danger'}>{returnOtpVerified ? 'Return OTP matched' : 'Return OTP not matched'}</div>
      {task.request?.liveCaptureAnalysis && (
        <section className="customer-proof-summary">
          {task.request.liveCaptureAnalysis.recordedVideoDataUrl || task.request.liveCaptureAnalysis.recordedVideoUrl ? (
            <video className="customer-proof-video" src={task.request.liveCaptureAnalysis.recordedVideoDataUrl || task.request.liveCaptureAnalysis.recordedVideoUrl} controls muted playsInline />
          ) : (
            <img src={task.request.issuePhotoPreview || task.request.liveCaptureAnalysis.capturedImage || product.image} alt="Customer live return proof" />
          )}
          <div>
            <strong>Customer video proof sent to delivery partner</strong>
            <span>{task.result?.decision} · Same-product confidence {task.request.liveCaptureAnalysis.productMatchConfidence || 0}%</span>
            <small>{task.request.liveCaptureAnalysis.productMatchReason}</small>
          </div>
        </section>
      )}
      {order.sellerProof && <SellerProofPreview order={order} product={product} />}
      <section className="compare partner-compare">
        <figure>
          {storedDeliveryPhoto ? <img src={storedDeliveryPhoto} alt="Stored delivery proof" /> : <div className="missing-proof">No uploaded delivery photo found</div>}
          <figcaption>Stored delivery image</figcaption>
        </figure>
        <figure><img src={form.returnPhotoPreview || product.image} alt="Return upload preview" /><figcaption>Return product image</figcaption></figure>
      </section>
      <section className="pickup-checklist">
        <strong>Pickup agent checklist</strong>
        {checklist.map((item) => <span key={item}><CheckCircle2 size={15} /> {item}</span>)}
      </section>
      <select value={form.visualResult} onChange={(e) => setForm({ ...form, visualResult: e.target.value })}><option>Match</option><option>Mismatch</option><option>Damage found</option><option>Manual review</option></select>
      <FileMock label="Take return product picture" done={form.photo} onDone={(file, preview) => {
        const lookup = simulateReverseImageLookup(file, preview, product);
        setForm({ ...form, photo: true, returnPhotoPreview: preview, reverseLookup: lookup, reverseImageMatch: lookup.matched });
      }} />
      {form.reverseLookup?.checked && (
        <div className={form.reverseImageMatch ? 'alert' : 'status-pill good'}>
          {form.reverseImageMatch ? <><XCircle size={18} /> Reverse image lookup matched an online source. Return is rejected automatically.</> : 'Reverse image lookup passed'}
        </div>
      )}
      <section className="customer-proof-summary">
        {storedDeliveryPhoto ? <img src={storedDeliveryPhoto} alt="Stored delivery product proof" /> : <div className="missing-proof compact">No uploaded delivery photo found</div>}
        <div>
          <strong>Delivery product photo loaded automatically</strong>
          <span>This is the photo uploaded by the delivery partner during delivery.</span>
        </div>
      </section>
      <YesNo label="Product matches delivery image" value={form.productMatches} onChange={(value) => setForm({ ...form, productMatches: value })} />
      <YesNo label="Colour match: cloth/product colour matches" value={form.colourMatches} onChange={(value) => setForm({ ...form, colourMatches: value })} />
      <YesNo label="Product without damage" value={form.noDamage} onChange={(value) => setForm({ ...form, noDamage: value })} />
      <YesNo label="Product without stains" value={form.noStains} onChange={(value) => setForm({ ...form, noStains: value })} />
      {productFamily === 'Fashion' && <>
        <select value={form.tagCondition} onChange={(e) => setForm({ ...form, tagCondition: e.target.value })}><option>Present</option><option>Missing</option><option>Removed</option><option>Damaged</option></select>
        <YesNo label="Return after 12 hours" value={form.after24Hours} onChange={(value) => setForm({ ...form, after24Hours: value })} />
      </>}
      {productFamily === 'Electronics' && <>
        <YesNo label="Serial number matches" value={form.serialMatches} onChange={(value) => setForm({ ...form, serialMatches: value })} />
        <YesNo label="Usage or activation is high" value={form.usageHigh} onChange={(value) => setForm({ ...form, usageHigh: value })} />
      </>}
      {productFamily === 'Tools' && <YesNo label="Scratches, dirt, or heavy usage marks" value={form.scratchesOrDirt} onChange={(value) => setForm({ ...form, scratchesOrDirt: value })} />}
      {(form.visualResult !== 'Match' || form.productMatches !== 'Yes' || form.colourMatches !== 'Yes') && <div className="alert"><XCircle size={18} /> Photo verification failed. Return is cancelled before risk score is finalized.</div>}
    </div>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div className="yes-no">
      <span>{label}</span>
      <div>
        <button type="button" className={value === 'Yes' ? 'active' : ''} onClick={() => onChange('Yes')}>Yes</button>
        <button type="button" className={value === 'No' ? 'active danger' : ''} onClick={() => onChange('No')}>No</button>
      </div>
    </div>
  );
}

function AdminTable({ returns, orders, onApproveFoodRefund }) {
  const rows = returns.length ? returns : [];
  return (
    <section className="table-wrap">
      <h2>Return and fraud cases</h2>
      <table>
        <thead><tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Delivery proof</th><th>Return proof</th><th>Food video</th><th>Location</th><th>Risk</th><th>Fraud type</th><th>Triggered reason</th><th>Decision</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const order = orders.find((item) => item.id === row.orderId);
            const product = findCatalogProduct(row.productId);
            const deliveryPhoto = order?.deliveryProof?.deliveryPhoto || row.request?.deliveryComparisonPhoto || '';
            const returnPhoto = row.request?.returnPhoto || row.deliveryPartnerChecks?.returnPhoto || '';
            const foodAwaitingApproval = isFoodProduct(product) && row.status === 'Food proof submitted - waiting for admin and ZippGo approval';
            return (
              <tr key={row.id}>
                <td>{row.orderId}</td>
                <td>{row.customer}</td>
                <td>{product?.name}</td>
                <td><EvidenceThumb src={deliveryPhoto} label="Delivery image" /></td>
                <td><EvidenceThumb src={returnPhoto} label="Return image" /></td>
                <td><FoodVideoEvidence analysis={row.request?.liveCaptureAnalysis} /></td>
                <td>{row.location}</td>
                <td>{row.result.pending ? 'Pending' : row.result.score}</td>
                <td>{row.result.fraudTypeText || 'No fraud type detected'}</td>
                <td>{row.result.triggeredConditions?.[0] || row.request.reason}</td>
                <td>{row.status || row.result.decision}</td>
                <td>{foodAwaitingApproval ? <button type="button" className="primary small force-click" onClick={(event) => onApproveFoodRefund?.(row.id, event)}>Approve refund</button> : <span className="status-pill">{row.adminDecision || row.partnerDecision || 'No action'}</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <p>No return cases yet.</p>}
    </section>
  );
}

function EvidenceThumb({ src, label }) {
  return (
    <figure className="admin-proof-thumb">
      {src ? <img src={src} alt={label} /> : <div className="missing-proof tiny">No uploaded image</div>}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function FoodVideoEvidence({ analysis }) {
  if (!analysis) return <div className="missing-proof tiny">No food video</div>;
  const videoSrc = analysis.recordedVideoDataUrl || analysis.recordedVideoUrl || '';
  return (
    <figure className="admin-proof-thumb">
      {videoSrc ? (
        <video className="admin-proof-video" src={videoSrc} controls muted playsInline />
      ) : analysis.capturedImage ? (
        <img src={analysis.capturedImage} alt="Food video proof frame" />
      ) : (
        <div className="missing-proof tiny">Video metadata only</div>
      )}
      <figcaption>{analysis.decision || analysis.riskLevel || 'Food proof'}</figcaption>
    </figure>
  );
}

function SellerIntegrityDashboard() {
  const [admin] = useLocalState(ADMIN_KEY, false);
  const [registeredSellers] = useLocalState(SELLERS_KEY, []);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const registeredSellerRows = useMemo(() => {
    return registeredSellers.map((seller) => ({
      sellerId: seller.sellerId,
      sellerName: seller.shopName,
      location: seller.pickupLocation,
      category: seller.category,
      totalOrders: 0,
      cancellationRate: 0,
      lateDispatchRate: 0,
      returnDisputes: 0,
      wrongProductCount: 0,
      missingAccessoryCount: 0,
      orderedSku: 'ONBOARDING-SKU',
      dispatchSku: 'ONBOARDING-SKU',
      invoiceMismatch: false,
      fakeListingDetected: false,
      fakeReviewDetected: false,
      packageWeightMismatch: false,
      sellerFalseDamageClaim: false,
      riskScore: 0,
      riskLevel: 'Trusted',
      fraudTypes: [],
      decision: seller.status,
      triggeredSignals: ['Seller registered and waiting for first dispatch proof.'],
      evidence: {
        orderedProductImage: products[0].image,
        sellerDispatchImage: products[0].image,
        packageImage: products[0].image,
        invoiceVerificationStatus: `GST ${seller.gstNumber} captured`,
        skuMatchStatus: 'No dispatch yet',
        serialNumberStatus: 'Pending first order',
        accessoryChecklist: ['Business profile', 'GST number', 'Pickup address', 'Bank details'],
        packageWeight: 'Pending',
        courierScanWeight: 'Pending',
        customerComplaint: 'No complaints yet.',
        sellerResponse: seller.description || 'Seller onboarding completed.',
        finalPlatformDecision: seller.status
      }
    }));
  }, [registeredSellers]);
  if (!admin) return <Navigate to="/admin-login" />;

  const trusted = registeredSellerRows.filter((seller) => seller.riskScore <= 30).length;
  const watchlist = registeredSellerRows.filter((seller) => seller.riskScore > 30 && seller.riskScore <= 70).length;
  const suspended = registeredSellerRows.filter((seller) => seller.riskScore >= 71).length;
  const activeAlerts = registeredSellerRows.reduce((sum, seller) => sum + seller.fraudTypes.length, 0);
  const returnDisputes = registeredSellerRows.reduce((sum, seller) => sum + seller.returnDisputes, 0);

  return (
    <PortalShell type="admin">
      <main>
        <section className="section-head seller-head">
          <div>
            <h1>Seller Integrity Dashboard</h1>
            <span>Detect seller-side fraud using dispatch proof, invoice verification, product matching, and dispute history.</span>
          </div>
        </section>

        <section className="admin-stats">
          <Stat icon={User} label="Registered Shops" value={registeredSellerRows.length} />
          <Stat icon={ShieldCheck} label="Trusted Shops" value={trusted} />
          <Stat icon={AlertTriangle} label="Watchlist Shops" value={watchlist} />
          <Stat icon={XCircle} label="Suspended Shops" value={suspended} />
          <Stat icon={AlertTriangle} label="Active Fraud Alerts" value={activeAlerts} />
          <Stat icon={PackageCheck} label="Return Disputes" value={returnDisputes} />
        </section>

        <section className="seller-explain">
          <ShieldCheck size={28} />
          <div>
            <h2>Why seller fraud detection matters</h2>
            <p>Seller-side fraud can damage customer trust through wrong products, fake listings, missing accessories, fake invoices, and unfair return denial. TrustKart protects both customers and retailers by collecting proof at listing, packing, dispatch, delivery, and return stages.</p>
          </div>
        </section>

        <SellerRiskTable
          title="Registered Shops"
          subtitle="Only shops that joined through the seller registration page appear here."
          sellers={registeredSellerRows}
          onSelect={setSelectedSeller}
          emptyTitle="No shops registered yet"
        />
        {selectedSeller && <SellerEvidenceModal seller={selectedSeller} onClose={() => setSelectedSeller(null)} />}
      </main>
    </PortalShell>
  );
}

function SellerRiskTable({ title, subtitle, sellers, onSelect, emptyTitle }) {
  return (
    <section className="table-wrap seller-table">
      <div className="seller-table-head">
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {!sellers.length ? (
        <div className="empty small-empty">
          <PackageCheck size={34} />
          <h2>{emptyTitle}</h2>
          <Link className="primary small" to="/seller-register">Register a shop</Link>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Seller ID</th>
              <th>Seller Name</th>
              <th>Product Category</th>
              <th>Location</th>
              <th>Total Orders</th>
              <th>Return Disputes</th>
              <th>Fraud Type</th>
              <th>Risk Score</th>
              <th>Decision</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.sellerId}>
                <td>{seller.sellerId}</td>
                <td>{seller.sellerName}</td>
                <td>{seller.category}</td>
                <td>{seller.location}</td>
                <td>{seller.totalOrders}</td>
                <td>{seller.returnDisputes}</td>
                <td>{seller.fraudTypes.join(', ') || 'No fraud type detected'}</td>
                <td><RiskBadgeSeller seller={seller} /></td>
                <td>{seller.decision}</td>
                <td><button className="primary small" onClick={() => onSelect(seller)}>View Evidence</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RiskBadgeSeller({ seller }) {
  const tone = seller.riskScore <= 30 ? 'trusted' : seller.riskScore <= 70 ? 'watchlist' : 'suspended';
  return <span className={`seller-risk ${tone}`}>{seller.riskScore}</span>;
}

function ShopSpherePage() {
  const navigate = useNavigate();
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search).get('search') || '', []);
  const [query, setQuery] = useState(initialSearch);
  const [category, setCategory] = useState('All');
  const [priceRange, setPriceRange] = useState('All');
  const [productRating, setProductRating] = useState('All');
  const [shopRating, setShopRating] = useState('All');
  const [sort, setSort] = useState('Featured');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [toast, setToast] = useState('');
  const [cart, setCart] = useLocalState(CART_KEY, []);
  const [wish, setWish] = useLocalState(WISH_KEY, []);
  const categoriesList = useMemo(() => ['All', 'Electronics', 'Fashion', 'Tools', 'Food & Beverages'], []);
  const allShopProducts = useMemo(() => [...shopSphereProducts, ...foodBeverageProducts], []);
  const recommendations = useMemo(() => {
    if (!query.trim()) return [];
    const text = query.toLowerCase();
    return allShopProducts.filter((product) => `${product.productName} ${product.category} ${product.originalCategory || ''} ${product.shopName}`.toLowerCase().includes(text)).slice(0, 6);
  }, [query, allShopProducts]);
  const filteredProducts = useMemo(() => {
    let list = [...shopSphereProducts];
    const text = query.toLowerCase();
    if (text) list = list.filter((product) => `${product.productName} ${product.category} ${product.shopName}`.toLowerCase().includes(text));
    if (category !== 'All') list = list.filter((product) => product.category === category);
    if (priceRange === 'Under 5000') list = list.filter((product) => product.price < 5000);
    if (priceRange === '5000 to 20000') list = list.filter((product) => product.price >= 5000 && product.price <= 20000);
    if (priceRange === 'Above 20000') list = list.filter((product) => product.price > 20000);
    if (productRating === '4+') list = list.filter((product) => product.productRating >= 4);
    if (productRating === '4.5+') list = list.filter((product) => product.productRating >= 4.5);
    if (shopRating === '8+') list = list.filter((product) => product.shopDeliveryRating >= 8);
    if (shopRating === '9+') list = list.filter((product) => product.shopDeliveryRating >= 9);
    if (sort === 'Price Low to High') list.sort((a, b) => a.price - b.price);
    if (sort === 'Price High to Low') list.sort((a, b) => b.price - a.price);
    if (sort === 'Highest Product Rating') list.sort((a, b) => b.productRating - a.productRating);
    if (sort === 'Best Shop Delivery Rating') list.sort((a, b) => b.shopDeliveryRating - a.shopDeliveryRating);
    return list;
  }, [query, category, priceRange, productRating, shopRating, sort]);
  const filteredFoodProducts = useMemo(() => {
    let list = [...foodBeverageProducts];
    const text = query.toLowerCase();
    if (text) list = list.filter((product) => `${product.productName} ${product.category} ${product.originalCategory} ${product.shopName}`.toLowerCase().includes(text));
    if (category !== 'All' && category !== 'Food & Beverages') return [];
    if (priceRange === 'Under 5000') list = list.filter((product) => product.price < 5000);
    if (priceRange === '5000 to 20000') list = list.filter((product) => product.price >= 5000 && product.price <= 20000);
    if (priceRange === 'Above 20000') list = list.filter((product) => product.price > 20000);
    if (productRating === '4+') list = list.filter((product) => product.productRating >= 4);
    if (productRating === '4.5+') list = list.filter((product) => product.productRating >= 4.5);
    if (shopRating === '8+') list = list.filter((product) => product.shopDeliveryRating >= 8);
    if (shopRating === '9+') list = list.filter((product) => product.shopDeliveryRating >= 9);
    if (sort === 'Price Low to High') list.sort((a, b) => a.price - b.price);
    if (sort === 'Price High to Low') list.sort((a, b) => b.price - a.price);
    if (sort === 'Highest Product Rating') list.sort((a, b) => b.productRating - a.productRating);
    if (sort === 'Best Shop Delivery Rating') list.sort((a, b) => b.shopDeliveryRating - a.shopDeliveryRating);
    return list;
  }, [query, category, priceRange, productRating, shopRating, sort]);
  const addToCart = (product) => {
    addProductToCart(cart, setCart, product.productId);
    setToast(`${product.productName} added to cart`);
    window.clearTimeout(addToCart.timer);
    addToCart.timer = window.setTimeout(() => setToast(''), 1800);
  };
  const buyNow = (product) => {
    setCart([{ productId: product.productId, qty: 1 }]);
    writeStore(SHOPSPHERE_BUY_KEY, { productId: product.productId, productName: product.productName, shopName: product.shopName, price: product.price, startedAt: nowStamp() });
    notify(`Buying ${product.productName}`);
    navigate('/user/checkout');
  };
  const addWish = (product) => {
    setWish(wish.some((item) => item.productId === product.productId) ? wish : [...wish, { productId: product.productId }]);
    setToast(`${product.productName} added to wishlist`);
    window.clearTimeout(addWish.timer);
    addWish.timer = window.setTimeout(() => setToast(''), 1800);
  };

  return (
    <PortalShell type="user">
      <main className="shopsphere-page">
        <ShopSphereHeader query={query} setQuery={setQuery} recommendations={recommendations} onPick={(product) => setQuery(product.productName)} />
        <ShopSphereHero />
        <ShopSphereFilters categories={categoriesList} category={category} setCategory={setCategory} priceRange={priceRange} setPriceRange={setPriceRange} productRating={productRating} setProductRating={setProductRating} shopRating={shopRating} setShopRating={setShopRating} sort={sort} setSort={setSort} />
        {(category === 'All' || category === 'Food & Beverages') && (
          <FoodBeverageSection products={filteredFoodProducts} onAdd={addToCart} onBuy={buyNow} onWish={addWish} onView={setSelectedProduct} />
        )}
        <section id="shopsphere-products" className="shopsphere-results-head">
          <div>
            <h2>{filteredProducts.length} trusted products</h2>
            <p>Each card shows product trust, shop delivery performance, and customer review before purchase.</p>
          </div>
          <span>{shopSphereProducts.filter((product) => product.price > 20000).length} high-value products above Rs.20,000</span>
        </section>
        <ShopSphereProductGrid products={filteredProducts} onAdd={addToCart} onBuy={buyNow} onWish={addWish} onView={setSelectedProduct} />
        {selectedProduct && <ShopSphereProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} onBuy={buyNow} onWish={addWish} />}
        <ShopSphereToastNotification message={toast} />
      </main>
    </PortalShell>
  );
}

function ShopSphereHeader({ query, setQuery, recommendations, onPick }) {
  return (
    <header className="shopsphere-header">
      <Link to="/shopsphere" className="shopsphere-brand"><ShoppingBag size={32} /> ShopSphere</Link>
      <div className="shopsphere-search">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, categories, or shop names" />
        {!!recommendations.length && (
          <div className="shopsphere-suggestions">
            {recommendations.map((product) => (
              <button type="button" key={product.productId} onClick={() => onPick(product)}>
                <img src={product.productImage} alt={product.productName} />
                <span>{product.productName}</span>
                <small>{product.shopName}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="shopsphere-icons">
        <button type="button"><ShoppingCart size={22} /></button>
        <button type="button"><User size={22} /></button>
      </div>
    </header>
  );
}

function ShopSphereHero() {
  return (
    <section className="shopsphere-hero">
      <div>
        <span>Verified seller marketplace</span>
        <h1>Discover Trusted Products from Verified Shops</h1>
        <p>Compare product ratings, shop delivery performance, and customer reviews before buying.</p>
        <a className="primary shopsphere-cta" href="#shopsphere-products">Explore Products</a>
      </div>
      <aside>
        <strong>40</strong>
        <span>verified products</span>
        <p>30 marketplace products plus 10 fresh food, egg, fruit, and restaurant-style delivery items with live return proof.</p>
      </aside>
    </section>
  );
}

function ShopSphereFilters({ categories: categoryItems, category, setCategory, priceRange, setPriceRange, productRating, setProductRating, shopRating, setShopRating, sort, setSort }) {
  return (
    <section className="shopsphere-filters">
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categoryItems.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Price range<select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}><option>All</option><option>Under 5000</option><option>5000 to 20000</option><option>Above 20000</option></select></label>
      <label>Product rating<select value={productRating} onChange={(event) => setProductRating(event.target.value)}><option>All</option><option>4+</option><option>4.5+</option></select></label>
      <label>Shop delivery rating<select value={shopRating} onChange={(event) => setShopRating(event.target.value)}><option>All</option><option>8+</option><option>9+</option></select></label>
      <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option>Featured</option><option>Price Low to High</option><option>Price High to Low</option><option>Highest Product Rating</option><option>Best Shop Delivery Rating</option></select></label>
    </section>
  );
}

function ShopSphereProductGrid({ products: items, onAdd, onBuy, onWish, onView }) {
  return (
    <section className="shopsphere-grid">
      {items.map((product) => <ShopSphereProductCard key={product.productId} product={product} onAdd={onAdd} onBuy={onBuy} onWish={onWish} onView={onView} />)}
      {!items.length && <section className="empty"><Search size={38} /><h2>No matching products</h2><p>Try another category, shop, or price range.</p></section>}
    </section>
  );
}

function FoodBeverageSection({ products: items, onAdd, onBuy, onWish, onView }) {
  return (
    <section className="food-section" id="food-beverages">
      <div className="section-head compact-head">
        <div>
          <h2>Food & Beverages</h2>
          <span>Fresh meals, eggs, fruits, and natural beverages only. Packet items are removed, and returns require live-camera verification.</span>
        </div>
        <strong>{items.length}/10 products shown</strong>
      </div>
      <div className="food-grid">
        {items.map((product) => <FoodProductCard key={product.productId} product={product} onAdd={onAdd} onBuy={onBuy} onWish={onWish} onView={onView} />)}
        {!items.length && <section className="empty"><Search size={38} /><h2>No food products matched</h2><p>Clear filters to see all 10 food and beverage cards.</p></section>}
      </div>
    </section>
  );
}

function FoodProductCard({ product, onAdd, onBuy, onWish, onView }) {
  return (
    <article className="food-card">
      <button type="button" className="favorite-float" onClick={() => onWish(product)} title="Add to wishlist"><Heart size={18} /></button>
      <img src={product.productImage} alt={product.productName} />
      <div className="food-card-body">
        <span className="category-badge">{product.originalCategory}</span>
        <h3>{product.productName}</h3>
        <small>{product.shopName}</small>
        <strong className="shopsphere-price">{money(product.price)}</strong>
        <StarRating value={product.productRating} />
        <p className="shopsphere-review">"{product.customerReview}"</p>
        <div className="shopsphere-actions">
          <button type="button" className="secondary" onClick={() => onAdd(product)}>Add to Cart</button>
          <button type="button" className="primary buy-now" onClick={() => onBuy(product)}>Buy Now</button>
          <button type="button" className="secondary" onClick={() => onView(product)}>View Details</button>
        </div>
      </div>
    </article>
  );
}

function ShopSphereProductCard({ product, onAdd, onBuy, onWish, onView }) {
  return (
    <article className="shopsphere-card">
      <div className="shopsphere-image-wrap"><img src={product.productImage} alt={product.productName} /></div>
      <div className="shopsphere-card-body">
        <span className="category-badge">{product.category}</span>
        <h3>{product.productName}</h3>
        <strong className="shopsphere-price">{money(product.price)}</strong>
        <StarRating value={product.productRating} />
        <p className="shopsphere-review">"{product.customerReview}"</p>
        <div className="shopsphere-shop">
          <span>{product.shopName}</span>
          <small><MapPin size={14} /> {product.shopLocation}</small>
        </div>
        <div className="delivery-meter">
          <span>{product.successfulDeliveries}/{product.totalDeliveries} successful deliveries</span>
          <b>{product.deliverySuccessPercentage}% success</b>
          <strong>{product.shopDeliveryRating}/10 shop rating</strong>
        </div>
        <div className="shopsphere-actions">
          <button type="button" className="secondary wishlist-action" onClick={() => onWish(product)}><Heart size={17} /> Wishlist</button>
          <button type="button" className="primary" onClick={() => onAdd(product)}>Add to Cart</button>
          <button type="button" className="primary buy-now" onClick={() => onBuy(product)}>Buy Now</button>
          <button type="button" className="secondary" onClick={() => onView(product)}>View Details</button>
        </div>
      </div>
    </article>
  );
}

function StarRating({ value }) {
  return (
    <div className="star-rating" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={16} fill={star <= Math.round(value) ? 'currentColor' : 'none'} />)}
      <span>{value.toFixed(1)}</span>
    </div>
  );
}

function ShopSphereProductDetailsModal({ product, onClose, onAdd, onBuy, onWish }) {
  return (
    <div className="shopsphere-modal-backdrop" role="dialog" aria-modal="true">
      <section className="shopsphere-modal">
        <button type="button" className="modal-close" onClick={onClose}><XCircle size={22} /></button>
        <img src={product.productImage} alt={product.productName} />
        <div>
          <span className="category-badge">{product.category}</span>
          <h2>{product.productName}</h2>
          <strong className="shopsphere-price">{money(product.price)}</strong>
          <StarRating value={product.productRating} />
          <p>{product.customerReview}</p>
          <div className="modal-stats">
            <span>Shop</span><strong>{product.shopName}</strong>
            <span>Location</span><strong>{product.shopLocation}</strong>
            <span>Deliveries</span><strong>{product.successfulDeliveries}/{product.totalDeliveries}</strong>
            <span>Delivery success</span><strong>{product.deliverySuccessPercentage}%</strong>
            <span>Shop rating</span><strong>{product.shopDeliveryRating}/10</strong>
          </div>
          <div className="shopsphere-modal-actions">
            <button type="button" className="secondary shopsphere-cta" onClick={() => onWish(product)}><Heart size={18} /> Wishlist</button>
            <button type="button" className="primary shopsphere-cta" onClick={() => onAdd(product)}>Add to Cart</button>
            <button type="button" className="primary shopsphere-cta buy-now" onClick={() => onBuy(product)}>Buy Now</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShopSphereToastNotification({ message }) {
  return message ? <div className="shopsphere-toast">{message}</div> : null;
}

function SellerRegisterPage() {
  const [registeredSellers, setRegisteredSellers] = useLocalState(SELLERS_KEY, []);
  const [orders, setOrders] = useLocalState(ORDERS_KEY, []);
  const [form, setForm] = useState({
    ownerName: '',
    shopName: '',
    phone: '',
    email: '',
    gstNumber: '',
    category: 'Electronics',
    pickupAddress: '',
    pickupLocation: 'T. Nagar',
    bankAccount: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [submittedSeller, setSubmittedSeller] = useState(null);
  const [proofOrderId, setProofOrderId] = useState('');
  const proofOrder = orders.find((order) => order.id.toLowerCase() === proofOrderId.trim().toLowerCase());
  const proofProduct = proofOrder ? findCatalogProduct(proofOrder.productId) : null;
  const updateSellerProof = (patch) => {
    if (!proofOrder || !isDeliveredOrder(proofOrder)) return;
    setOrders((currentOrders) => currentOrders.map((order) => order.id === proofOrder.id ? {
      ...order,
      sellerProof: {
        ...order.sellerProof,
        ...patch,
        sellerName: proofProduct?.seller || proofProduct?.shopName || proofProduct?.name,
        uploadedAt: nowStamp()
      }
    } : order));
  };

  const submit = () => {
    const phone = form.phone.replace(/\D/g, '');
    if (registeredSellers.some((seller) => seller.phone === phone || seller.gstNumber.toLowerCase() === form.gstNumber.toLowerCase())) {
      setError('This phone number or GST number is already registered.');
      return;
    }
    const seller = {
      ...form,
      phone,
      sellerId: `SELL-${Date.now()}`,
      status: 'Onboarding approved - trusted until first dispatch review',
      registeredAt: nowStamp()
    };
    setRegisteredSellers([...registeredSellers, seller]);
    setSubmittedSeller(seller);
    notify('Shop registered successfully');
  };

  return (
    <PortalShell type="user">
      <main className="seller-register-page">
        <section className="section-head seller-head">
          <div>
            <h1>Seller Registration</h1>
            <span>Shops join TrustKart by submitting business identity, GST, category, pickup address, and payout details.</span>
          </div>
        </section>
        <section className="seller-onboarding-layout">
          <div className="form-card seller-form">
            <input placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <input placeholder="Shop name" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
            <input type="tel" placeholder="Shop phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Business email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="GST number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>Electronics</option>
              <option>Fashion</option>
              <option>Tools</option>
            </select>
            <textarea placeholder="Pickup address" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} />
            <LocationSelector value={form.pickupLocation} onChange={(location) => setForm({ ...form, pickupLocation: location })} />
            <input placeholder="Bank account / UPI ID" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
            <textarea placeholder="Short shop description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            {error && <div className="alert"><AlertTriangle size={18} /> {error}</div>}
            <button className="primary" disabled={!form.ownerName || !form.shopName || form.phone.replace(/\D/g, '').length < 10 || !form.gstNumber || !form.pickupAddress} onClick={submit}>Register shop</button>
          </div>
          <aside className="seller-join-card">
            <ShieldCheck size={34} />
            <h2>Seller integrity starts before the first order</h2>
            <p>TrustKart records shop identity, GST, pickup location, payout details, listing category, and dispatch proof requirements. Once the seller starts fulfilling orders, the integrity engine monitors wrong dispatch, fake listings, invoice mismatch, empty boxes, stock manipulation, and unfair return denial.</p>
            {submittedSeller && (
              <div className="seller-success">
                <CheckCircle2 size={22} />
                <div>
                  <strong>{submittedSeller.shopName} joined successfully</strong>
                  <span>Seller ID: {submittedSeller.sellerId}</span>
                </div>
              </div>
            )}
            <div className="trust-tags">
              <span>GST captured</span>
              <span>Pickup address stored</span>
              <span>Dispatch proof required</span>
              <span>Invoice hash checked</span>
            </div>
          </aside>
        </section>
        <SellerProofUploadPanel
          orderId={proofOrderId}
          setOrderId={setProofOrderId}
          order={proofOrder}
          product={proofProduct}
          onUpload={updateSellerProof}
        />
      </main>
    </PortalShell>
  );
}

function SellerProofUploadPanel({ orderId, setOrderId, order, product, onUpload }) {
  const delivered = order && isDeliveredOrder(order);
  return (
    <section className="seller-proof-upload">
      <div className="section-head compact-head">
        <div>
          <h2>Seller proof upload by order ID</h2>
          <span>After successful delivery, search the order ID and upload package plus open-box photos. These stay visible in order details and return verification.</span>
        </div>
      </div>
      <div className="seller-proof-search">
        <Search size={19} />
        <input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Paste or type order ID, example DX-..." />
      </div>
      {orderId && !order && <div className="alert"><AlertTriangle size={18} /> No order found for this ID.</div>}
      {order && !delivered && <div className="alert"><AlertTriangle size={18} /> Seller proof upload unlocks after successful delivery.</div>}
      {delivered && product && (
        <div className="seller-proof-workspace">
          <article className="line-card">
            <img src={product.image} alt={product.name} />
            <div>
              <h3>{product.name}</h3>
              <p>{order.id} · {order.customer} · {order.status}</p>
              <strong>{product.seller}</strong>
            </div>
          </article>
          <BillQrCard order={order} />
          <div className="seller-proof-actions">
            <FileMock label="Upload package photo before opening" done={order.sellerProof?.packagePhoto} onDone={(_, preview) => onUpload({ packagePhoto: preview })} />
            <FileMock label="Upload after-opening product photo" done={order.sellerProof?.openedPhoto} onDone={(_, preview) => onUpload({ openedPhoto: preview })} />
          </div>
          <SellerProofPreview order={order} product={product} />
        </div>
      )}
    </section>
  );
}

function SellerEvidenceModal({ seller, onClose }) {
  const evidence = seller.evidence;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="seller-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">{seller.sellerId}</span>
            <h2>{seller.sellerName}</h2>
            <p>{seller.decision}</p>
          </div>
          <button className="ghost" onClick={onClose}>Close</button>
        </header>

        <div className="evidence-images">
          <figure><img src={evidence.orderedProductImage} alt="Ordered product" /><figcaption>Ordered product image</figcaption></figure>
          <figure><img src={evidence.sellerDispatchImage} alt="Seller dispatch" /><figcaption>Seller dispatch image</figcaption></figure>
          <figure><img src={evidence.packageImage} alt="Package proof" /><figcaption>Package image</figcaption></figure>
        </div>

        <div className="evidence-detail-grid">
          <EvidenceRow label="Invoice verification" value={evidence.invoiceVerificationStatus} />
          <EvidenceRow label="SKU match status" value={seller.orderedSku === seller.dispatchSku ? 'SKU matched' : `Mismatch: ${seller.orderedSku} vs ${seller.dispatchSku}`} />
          <EvidenceRow label="Serial number status" value={evidence.serialNumberStatus} />
          <EvidenceRow label="Accessory checklist" value={evidence.accessoryChecklist.join(', ')} />
          <EvidenceRow label="Package weight" value={evidence.packageWeight} />
          <EvidenceRow label="Courier scan weight" value={evidence.courierScanWeight} />
          <EvidenceRow label="Customer complaint" value={evidence.customerComplaint} />
          <EvidenceRow label="Seller response" value={evidence.sellerResponse} />
          <EvidenceRow label="Final platform decision" value={evidence.finalPlatformDecision} />
        </div>

        <section className="fraud-summary">
          <article>
            <h2>Fraud types</h2>
            <div className="fraud-badges">{seller.fraudTypes.map((type) => <span key={type}>{type}</span>)}</div>
          </article>
          <article>
            <h2>Triggered signals</h2>
            <ul>{seller.triggeredSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
          </article>
        </section>
      </section>
    </div>
  );
}

function EvidenceRow({ label, value }) {
  return <div className="evidence-row"><span>{label}</span><strong>{value}</strong></div>;
}

function Stat({ icon: Icon, label, value }) {
  return <article><Icon size={23} /><span>{label}</span><strong>{value}</strong></article>;
}

function Chart({ title, rows }) {
  return <article className="chart"><h2>{title}</h2>{rows.map(([label, value]) => <div className="bar-row" key={label}><span>{label}</span><div><b style={{ width: `${Math.min(100, value * 18)}%` }} /></div><strong>{value}</strong></div>)}</article>;
}

function FileMock({ label, onDone = () => {}, done, accept = 'image/*,video/*' }) {
  const [fileName, setFileName] = useState('');
  const inputId = useMemo(() => `upload-${Math.random().toString(36).slice(2)}`, []);
  const uploaded = Boolean(done || fileName);
  const createPreview = (file) => {
    const reader = new FileReader();
    reader.onload = () => onDone(file, reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <label htmlFor={inputId} className={uploaded ? 'upload done' : 'upload'}>
      <Upload size={18} />
      <span>{fileName || (uploaded ? 'Uploaded' : label)}</span>
      <input
        id={inputId}
        className="file-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          createPreview(file);
        }}
      />
    </label>
  );
}

function EmptyState({ title, action, to }) {
  return <section className="empty"><Package size={38} /><h2>{title}</h2><Link className="primary small" to={to}>{action}</Link></section>;
}

export default function App() {
  clearLegacyDemoData();
  clearPreviousOrdersAndReturnsOnce();
  useThemePreference();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/user" element={<UserHome />} />
      <Route path="/user/login" element={<UserLogin />} />
      <Route path="/user/signup" element={<UserSignup />} />
      <Route path="/user/profile" element={<UserProfile />} />
      <Route path="/user/products" element={<UserProducts />} />
      <Route path="/user/product/:id" element={<ProductDetails />} />
      <Route path="/user/cart" element={<CartPage />} />
      <Route path="/user/wishlist" element={<CartPage wishlist />} />
      <Route path="/user/checkout" element={<CheckoutPage />} />
      <Route path="/user/orders" element={<UserOrders />} />
      <Route path="/user/order/:id" element={<UserOrderDetails />} />
      <Route path="/user/returns" element={<UserReturns />} />
      <Route path="/user/return/:id" element={<ReturnRequestPage />} />
      <Route path="/user/fraud-result/:id" element={<FraudResultPage />} />
      <Route path="/wardrobing-policy" element={<WardrobingPolicyPage />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/seller-integrity" element={<SellerIntegrityDashboard />} />
      <Route path="/seller-register" element={<SellerRegisterPage />} />
      <Route path="/shopsphere" element={<ShopSpherePage />} />
      <Route path="/delivery" element={<DeliveryDashboard />} />
      <Route path="/delivery/returns" element={<DeliveryDashboard returnsMode />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
