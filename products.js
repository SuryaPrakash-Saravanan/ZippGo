export const chennaiLocations = [
  'Nandambakkam',
  'Guindy',
  'T. Nagar',
  'Velachery',
  'Anna Nagar',
  'Tambaram',
  'Porur',
  'Adyar',
  'OMR',
  'Ambattur',
  'Chromepet',
  'Mylapore',
  'Egmore'
];

export const warehouseLocations = [
  'Chennai Central',
  'T. Nagar',
  'Velachery',
  'Anna Nagar',
  'Tambaram',
  'Guindy',
  'Porur',
  'OMR',
  'Adyar',
  'Ambattur'
];

const catalog = [
  ['Aurora Silk Evening Dress', 'Dresses / Fashion', 7499, 11999, 'high', 'Tag verification + 24-hour return window'],
  ['Noir Linen Blazer', 'Dresses / Fashion', 4299, 6999, 'medium', 'Tag verification'],
  ['Gold Thread Kurti Set', 'Dresses / Fashion', 2999, 4599, 'medium', 'Tag verification'],
  ['Velvet Party Gown', 'Dresses / Fashion', 9999, 14999, 'high', 'Tag verification + 24-hour return window'],
  ['Classic Cotton Saree', 'Dresses / Fashion', 2199, 3499, 'low', 'Normal fashion inspection'],
  ['Urban Denim Jacket', 'Dresses / Fashion', 2599, 3999, 'low', 'Normal fashion inspection'],
  ['Satin Cocktail Dress', 'Dresses / Fashion', 6899, 10999, 'high', 'Tag verification + 24-hour return window'],
  ['Premium Wireless Headphones', 'Electronics', 8999, 12999, 'medium', 'Serial number + accessory + activation check'],
  ['devX UltraBook Pro 14', 'Electronics', 68999, 82999, 'high', 'Working video + serial number + accessory check'],
  ['iPhone 16', 'Electronics', 74999, 89999, 'high', 'Working video + serial number + activation check'],
  ['4K Smart TV 43', 'Electronics', 32999, 44999, 'high', 'Serial number + accessory + usage check'],
  ['Bluetooth Speaker Max', 'Electronics', 5499, 7999, 'medium', 'Serial number + accessory check'],
  ['Gaming Keyboard RGB', 'Electronics', 3499, 5499, 'low', 'Serial number + accessory check'],
  ['Smart Watch Elite', 'Electronics', 9999, 14999, 'medium', 'Serial number + activation check'],
  ['Mirrorless Camera Z', 'Cameras / Gadgets', 58999, 72999, 'high', 'Serial number + shutter count + accessory check'],
  ['Action Camera 5K', 'Cameras / Gadgets', 24999, 32999, 'high', 'Serial number + usage hours + accessory check'],
  ['Drone Mini 4', 'Cameras / Gadgets', 45999, 59999, 'high', 'Serial number + flight hours + accessory check'],
  ['Portable Gimbal', 'Cameras / Gadgets', 8999, 12999, 'medium', 'Usage hours + accessory check'],
  ['Instant Photo Printer', 'Cameras / Gadgets', 6999, 9999, 'medium', 'Serial number + accessory check'],
  ['VR Travel Viewer', 'Cameras / Gadgets', 11999, 16999, 'medium', 'Serial number + usage check'],
  ['Cordless Drill Kit', 'Tools', 7999, 11999, 'medium', 'Scratch/dirt/usage mark comparison'],
  ['Laser Distance Meter', 'Tools', 4999, 6999, 'medium', 'Scratch/dirt/usage mark comparison'],
  ['Premium Socket Set', 'Tools', 3299, 4999, 'low', 'Condition photo comparison'],
  ['Welding Helmet Pro', 'Tools', 5999, 8999, 'medium', 'Scratch/dirt/usage mark comparison'],
  ['Pressure Washer Compact', 'Tools', 13999, 18999, 'high', 'Usage mark + accessory check'],
  ['Electric Screwdriver', 'Tools', 2899, 4299, 'low', 'Condition photo comparison'],
  ['Marble Finish Sneakers', 'Shoes', 4299, 6499, 'medium', 'Sole condition photo comparison'],
  ['Trail Runner Shoes', 'Shoes', 5499, 7999, 'high', 'Sole condition + dirt comparison'],
  ['Leather Formal Shoes', 'Shoes', 6999, 9999, 'medium', 'Sole condition photo comparison'],
  ['Gold Accent Heels', 'Shoes', 4999, 7499, 'high', 'Sole condition + tag check'],
  ['Canvas Street Shoes', 'Shoes', 1999, 3299, 'low', 'Sole condition photo comparison'],
  ['Running Foam Trainers', 'Shoes', 6499, 8999, 'medium', 'Sole condition photo comparison'],
  ['Luxe Coffee Maker', 'Home products', 15999, 21999, 'medium', 'Normal return + accessory check'],
  ['Air Purifier Prime', 'Home products', 18999, 24999, 'medium', 'Normal return + filter check'],
  ['Robot Vacuum S9', 'Home products', 34999, 46999, 'high', 'Usage hours + accessory check'],
  ['Memory Foam Mattress', 'Home products', 21999, 31999, 'high', 'Packaging + condition inspection'],
  ['Chef Knife Set', 'Home products', 3999, 6499, 'low', 'Normal return process'],
  ['Ceramic Dinner Set', 'Home products', 2899, 4599, 'low', 'Normal return process'],
  ['Luxury Table Lamp', 'Home products', 3499, 5999, 'low', 'Normal return process'],
  ['Soundbar Cinema 300', 'Electronics', 21999, 29999, 'high', 'Serial number + accessory check'],
  ['iPad Air 11', 'Electronics', 42999, 55999, 'high', 'Working video + serial number + activation check'],
  ['Designer Lehenga', 'Dresses / Fashion', 18999, 26999, 'high', 'Tag verification + 24-hour return window'],
  ['Compact Projector', 'Cameras / Gadgets', 28999, 38999, 'high', 'Serial number + usage hours + accessory check'],
  ['Impact Wrench Pro', 'Tools', 17999, 23999, 'high', 'Scratch/dirt/usage mark comparison'],
  ['Ergonomic Office Chair', 'Home products', 12999, 18999, 'medium', 'Packaging + condition inspection']
];

