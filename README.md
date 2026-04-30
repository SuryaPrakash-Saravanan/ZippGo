# devX ZippGo - Return Fraud Detection E-Commerce Prototype

devX ZippGo is a hackathon-ready e-commerce fraud prevention prototype that detects customer-side and seller-side fraud during order delivery, return pickup, and refund approval.

The project demonstrates how an online shopping platform can reduce return fraud using OTP delivery proof, product photo verification, bill QR validation, category-based return policies, food return video proof, seller integrity checks, and admin monitoring.

## Problem

E-commerce platforms lose money due to:

- Wardrobing fraud
- Fake damage claims
- Receipt manipulation
- Item not received abuse
- Friendly fraud
- Seller-side fraud
- Wrong product dispatch
- Fake listings
- Missing accessories
- Fake food return proof

Treating every return the same either increases fraud or creates friction for genuine customers.

## Solution

devX ZippGo uses a role-based fraud prevention system with separate portals for:

- Customer
- Admin
- Delivery partner
- Seller

Each return is verified using product-specific rules instead of one common policy.

## Main Features

### Customer Portal

- User signup and login
- Product browsing
- Search and category filtering
- Add to cart
- Wishlist / favorite
- Buy now
- Checkout
- Order tracking
- Return request after delivery
- Food return video proof
- Bill QR upload during return
- Return status tracking

### Admin Portal

- Admin login
- Confirm customer orders
- View customer order status
- View return cases
- View fraud signals
- View delivery proof images
- View food return video proof
- Approve food refund only after review
- Seller integrity dashboard
- Registered seller monitoring

### Delivery Partner Portal

- Separate delivery and return sections
- View admin-confirmed orders
- OTP verification during delivery
- Upload delivery product photo
- Mark delivery completed
- View return pickup requests
- Re-enter original OTP during return
- Compare stored delivery image with return image
- Approve or cancel return after verification

### Seller Portal

- Seller/shop registration
- Seller onboarding
- Shop identity details
- GST and pickup location capture
- Seller integrity monitoring

## Fraud Detection Logic

### Wardrobing Fraud

Detected when:

- Fashion tag is missing, removed, or damaged
- Fashion return is after allowed window
- Electronics usage is high
- Tools show scratches, dirt, or heavy usage
- Product appears used temporarily

### Item Not Received Abuse

Detected when:

- Customer claims item not received
- Delivery proof exists
- OTP was verified
- Delivery timestamp exists
- Delivery photo exists

### Fake Damage Claim

Detected when:

- Customer claims damaged product
- Delivery image shows good condition
- Return image shows mismatch or damage

### Receipt Manipulation

Detected when:

- Receipt ID mismatch
- QR/hash mismatch
- Bill details changed

### Reverse Image Fraud

Detected when:

- Uploaded proof appears reused
- Image resembles online/screen-based source
- Simulated reverse image lookup fails

### Food Return Video Fraud

Food returns require app-only video proof.

Checks include:

- Camera capture only
- No file upload
- 2-3 second video
- Tilt/motion challenge
- Torch challenge
- Metadata check
- Screen replay detection
- Deepfake-like signal detection
- Same-product confidence

If video proof passes, it is sent to admin and delivery partner. Refund starts only after approval.

## Category-Based Return Policy

### Fashion

- Return window: 12 hours
- Valid reasons: size issue, color mismatch, damage
- Tag must be attached
- No stains, smell, perfume, or wear signs
- Delivery image and return image must match

### Electronics

- Return only for external damage or genuine issue
- Serial number must match
- Usage/activation must be acceptable
- Accessories must be complete
- Product image must match delivery proof

### Tools

- Check scratches, dust, oil, damage
- Working condition must be verified
- Missing parts are flagged

### Food & Beverages

- App-only video proof required
- Motion, torch, metadata, and screen-fake checks
- Refund only after approval

## Tech Stack

- React
- Vite
- React Router DOM
- Lucide React icons
- CSS
- LocalStorage mock database
- No backend required

## Data Storage

This prototype uses browser `localStorage` for:

- Users
- Orders
- Returns
- Cart
- Wishlist
- Sellers
- Admin session
- Theme preference

- Demo Flow
1. User Orders Product
User logs in
User selects product
User clicks Buy Now
User places order
Order goes to admin confirmation
2. Admin Confirms Order
Admin opens admin portal
Admin confirms order
Order appears in delivery partner portal
3. Delivery Partner Completes Delivery
Delivery partner opens delivery portal
Sends/verifies OTP
Uploads product photo
Completes delivery
Customer order status becomes Delivered
4. User Requests Return
User opens returns page
Selects delivered product
Adds return reason
Uploads required bill/proof
For food, records app-only video proof
Return case is sent for verification
5. Return Verification
For normal products:

Delivery partner compares delivery image and return image
Checks OTP
Checks category-specific conditions
Approves or cancels return
For food:

Video proof is sent to admin and delivery partner
Refund starts only after approval
Admin Password
devxadmin
Project Purpose
This project is designed for hackathons and demonstrations. It shows how return fraud can be reduced by combining:

Delivery proof
OTP verification
Product-specific return rules
QR bill validation
Image comparison
Food video verification
Seller fraud detection
Admin approval workflows
Future Improvements
Real backend database
Real OTP service
Real QR scanning
Real reverse image lookup API
Real computer vision model
Payment gateway integration
Seller analytics
Delivery tracking API

## Run Commands

Install dependencies:

```bash
npm install

```
```go to
http://127.0.0.1:5173/
'''





