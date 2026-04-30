# ZippGo devX - Return Fraud Prevention E-Commerce Prototype

ZippGo devX is a hackathon-ready e-commerce prototype that prevents return fraud using role-based proof collection, OTP delivery validation, product-specific return policies, bill QR verification, seller integrity checks, and a risk scoring dashboard.

The project demonstrates how fraud can happen from both sides of an e-commerce marketplace: customers may abuse returns, while sellers may dispatch wrong, used, incomplete, or fake products. ZippGo devX solves this by collecting evidence at ordering, seller proof upload, delivery, return request, return pickup, and admin review stages.

## GitHub Short Description

Role-based e-commerce return fraud prevention prototype with user shopping, seller onboarding, delivery OTP proof, bill QR validation, return verification, seller fraud detection, and admin risk dashboard.

## Key Features

- User commerce site with product search, cart, wishlist, checkout, orders, and returns
- Separate portals for user, admin, seller, and delivery partner
- Admin order confirmation before delivery partner receives the task
- OTP-based delivery verification
- Delivery partner product photo and package photo proof
- Automatic bill QR generation for every order
- Return bill upload with QR extraction and stored QR matching
- Dynamic category-based return policies
- Side-by-side delivery image vs return image comparison
- Delivery partner return approval or cancellation
- Customer fraud risk scoring and fraud type detection
- Seller Integrity Dashboard for seller-side fraud detection
- Food and beverage return proof with app-only video verification simulation
- LocalStorage-only prototype, no backend required
- Responsive premium UI with light, dark, and system themes

## Tech Stack

- React
- Vite
- React Router DOM
- Lucide React icons
- Modern CSS
- LocalStorage for mock data persistence

## Main Portals

### 1. User Portal

Users can:

- Sign up and log in using phone number and password
- Browse products
- Search and filter products
- Add products to cart or wishlist
- Buy products
- Track order status
- View delivery OTP
- View delivery proof and bill QR
- Request returns only after delivery
- Upload bill during return for QR verification
- View fraud detection or return result

### 2. Admin Portal

Admins can:

- Confirm orders placed by users
- View registered customers
- View delivered and waiting orders
- View return cases and fraud signals
- View bill QR records
- Search order proof by order ID
- Review delivery image, return image, seller proof, and risk score
- Monitor seller-side fraud through the Seller Integrity Dashboard

### 3. Delivery Partner Portal

Delivery partners can:

- See only admin-confirmed delivery orders
- Send or verify OTP
- Upload product delivery photo
- Upload package photo
- Fill delivery condition checklist
- Complete delivery only after all required details are entered and Continue is clicked
- See return pickup requests separately
- Verify original delivery OTP during return pickup
- Compare delivery proof with return product proof
- Approve return only if product verification matches
- Cancel return if image, condition, OTP, or category rules fail

### 4. Seller Portal

Sellers can:

- Register shop details
- Join the marketplace
- Search delivered order by order ID
- Upload package proof and open-box product proof
- Help admins and delivery partners verify whether a returned product matches the delivered product

## Dynamic Return Policy System

### Fashion

Applies to dress, shoes, bags, and travel items.

- Return window: 12 hours
- Valid reasons: size issue, color mismatch, damage
- Delivery partner must capture delivery image
- Return partner must compare returned product with delivery image
- Return is successful only if the product matches

### Electronics

Applies to oven, mobile accessories, laptops, smart watches, cameras, and similar electronics.

- Return allowed only for external damage
- Delivery partner must verify serial number
- Delivery and return images are compared
- Usage and activation condition are checked
- Returned product must match original delivery

### Tools

Applies to home appliances, kitchen items, furniture, sports items, and working tools.

- Scratches and physical damage are checked
- Working condition is verified during delivery and return
- Heavy usage marks can trigger rejection or investigation

### Food & Beverages

Food returns are handled differently to protect genuine customers and prevent fake proof.

- User must capture app-only live proof
- File upload is disabled for high-risk proof mode
- Metadata, timestamp, motion, torch challenge, screen fake, and reverse-image signals are simulated
- If checks pass, refund is approved within 12 hours
- If signals are suspicious, the case goes to additional verification or manual review

## Fraud Types Detected

- Wardrobing Fraud
- Item Not Received Abuse
- Fake Damage Claim
- Receipt Manipulation
- Friendly Fraud
- Fraud Ring
- Reverse Image Match Fraud
- Food Return Video Fraud
- Wrong Product or Random Proof Fraud
- Seller-side fraud such as wrong dispatch, fake listing, missing accessories, invoice manipulation, fake shipment, fake reviews, and unfair return denial

## Risk Score Rules

The mock fraud engine calculates a risk score from triggered signals.

- 0-30: Auto Approve
- 31-70: Manual Review
- 71+: Reject / Investigate

Example signals:

- Delivery proof missing
- OTP not verified
- Return pickup OTP mismatch
- Receipt or bill QR mismatch
- Product image mismatch
- Fashion tag missing
- Electronics serial mismatch
- High product usage
- Tool scratches or dirt
- Reverse image lookup matched online/reused proof

## Order Flow

1. User signs up or logs in.
2. User adds product to cart or clicks Buy Now.
3. User places order from checkout.
4. System generates a unique bill QR for the order.
5. Admin confirms the order.
6. Delivery partner receives the delivery task.
7. Delivery partner verifies OTP, uploads product photo, uploads package photo, and fills checklist.
8. Delivery partner clicks Continue.
9. Order moves to Delivered section.
10. User can request return only after delivery.

## Return Flow

1. User opens Return Center.
2. User selects a delivered order.
3. User uploads bill or invoice.
4. System extracts/generates QR from uploaded bill.
5. Uploaded bill QR is matched with stored order bill QR.
6. If QR does not match, return submission is blocked.
7. If QR matches, return request is created.
8. Delivery partner visits user for pickup verification.
9. Delivery partner re-enters original delivery OTP.
10. Delivery partner compares delivery image with return image.
11. Delivery partner completes product category checklist.
12. Return is approved, cancelled, or sent for investigation.

## Run Locally

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build production files:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Default local URL:

```text
http://127.0.0.1:5173/
```

## Admin Login

Open the admin portal from the landing page and enter the configured demo admin password from the source code.

## Project Structure

```text
src/
  App.jsx                 Main routes, portals, flows, and UI components
  main.jsx                React entry point
  styles.css              App styling and themes
  data/
    products.js           Product data, categories, delivery estimates
  utils/
    fraud.js              Customer return fraud risk scoring
    sellerFraud.js        Seller fraud scoring logic
    storage.js            LocalStorage helpers and formatting
public/
  assets/                 Static assets
```

## Why This Project Matters

Return fraud damages both customers and sellers. Genuine customers need fast and fair refunds, while retailers need protection from wardrobing, fake damage claims, fake receipts, INR abuse, seller dispatch fraud, and organized fraud rings.

ZippGo devX shows a practical way to reduce fraud without punishing honest users: collect proof at every important checkpoint, apply product-specific rules, verify delivery with OTP, validate bill QR during return, and explain every risk decision clearly to admins.

## Future Scope

- Real backend with authentication and database
- Real OTP SMS integration
- Real QR extraction from uploaded invoices
- Real image comparison and reverse image lookup APIs
- Delivery partner mobile app
- Seller dispatch audit workflow
- Payment gateway and refund automation
- ML-based fraud ring detection

