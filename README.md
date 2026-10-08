# 🛍️ Community Store
### Campus & Local Marketplace

**Community Store** is a mobile-friendly digital marketplace designed to connect students, faculty members, local vendors, and residents around the District 6 campus community in Cape Town, South Africa.

The platform provides a convenient and secure environment for buying and selling products, communicating with sellers, discovering community announcements, and supporting local businesses.

## 🎯 Project Objectives

- Provide an affordable and accessible marketplace for students and the local community.
- Support small businesses and local vendors.
- Encourage sustainability through buying and selling second-hand products.
- Improve trust through vendor verification, user reviews, and reporting.
- Enable convenient communication between buyers and sellers.

## ✨ Features

### 👤 User Authentication
- Email and Google sign-in
- Student, Faculty, Resident, and Vendor accounts
- User profiles and profile pictures
- Role-based access control

### 🛒 Marketplace
- Create, edit, hide, and delete product listings
- Upload product images
- Search products by keywords
- Filter by category, price, and condition
- Verified vendor badges
- Product stock management

### 💳 Shopping & Payments
- Shopping cart and checkout
- Simulated card and Instant EFT payments
- Cash-on-collection option
- Order history and order status tracking
- Simulated refunds for cancelled paid orders

**Note:** All electronic payments are simulated for demonstration and testing purposes. No real money is transferred.

### ⭐ Ratings & Reviews
- Seller ratings and written reviews
- Reviews linked to purchases
- Seller reputation information

### 📢 Community Bulletin Board
- Community announcements
- Local events
- Administrator-pinned posts

### 🛡️ Security & Moderation
- Report suspicious product listings
- Vendor verification
- Administrator review of reports
- User suspension and reinstatement
- Role-based permissions

### 📊 Admin Dashboard
- User and vendor management
- Vendor verification approvals
- Product moderation
- Order monitoring
- Report management
- Marketplace statistics

### 🔔 Notifications
- Order updates
- Payment status updates
- Vendor verification notifications
- Reports and moderation updates
- New message alerts

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Lovable | Application development |
| Supabase | Backend services and database |
| Web frontend | Responsive user interface |
| Authentication services | User registration and login |
| Cloud storage | Product and profile images |
| GitHub | Version control and collaboration |

*The exact frontend framework and dependencies can be confirmed in the repository's source files.*

## 👥 Target Users

- **Students:** Buy and sell affordable textbooks, electronics, and other items.
- **Faculty:** Access marketplace products and services.
- **Residents:** Participate in local buying, selling, and community activities.
- **Vendors:** Advertise products and manage sales.
- **Administrators:** Manage users, verify vendors, and maintain platform safety.


## 🧪 Testing

Community Store uses simulated payment functionality for development and demonstrations.

**Test card examples:**

- Successful payment: `4242 4242 4242 4242`
- Declined payment: A test card number ending in `0000`

The application should also be tested for authentication, product management, checkout, role-based permissions, messaging, and administrative functionality.

## 🔐 Privacy & Security

Community Store is designed with secure authentication, role-based authorization, protected user data, and administrator moderation.

The project aims to follow South Africa's Protection of Personal Information Act (POPIA) principles.

Security and privacy compliance must be verified before public production deployment.


## 📍 Project Scope

The initial marketplace focuses on the District 6 campus and surrounding communities in Cape Town.

Physical delivery and logistics are not managed by the application. Buyers and sellers arrange collection independently.

## 🎓 Academic Project

Developed as part of the **Project Management (PRM372S)** academic project at the **Cape Peninsula University of Technology (CPUT)**.

### Project Team

- Owenkosi Nxasana — Project Manager, Backend & Frontend Developer
- Simphiwe Nkosi — Backend Developer
- Pertunia Sifunda — Quality Assurance
- Nomhle Njengele — Security Specialist
- Thandeka Malande — Community Liaison

## 📌 Project Status

Community Store is under development and testing.

The application includes marketplace functionality, user accounts, simulated checkout, vendor management, community features, and administrative tools.

Additional features and integrations are being developed and validated.

---

**Community Store — Connecting Campus and Community.**

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
