# Veloura — Clothing Point of Sale (POS) System

A production-quality, web-based POS for clothing stores. Black / white / gold premium UI, built with React + Firebase, featuring QR product labels, a laptop-webcam scanner, full billing, inventory, customers, suppliers, employees, expenses, discounts, reports and backups.

![Stack](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth%20%7C%20Storage-orange) ![Express](https://img.shields.io/badge/Express-4-green)

---

## Features

| Module | Highlights |
| --- | --- |
| **Auth** | Firebase email/password login, remember-me, forgot password, email verification, role-based routes (admin / manager / cashier), configurable session timeout with auto-logout, immutable activity logs |
| **Dashboard** | Today/monthly sales, revenue, profit, expenses, low/out-of-stock alerts, revenue & orders charts (Chart.js), inventory doughnut, top products/customers, peak-hour analytics, recent transactions |
| **Products** | Full clothing attributes (size, color, gender, material…), auto SKU + **QR code generation**, multi-image upload with browser-side compression, duplicate/archive/delete, CSV & Excel import/export, printable QR label sheets, inventory history |
| **QR Scanner** | **Laptop webcam scanner** (html5-qrcode) on the billing page — continuous scanning, duplicate-scan debounce, success/error beeps, toast + product-image confirmation, optional stop-after-scan, manual search fallback |
| **Billing (POS)** | Product grid + search + category filter, cart with qty controls, walk-in or registered customers, quick customer add, coupons + manual discounts, tax, notes, hold/resume bills, cancel, **split/mixed payments** (cash, cards, JazzCash, EasyPaisa, bank transfer, gift card, store credit), change calculation |
| **Receipts** | Thermal-style preview, store logo/name, invoice QR, cashier, itemised totals, return policy, browser print + jsPDF download |
| **Inventory** | Atomic stock transactions (no overselling), stock in/out, purchase entries, adjustments, damaged & returned goods, low/out-of-stock notifications, full movement history |
| **Sales** | History with search/filter, refunds (full or per-item) with automatic restock, exchange workflow, receipt reprint |
| **CRM** | Customers with reward points, membership tiers, wallet, purchase history; suppliers with outstanding balances and payment recording; employees with roles, salary, attendance and permissions |
| **Finance** | Expense tracking by category with monthly filtering, 12 report types (sales, profit, inventory, low stock, customer, supplier, cashier, expense, discount, payment, tax, returns) with **PDF, Excel and print export** |
| **Admin** | User management via Firebase Admin SDK, store settings (tax, currency, receipt template, hours, language), **one-click database backup & restore** to Firebase Storage |

## Technology Stack

- **Frontend:** React 18, Vite, Tailwind CSS, ShadCN-style component kit, React Router 6, React Hook Form, Context API, Chart.js, Lucide icons, React Toastify
- **QR:** `qrcode` (generation) + `html5-qrcode` (webcam scanning)
- **PDF:** jsPDF + autotable · **Sheets:** PapaParse + SheetJS
- **Backend:** Node.js + Express (privileged ops: users, backup/restore, seeding)
- **Firebase:** Firestore, Authentication, Storage, Hosting

## Project Structure

```
POS/
├── client/                     # React app (Vite)
│   └── src/
│       ├── components/         # ui kit, billing, scanner, receipt, common
│       ├── pages/              # route pages (auth, products, billing, …)
│       ├── layouts/            # Sidebar, Topbar, DashboardLayout
│       ├── context/            # Auth, Settings, Cart providers
│       ├── services/           # Firestore + API domain services
│       ├── hooks/              # useAsyncData, useDebounce, usePagination
│       ├── firebase/           # Firebase SDK config
│       ├── utils/              # formatting, QR, PDF, CSV/Excel, sounds
│       ├── constants/          # roles, nav, payment methods
│       └── styles/             # Tailwind entry + print styles
├── server/                     # Express API (Firebase Admin SDK)
│   └── src/
│       ├── routes/             # users, backup, seed
│       ├── services/           # seedService (demo data generator)
│       ├── middleware/         # auth (ID-token verify), error handler
│       ├── scripts/            # CLI seeder
│       └── config/             # Admin SDK init
├── firestore.rules             # Role-based security rules
├── firestore.indexes.json      # Composite indexes
├── storage.rules               # Image upload rules
└── firebase.json               # Hosting / rules deployment config
```

---

## Installation Guide

### 1. Prerequisites

- Node.js 18+ and npm
- A [Firebase project](https://console.firebase.google.com) (free Spark plan works; Storage requires Blaze for some regions)

### 2. Firebase setup

1. **Create a project** in the Firebase console.
2. **Authentication →** enable the **Email/Password** provider.
3. **Firestore Database →** create a database (production mode).
4. **Storage →** create the default bucket.
5. **Project Settings → General →** add a **Web app** and copy its config values.
6. **Project Settings → Service Accounts →** *Generate new private key* → save the JSON as `server/serviceAccountKey.json` (git-ignored).

### 3. Configure environment variables

```bash
# Frontend
cd client
copy .env.example .env        # then paste your web app config values

# Backend
cd ../server
copy .env.example .env        # set GOOGLE_APPLICATION_CREDENTIALS + FIREBASE_STORAGE_BUCKET
```

### 4. Install & run

```bash
# Terminal 1 — API server (http://localhost:5000)
cd server
npm install
npm run dev

# Terminal 2 — web app (http://localhost:5173, proxies /api to :5000)
cd client
npm install
npm run dev
```

### 5. Deploy security rules & indexes

```bash
npm install -g firebase-tools
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 6. Seed the database (demo data + first admin)

Creates the admin account, 50 clothing products (with SKUs/QR data), 20 customers, 10 suppliers, 5 employees, 100 sales, expenses, discounts and store settings. Only runs while the `users` collection is empty.

```bash
cd server
npm run seed -- admin@veloura.pk YourPassword123 "Store Admin"
```

(or `POST /api/seed` with `{ adminEmail, adminPassword, adminName }`.)

Then sign in at `http://localhost:5173` with the admin credentials, and create manager/cashier accounts from **Users**.

### 7. Printing QR labels

**Products → Print QR Labels** opens a print-ready sheet (allow popups). Stick labels on garments; the billing page's **Scan Product** button reads them with the laptop webcam. Camera access requires `localhost` or HTTPS.

---

## Deployment Guide

### Frontend → Firebase Hosting

```bash
cd client
npm run build
cd ..
firebase deploy --only hosting
```

### Backend → any Node host (Cloud Run recommended)

The Express server is stateless — deploy `server/` to Cloud Run, Railway, Render or a VPS:

```bash
# Cloud Run example
gcloud run deploy veloura-api --source server --region us-central1 --allow-unauthenticated
```

- Set env vars (`FIREBASE_STORAGE_BUCKET`, `CORS_ORIGINS=https://your-app.web.app`). On Google infrastructure you can omit the JSON key and rely on the default service account.
- `firebase.json` already rewrites `/api/**` to a Cloud Run service named `veloura-api`; adjust if you host elsewhere and set `VITE_API_BASE_URL` accordingly.

### Production checklist

- [ ] Firestore rules + indexes deployed
- [ ] Storage rules deployed
- [ ] Seeding done (it self-disables once users exist)
- [ ] CORS origins restricted to your hosting domain
- [ ] Backups scheduled (Settings → Backup Now, or cron-call `POST /api/backup`)

## Security

- Firebase Auth with role claims; profile + status re-checked on every session
- Firestore rules enforce admin/manager/cashier boundaries server-side (cashiers cannot delete products or read financial data)
- Immutable `activityLogs` audit trail (rules forbid update/delete)
- Privileged operations only via the Express API after ID-token verification
- Helmet, rate limiting and strict CORS on the API
- Session timeout with automatic logout (configurable in Settings)

## Default Roles

| Role | Access |
| --- | --- |
| **Admin** | Everything: users, settings, backup/restore, all modules |
| **Manager** | Inventory, sales, reports, customers, suppliers, employees (view), expenses, discounts — no user deletion or system settings |
| **Cashier** | Billing, QR scanning, receipts, product & customer lookup — no deletions, no financial reports |

## License

MIT — built as a reference implementation for Veloura.
