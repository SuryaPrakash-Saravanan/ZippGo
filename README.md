🛡️ devX ZippGo - Return Fraud Detection E-Commerce Prototype
devX ZippGo is a hackathon-ready e-commerce fraud prevention prototype that detects fraud from both customers and sellers during ordering, delivery, return pickup, and refund approval.

The project shows how an online shopping platform can reduce return fraud using OTP delivery proof, product photo verification, bill QR validation, category-based return policies, food return video proof, seller integrity checks, and admin monitoring.

🚨 Problem
E-commerce platforms face losses because of:

🧥 Wardrobing fraud
📦 Fake damage claims
🧾 Receipt manipulation
🚚 Item not received abuse
💳 Friendly fraud
🏪 Seller-side fraud
❌ Wrong product dispatch
🛍️ Fake listings
🎧 Missing accessories
🍱 Fake food return proof

Treating every return the same either increases fraud or creates problems for genuine customers.

💡 Solution
devX ZippGo uses a role-based fraud prevention system with separate portals for:

👤 Customer
🛡️ Admin
🚚 Delivery partner
🏪 Seller

Each return is checked using product-specific rules instead of one common return policy.

✨ Main Features
👤 Customer Portal
Users can sign up, log in, browse products, search products, add items to cart, add products to wishlist, buy products, place orders, track orders, request returns after delivery, upload bill proof, record food return video proof, and view return status.

🛡️ Admin Portal
Admin can confirm customer orders, view delivery status, monitor return cases, view fraud signals, check uploaded delivery proof images, review food return video proof, approve food refunds, and monitor seller integrity.

🚚 Delivery Partner Portal
Delivery partner has separate delivery and return sections. They can view admin-confirmed orders, verify OTP, upload product delivery photo, complete delivery, view return pickup requests, verify original OTP during return, compare delivery image with return image, and approve or cancel returns.

🏪 Seller Portal
Sellers can register their shop, submit shop details, provide GST and pickup location, and join the platform. Admin can monitor seller integrity and seller-side fraud signals.

🧠 Fraud Detection Logic
🧥 Wardrobing Fraud
Detected when fashion tags are missing, removed, or damaged; fashion return is after the allowed window; electronics show high usage; tools show scratches, dirt, or heavy usage; or the product looks temporarily used.

📦 Item Not Received Abuse
Detected when the customer claims “item not received” but delivery proof exists, OTP was verified, delivery timestamp exists, and delivery product photo exists.

🛠️ Fake Damage Claim
Detected when the customer claims the product is damaged, but delivery-time image shows good condition and return-time image shows mismatch or damage.

🧾 Receipt Manipulation
Detected when receipt ID, QR code, hash, price, date, or product details do not match the original order bill.

🌐 Reverse Image Fraud
Detected when uploaded proof looks reused, copied from online sources, or appears to be screen-based proof.

🍱 Food Return Video Fraud
Food returns require app-only video proof. The app checks camera capture, 2-3 second video duration, tilt/motion challenge, torch challenge, metadata, screen replay signals, deepfake-like signals, and same-product confidence.

If the video proof passes, it is sent to admin and delivery partner. Refund starts only after approval.

📦 Category-Based Return Policy
👗 Fashion
Return window is 12 hours. Valid reasons are size issue, color mismatch, and damage. Tag must be attached. Product should not have stains, smell, perfume, wrinkles, or wear signs. Delivery image and return image must match.

💻 Electronics
Return is allowed only for genuine issue or external damage. Serial number must match. Usage and activation should be acceptable. Accessories must be complete. Product image must match delivery proof.

🧰 Tools
Tools are checked for scratches, dust, oil, damage, missing parts, and working condition during delivery and return.

🍔 Food & Beverages
Food returns require app-only video proof. The system checks motion, torch, metadata, same-product proof, and screen-fake signals. Refund is initiated only after approval.

🧰 Tech Stack
⚛️ React
⚡ Vite
🧭 React Router DOM
🎨 CSS
🖼️ Lucide React Icons
💾 LocalStorage mock database
🚫 No backend required

💾 Data Storage
The prototype stores data in browser LocalStorage:

👤 Users
📦 Orders
↩️ Returns
🛒 Cart
❤️ Wishlist
🏪 Sellers
🛡️ Admin session
🎨 Theme preference

🔄 Demo Flow
1. 🛒 User Orders Product
User logs in, selects a product, clicks Buy Now, places the order, and the order goes to admin confirmation.

2. 🛡️ Admin Confirms Order
Admin opens the admin portal, confirms the order, and the order appears in the delivery partner portal.

3. 🚚 Delivery Partner Completes Delivery
Delivery partner verifies OTP, uploads product photo, clicks continue, and the customer order status becomes Delivered.

4. ↩️ User Requests Return
User opens the return page, selects a delivered product, enters return reason, uploads bill proof, and for food items records app-only video proof.

5. ✅ Return Verification
For normal products, delivery partner compares delivery image and return image, checks OTP, verifies category rules, and approves or cancels return.

For food items, video proof is sent to admin and delivery partner. Refund starts only after approval.

🎯 Project Purpose
This project is built for hackathons and demos. It shows how return fraud can be reduced using delivery proof, OTP verification, product-specific return rules, bill QR validation, image comparison, food video verification, seller fraud detection, and admin approval workflows.

🚀 Future Improvements
Real backend database
Real OTP service
Real QR scanning
Payment gateway integration
Delivery tracking API