const imageProfiles = {
  'Dresses / Fashion': ['#7b1e3a', '#f3b7c8', 'DRESS'],
  Electronics: ['#13294b', '#8fb8ff', 'TECH'],
  'Cameras / Gadgets': ['#222222', '#c9a24d', 'CAM'],
  Tools: ['#4b2a13', '#f0a64a', 'TOOL'],
  Shoes: ['#1f3b2d', '#95d5b2', 'SHOE'],
  'Home products': ['#2f2a55', '#d6c8ff', 'HOME']
};

function productImage(name, category, index) {
  const [dark, light, label] = imageProfiles[category];
  const shortName = name.replace(/&/g, 'and').slice(0, 24);
  const lower = name.toLowerCase();
  let productArt = '';
  let badge = label;

  if (lower.includes('iphone') || lower.includes('smartphone')) {
    badge = 'PHONE';
    productArt = `<rect x="350" y="145" width="200" height="330" rx="34" fill="#121212"/><rect x="372" y="185" width="156" height="245" rx="18" fill="${light}"/><circle cx="450" cy="452" r="12" fill="#fff8e1"/>`;
  } else if (lower.includes('ipad') || lower.includes('tablet')) {
    badge = 'TABLET';
    productArt = `<rect x="318" y="145" width="264" height="365" rx="34" fill="#121212"/><rect x="348" y="185" width="204" height="280" rx="18" fill="${light}"/><circle cx="450" cy="486" r="11" fill="#fff8e1"/>`;
  } else if (lower.includes('book') || lower.includes('laptop') || lower.includes('ultrabook')) {
    badge = 'LAPTOP';
    productArt = `<rect x="275" y="180" width="350" height="220" rx="20" fill="#171717"/><rect x="300" y="205" width="300" height="160" rx="10" fill="${light}"/><path d="M235 420h430l45 60H190z" fill="#d8d8d8"/><rect x="375" y="438" width="150" height="16" rx="8" fill="#8b8b8b"/>`;
  } else if (lower.includes('headphone')) {
    badge = 'AUDIO';
    productArt = `<path d="M310 330c0-110 70-180 140-180s140 70 140 180" fill="none" stroke="${light}" stroke-width="42" stroke-linecap="round"/><rect x="250" y="315" width="95" height="150" rx="34" fill="#121212"/><rect x="555" y="315" width="95" height="150" rx="34" fill="#121212"/><circle cx="450" cy="420" r="32" fill="${light}"/>`;
  } else if (lower.includes('tv')) {
    badge = 'SMART TV';
    productArt = `<rect x="190" y="170" width="520" height="310" rx="24" fill="#121212"/><rect x="225" y="205" width="450" height="235" rx="12" fill="${light}"/><path d="M410 485h80l30 48H380z" fill="#d8d8d8"/><rect x="330" y="532" width="240" height="22" rx="11" fill="#8b8b8b"/>`;
  } else if (lower.includes('speaker') || lower.includes('soundbar')) {
    badge = lower.includes('soundbar') ? 'SOUNDBAR' : 'SPEAKER';
    productArt = lower.includes('soundbar')
      ? `<rect x="190" y="300" width="520" height="105" rx="34" fill="${light}"/><circle cx="270" cy="352" r="30" fill="${dark}"/><circle cx="450" cy="352" r="30" fill="${dark}"/><circle cx="630" cy="352" r="30" fill="${dark}"/>`
      : `<rect x="330" y="170" width="240" height="350" rx="55" fill="${light}"/><circle cx="450" cy="275" r="70" fill="${dark}"/><circle cx="450" cy="430" r="48" fill="${dark}"/><circle cx="450" cy="275" r="28" fill="#fff8e1"/>`;
  } else if (lower.includes('keyboard')) {
    badge = 'KEYBOARD';
    productArt = `<rect x="180" y="250" width="540" height="220" rx="28" fill="${light}"/><g fill="${dark}">${Array.from({ length: 4 }, (_, r) => Array.from({ length: 9 }, (_, c) => `<rect x="${220 + c * 52}" y="${285 + r * 38}" width="36" height="24" rx="6"/>`).join('')).join('')}</g>`;
  } else if (lower.includes('watch')) {
    badge = 'WATCH';
    productArt = `<rect x="395" y="120" width="110" height="160" rx="36" fill="#121212"/><rect x="395" y="420" width="110" height="160" rx="36" fill="#121212"/><rect x="330" y="245" width="240" height="220" rx="54" fill="${light}"/><circle cx="450" cy="355" r="58" fill="${dark}"/><path d="M450 320v38l34 22" stroke="#fff8e1" stroke-width="16" stroke-linecap="round" fill="none"/>`;
  } else if (category === 'Dresses / Fashion') {
    if (lower.includes('jacket') || lower.includes('blazer')) {
      badge = lower.includes('denim') ? 'JACKET' : 'BLAZER';
      const cloth = lower.includes('denim') ? '#5b8bd8' : light;
      productArt = `<path d="M330 155h240l82 120-74 58 44 190H278l44-190-74-58z" fill="${cloth}"/><path d="M395 155l55 118 55-118" fill="#fff8e1" opacity=".72"/><path d="M450 270v245M345 330h78M477 330h78" stroke="${dark}" stroke-width="18" stroke-linecap="round"/>`;
    } else if (lower.includes('saree')) {
      badge = 'SAREE';
      productArt = `<path d="M390 135c86 25 140 112 105 220l-70 210H285l70-230c-75-54-38-170 35-200z" fill="${light}"/><path d="M455 135c92 66 152 210 112 380h-78c38-134 8-262-88-350z" fill="#fff8e1" opacity=".72"/><path d="M322 520h250" stroke="${dark}" stroke-width="18" stroke-linecap="round"/>`;
    } else if (lower.includes('kurti')) {
      badge = 'KURTI';
      productArt = `<path d="M450 130c64 0 110 45 110 95l-44 38 64 210H320l64-210-44-38c0-50 46-95 110-95z" fill="${light}"/><rect x="350" y="478" width="72" height="90" rx="16" fill="#fff8e1"/><rect x="478" y="478" width="72" height="90" rx="16" fill="#fff8e1"/><path d="M404 162c20 36 72 36 92 0" stroke="${dark}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    } else if (lower.includes('lehenga')) {
      badge = 'LEHENGA';
      productArt = `<path d="M390 150h120l42 110H348z" fill="${light}"/><path d="M450 260c86 0 150 92 185 250H265c35-158 99-250 185-250z" fill="${light}"/><path d="M310 462h280M360 330l-48 170M450 300v210M540 330l48 170" stroke="${dark}" stroke-width="14" stroke-linecap="round" opacity=".55"/>`;
    } else {
      badge = lower.includes('gown') ? 'GOWN' : 'DRESS';
      productArt = `<path d="M450 135c55 0 96 42 96 90l-48 34 96 260H306l96-260-48-34c0-48 41-90 96-90z" fill="${light}"/><path d="M390 158c24 44 96 44 120 0" fill="none" stroke="${dark}" stroke-width="18" stroke-linecap="round"/><path d="M342 502h216" stroke="${dark}" stroke-width="18" opacity=".4"/>`;
    }
  } else if (category === 'Shoes') {
    badge = lower.includes('heel') ? 'HEELS' : lower.includes('formal') ? 'FORMAL' : 'SHOES';
    productArt = lower.includes('heel')
      ? `<path d="M315 325c95 18 170 14 260-44l58 58c-86 82-220 110-350 78z" fill="${light}"/><path d="M584 340l64 170h-58l-46-132z" fill="${dark}"/><path d="M292 420h330" stroke="#fff8e1" stroke-width="18" stroke-linecap="round"/>`
      : `<path d="M255 385c80-8 130-54 170-120 32 76 116 108 220 117 42 4 64 34 49 70H220c-28-25-18-61 35-67z" fill="${light}"/><path d="M308 414h340" stroke="${dark}" stroke-width="18" stroke-linecap="round"/><path d="M430 300l92 34" stroke="#fff8e1" stroke-width="14" stroke-linecap="round"/>`;
  } else if (category === 'Tools') {
    if (lower.includes('helmet')) {
      badge = 'HELMET';
      productArt = `<path d="M270 385c0-120 92-210 205-210 98 0 175 70 190 170l-76 92H300c-20 0-30-20-30-52z" fill="${light}"/><path d="M505 255h134M350 420h245" stroke="${dark}" stroke-width="22" stroke-linecap="round"/>`;
    } else if (lower.includes('washer')) {
      badge = 'WASHER';
      productArt = `<rect x="290" y="285" width="265" height="180" rx="34" fill="${light}"/><circle cx="355" cy="375" r="42" fill="${dark}"/><circle cx="505" cy="375" r="42" fill="${dark}"/><path d="M555 320h95l42-70" stroke="#fff8e1" stroke-width="24" stroke-linecap="round" fill="none"/>`;
    } else if (lower.includes('socket')) {
      badge = 'SOCKET';
      productArt = `<rect x="220" y="250" width="460" height="235" rx="32" fill="${light}"/><g fill="${dark}">${[0,1,2,3,4].map((c) => `<circle cx="${300 + c * 75}" cy="332" r="${24 + c * 3}"/>`).join('')}<rect x="300" y="405" width="300" height="34" rx="17"/></g>`;
    } else if (lower.includes('laser')) {
      badge = 'LASER';
      productArt = `<rect x="260" y="250" width="380" height="170" rx="28" fill="${light}"/><circle cx="340" cy="335" r="44" fill="${dark}"/><path d="M440 335h250" stroke="#ff5f72" stroke-width="14" stroke-linecap="round"/><rect x="380" y="440" width="140" height="60" rx="18" fill="#fff8e1"/>`;
    } else if (lower.includes('wrench')) {
      badge = 'WRENCH';
      productArt = `<path d="M300 235c50-50 122-58 178-24l-76 76 54 54 76-76c34 56 26 128-24 178-58 58-144 58-202 0s-64-150-6-208z" fill="${light}"/><rect x="470" y="380" width="190" height="58" rx="29" fill="${light}" transform="rotate(45 470 380)"/>`;
    } else {
      badge = lower.includes('screwdriver') ? 'DRIVER' : 'DRILL';
      productArt = `<path d="M320 255h210c50 0 90 40 90 90v35H500l-42 95H352l42-95h-74c-35 0-64-29-64-64s29-61 64-61z" fill="${light}"/><circle cx="334" cy="318" r="34" fill="${dark}"/><rect x="555" y="285" width="105" height="42" rx="10" fill="#fff8e1"/>`;
    }
  } else if (category === 'Cameras / Gadgets') {
    if (lower.includes('drone')) {
      badge = 'DRONE';
      productArt = `<rect x="380" y="290" width="140" height="95" rx="32" fill="${light}"/><path d="M310 250l100 70M590 250l-100 70M310 430l100-70M590 430l-100-70" stroke="${light}" stroke-width="22" stroke-linecap="round"/><circle cx="275" cy="225" r="55" fill="#fff8e1"/><circle cx="625" cy="225" r="55" fill="#fff8e1"/><circle cx="275" cy="455" r="55" fill="#fff8e1"/><circle cx="625" cy="455" r="55" fill="#fff8e1"/>`;
    } else if (lower.includes('gimbal')) {
      badge = 'GIMBAL';
      productArt = `<rect x="360" y="155" width="180" height="120" rx="28" fill="${light}"/><path d="M450 275v110c0 45 48 62 82 32" stroke="${light}" stroke-width="34" fill="none" stroke-linecap="round"/><rect x="415" y="398" width="70" height="150" rx="28" fill="#fff8e1"/>`;
    } else if (lower.includes('printer')) {
      badge = 'PRINTER';
      productArt = `<rect x="260" y="260" width="380" height="190" rx="30" fill="${light}"/><rect x="315" y="175" width="270" height="110" rx="14" fill="#fff8e1"/><rect x="320" y="402" width="260" height="125" rx="16" fill="#fff8e1"/><circle cx="575" cy="330" r="18" fill="${dark}"/>`;
    } else if (lower.includes('vr')) {
      badge = 'VR';
      productArt = `<rect x="250" y="255" width="400" height="190" rx="58" fill="${light}"/><circle cx="365" cy="350" r="50" fill="${dark}"/><circle cx="535" cy="350" r="50" fill="${dark}"/><path d="M250 350h-70M650 350h70" stroke="#fff8e1" stroke-width="28" stroke-linecap="round"/>`;
    } else if (lower.includes('projector')) {
      badge = 'PROJECTOR';
      productArt = `<rect x="250" y="260" width="390" height="200" rx="34" fill="${light}"/><circle cx="380" cy="360" r="66" fill="${dark}"/><circle cx="380" cy="360" r="34" fill="#fff8e1"/><path d="M650 300l130-55v230l-130-55z" fill="#fff8e1" opacity=".7"/>`;
    } else {
      badge = lower.includes('action') ? 'ACTION CAM' : 'CAMERA';
      productArt = `<rect x="255" y="230" width="390" height="230" rx="34" fill="${light}"/><rect x="315" y="190" width="160" height="60" rx="20" fill="${light}"/><circle cx="450" cy="345" r="82" fill="${dark}"/><circle cx="450" cy="345" r="46" fill="#fff8e1"/><circle cx="560" cy="280" r="22" fill="${dark}"/>`;
    }
  } else {
    if (lower.includes('coffee')) {
      badge = 'COFFEE';
      productArt = `<rect x="335" y="170" width="230" height="320" rx="38" fill="${light}"/><rect x="385" y="230" width="130" height="105" rx="18" fill="${dark}"/><path d="M390 490h120M420 335h60v92h-60z" stroke="#fff8e1" stroke-width="20" fill="none" stroke-linecap="round"/>`;
    } else if (lower.includes('purifier')) {
      badge = 'PURIFIER';
      productArt = `<rect x="330" y="160" width="240" height="380" rx="42" fill="${light}"/><g stroke="${dark}" stroke-width="14" stroke-linecap="round">${[230,270,310,350,390,430].map((y) => `<path d="M380 ${y}h140"/>`).join('')}</g><circle cx="450" cy="500" r="20" fill="#fff8e1"/>`;
    } else if (lower.includes('vacuum')) {
      badge = 'VACUUM';
      productArt = `<circle cx="430" cy="350" r="135" fill="${light}"/><circle cx="430" cy="350" r="70" fill="${dark}"/><path d="M520 260l110-90M540 440l90 90" stroke="#fff8e1" stroke-width="24" stroke-linecap="round"/>`;
    } else if (lower.includes('mattress')) {
      badge = 'MATTRESS';
      productArt = `<path d="M230 300h420l80 95-95 115H215l-80-95z" fill="${light}"/><path d="M230 300l-95 115M650 300l80 95M215 510l95-115h420" stroke="${dark}" stroke-width="16" fill="none" opacity=".55"/>`;
    } else if (lower.includes('knife')) {
      badge = 'KNIVES';
      productArt = `<rect x="260" y="405" width="380" height="80" rx="24" fill="${dark}"/><path d="M330 185l58 220h-86zM450 165l42 240h-84zM570 205l34 200h-78z" fill="${light}"/><g fill="#fff8e1"><rect x="300" y="405" width="44" height="88" rx="10"/><rect x="430" y="405" width="44" height="88" rx="10"/><rect x="560" y="405" width="44" height="88" rx="10"/></g>`;
    } else if (lower.includes('dinner')) {
      badge = 'DINNER';
      productArt = `<circle cx="365" cy="345" r="115" fill="${light}"/><circle cx="365" cy="345" r="66" fill="${dark}" opacity=".35"/><circle cx="555" cy="370" r="88" fill="#fff8e1"/><path d="M620 235v270M655 235v270M690 235v270" stroke="${light}" stroke-width="14" stroke-linecap="round"/>`;
    } else if (lower.includes('lamp')) {
      badge = 'LAMP';
      productArt = `<path d="M350 170h200l70 180H280z" fill="${light}"/><rect x="425" y="350" width="50" height="145" rx="20" fill="#fff8e1"/><rect x="335" y="495" width="230" height="40" rx="20" fill="${light}"/><circle cx="450" cy="350" r="44" fill="#fff8e1" opacity=".5"/>`;
    } else if (lower.includes('chair')) {
      badge = 'CHAIR';
      productArt = `<rect x="330" y="160" width="240" height="250" rx="42" fill="${light}"/><rect x="300" y="365" width="300" height="80" rx="34" fill="#fff8e1"/><path d="M340 445l-60 105M560 445l60 105M390 445v105M510 445v105" stroke="${light}" stroke-width="20" stroke-linecap="round"/>`;
    } else {
      badge = 'HOME';
      productArt = `<rect x="310" y="190" width="280" height="280" rx="32" fill="${light}"/><path d="M360 260h180M360 330h180M360 400h120" stroke="${dark}" stroke-width="22" stroke-linecap="round"/><circle cx="610" cy="215" r="54" fill="#fff8e1"/>`;
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${dark}" offset="0"/>
          <stop stop-color="#0a0806" offset="1"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="18" flood-opacity=".35"/></filter>
      </defs>
      <rect width="900" height="700" fill="url(#g)"/>
      <circle cx="735" cy="125" r="125" fill="${light}" opacity=".18"/>
      <circle cx="140" cy="590" r="165" fill="${light}" opacity=".12"/>
      <g filter="url(#shadow)">${productArt}</g>
      <text x="450" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="900" fill="#fff8e1">${badge}</text>
      <text x="450" y="565" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#fff8e1">${shortName}</text>
      <text x="450" y="618" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#72f0c8">devX verified product ${index + 1}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const products = catalog.map(([name, category, price, originalPrice, risk, verificationType], index) => {
  const id = `TKP-${String(index + 1).padStart(3, '0')}`;
  const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
  const warehouse = warehouseLocations[index % warehouseLocations.length];
  return {
    id,
    name,
    category,
    image: productImage(name, category, index),
    price,
    originalPrice,
    discount,
    rating: Number((4.1 + (index % 8) * 0.1).toFixed(1)),
    reviews: 180 + index * 37,
    description: `${name} from a verified Chennai seller, packed with ZippGo devX return proof checks and delivery verification.`,
    specifications: [
      `Warehouse: ${warehouse}`,
      `Verification: ${verificationType}`,
      `Risk profile: ${risk}`,
      price > 20000 ? 'High-value order checks enabled' : 'Standard order checks enabled'
    ],
    seller: ['Crown Retail', 'Madras Prime', 'Goldline Stores', 'UrbanCart', 'SouthBay Sellers'][index % 5],
    stock: index % 7 === 0 ? 'Only 3 left' : 'In stock',
    returnPolicy: category === 'Dresses / Fashion' ? '12-hour dress return with tag verification' : risk === 'high' ? 'Return eligible with extra verification' : '7-day verified return',
    wardrobingRiskLevel: risk,
    verificationType,
    warehouseLocation: warehouse
  };
});

const locationIndex = (name, list) => Math.max(0, list.findIndex((item) => item === name));

export function getDeliveryEstimate(userLocation = 'Guindy', warehouseLocation = 'Guindy') {
  const distance = Math.abs(locationIndex(userLocation, chennaiLocations) - locationIndex(warehouseLocation, warehouseLocations));
  if (userLocation === warehouseLocation) return '30-45 min';
  if (distance <= 2) return '1-2 hours';
  if (distance <= 5) return '2-4 hours';
  return '4-6 hours';
}

export const categories = ['All', 'Fashion', 'Electronics', 'Tools'];

export function normalizeCategory(category) {
  if (category === 'Dresses / Fashion' || category === 'Shoes' || category === 'Fashion' || category === 'Dress' || category === 'Dresses') return 'Fashion';
  if (category === 'Cameras / Gadgets' || category === 'Gadgets' || category === 'Oven' || category === 'Mobile accessories' || category === 'Laptop accessories' || category === 'Smart watches') return 'Electronics';
  if (category === 'Food & Beverages' || category === 'Food' || category === 'Bakery' || category === 'Snacks' || category === 'Dairy' || category === 'Beverage' || category === 'Prepared Food' || category === 'Eggs' || category === 'Fruits' || category === 'Fresh Beverage') return 'Food & Beverages';
  if (category === 'Home products' || category === 'Home' || category === 'Home appliances' || category === 'Kitchen items' || category === 'Furniture' || category === 'Sports items' || category === 'Travel items' || category === 'Bags' || category === 'Cosmetics' || category === 'Beauty products') return 'Tools';
  return category;
}
