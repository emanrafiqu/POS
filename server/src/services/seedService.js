import { auth, db, Timestamp } from '../config/firebase.js';

/* ------------------------------------------------------------------ */
/* Deterministic-ish random helpers                                    */
/* ------------------------------------------------------------------ */
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const pickMany = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(9, 21), rand(0, 59), rand(0, 59), 0);
  return d;
};

/* ------------------------------------------------------------------ */
/* Source data                                                         */
/* ------------------------------------------------------------------ */
const CATEGORIES = {
  'T-Shirts':   ['Crew Neck', 'V-Neck', 'Polo', 'Graphic'],
  'Shirts':     ['Casual', 'Formal', 'Denim', 'Flannel'],
  'Jeans':      ['Slim Fit', 'Straight', 'Skinny', 'Relaxed'],
  'Dresses':    ['Maxi', 'Midi', 'Casual', 'Evening'],
  'Jackets':    ['Bomber', 'Denim', 'Leather', 'Puffer'],
  'Hoodies':    ['Pullover', 'Zip-Up', 'Oversized'],
  'Trousers':   ['Chinos', 'Formal', 'Cargo'],
  'Kurtas':     ['Casual', 'Embroidered', 'Festive'],
  'Sweaters':   ['Cardigan', 'Turtleneck', 'Knit'],
  'Activewear': ['Track Pants', 'Sports Tee', 'Leggings'],
};

const BRANDS = ['Veloura Signature', 'Urban Thread', 'Nova Denim', 'Silk Route', 'Apex Wear', 'Meraki', 'Cotton Club'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Gold', 'Navy', 'Beige', 'Olive', 'Maroon', 'Grey', 'Sky Blue', 'Rust'];
const MATERIALS = ['Cotton', 'Denim', 'Linen', 'Polyester', 'Wool Blend', 'Silk', 'Viscose'];
const GENDERS = ['Men', 'Women', 'Unisex'];
const ADJECTIVES = ['Classic', 'Premium', 'Essential', 'Vintage', 'Modern', 'Luxe', 'Signature', 'Heritage', 'Urban', 'Coastal'];

const FIRST_NAMES = ['Ayesha', 'Ahmed', 'Fatima', 'Hassan', 'Zainab', 'Ali', 'Sana', 'Usman', 'Hira', 'Bilal', 'Mariam', 'Hamza', 'Noor', 'Fahad', 'Iqra', 'Danish', 'Rabia', 'Saad', 'Amna', 'Taha'];
const LAST_NAMES = ['Khan', 'Malik', 'Sheikh', 'Butt', 'Chaudhry', 'Qureshi', 'Siddiqui', 'Raza', 'Javed', 'Akhtar'];
const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Multan', 'Rawalpindi'];
const PAYMENT_METHODS = ['cash', 'credit_card', 'debit_card', 'jazzcash', 'easypaisa', 'bank_transfer'];
const EXPENSE_CATEGORIES = ['Electricity', 'Rent', 'Internet', 'Salary', 'Maintenance', 'Transport', 'Miscellaneous'];

/* ------------------------------------------------------------------ */
/* Seeder                                                              */
/* ------------------------------------------------------------------ */
export async function seedDatabase({ adminEmail, adminPassword, adminName }) {
  const summary = {};

  /* ---- Admin user (required before anything else) ---- */
  let adminUid;
  try {
    const rec = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
      emailVerified: true,
    });
    adminUid = rec.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      adminUid = (await auth.getUserByEmail(adminEmail)).uid;
    } else throw err;
  }
  await auth.setCustomUserClaims(adminUid, { role: 'admin' });
  await db.collection('users').doc(adminUid).set({
    name: adminName,
    email: adminEmail,
    role: 'admin',
    phone: '+92 300 0000000',
    status: 'active',
    emailVerified: true,
    createdAt: Timestamp.now(),
  });
  summary.admin = adminEmail;

  /* ---- Roles & permissions ---- */
  const rolePerms = {
    admin: ['*'],
    manager: ['products:read', 'products:write', 'inventory:*', 'sales:*', 'reports:*', 'customers:*', 'suppliers:*', 'expenses:*', 'discounts:*'],
    cashier: ['products:read', 'sales:create', 'customers:read', 'customers:create'],
  };
  for (const [role, permissions] of Object.entries(rolePerms)) {
    await db.collection('roles').doc(role).set({ name: role, permissions, createdAt: Timestamp.now() });
  }
  for (const perm of ['products', 'inventory', 'sales', 'reports', 'customers', 'suppliers', 'employees', 'expenses', 'settings', 'users']) {
    await db.collection('permissions').doc(perm).set({ module: perm, actions: ['read', 'create', 'update', 'delete'] });
  }

  /* ---- Categories & brands ---- */
  for (const [name, subCategories] of Object.entries(CATEGORIES)) {
    await db.collection('categories').doc(name.toLowerCase().replace(/\s+/g, '-')).set({
      name, subCategories, status: 'active', createdAt: Timestamp.now(),
    });
  }
  for (const name of BRANDS) {
    await db.collection('brands').doc(name.toLowerCase().replace(/\s+/g, '-')).set({
      name, status: 'active', createdAt: Timestamp.now(),
    });
  }
  summary.categories = Object.keys(CATEGORIES).length;
  summary.brands = BRANDS.length;

  /* ---- Suppliers (10) ---- */
  const supplierIds = [];
  const supplierNames = ['Textile Hub Pk', 'Fabric World', 'Denim Direct', 'Silk Traders', 'Cotton Mills Co', 'Apparel Source', 'Thread & Co', 'Weave Masters', 'Style Imports', 'Garment Depot'];
  for (const [i, name] of supplierNames.entries()) {
    const ref = db.collection('suppliers').doc();
    await ref.set({
      name,
      contactPerson: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      phone: `+92 3${rand(0, 4)}${rand(0, 9)} ${rand(1000000, 9999999)}`,
      email: `contact@${name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      address: `${rand(1, 200)} Industrial Area, ${pick(CITIES)}`,
      productsSupplied: pickMany(Object.keys(CATEGORIES), rand(2, 4)),
      outstandingBalance: i % 3 === 0 ? rand(10000, 150000) : 0,
      totalPurchases: rand(200000, 2000000),
      status: 'active',
      createdAt: Timestamp.fromDate(daysAgo(rand(120, 365))),
    });
    supplierIds.push(ref.id);
  }
  summary.suppliers = supplierIds.length;

  /* ---- Products (50) ---- */
  const products = [];
  const usedSkus = new Set();
  for (let i = 0; i < 50; i++) {
    const category = pick(Object.keys(CATEGORIES));
    const subCategory = pick(CATEGORIES[category]);
    const brand = pick(BRANDS);
    const color = pick(COLORS);
    const gender = pick(GENDERS);
    const name = `${pick(ADJECTIVES)} ${color} ${subCategory} ${category.replace(/s$/, '')}`;

    let sku;
    do {
      sku = `VLR-${category.slice(0, 3).toUpperCase()}-${rand(1000, 9999)}`;
    } while (usedSkus.has(sku));
    usedSkus.add(sku);

    const purchasePrice = rand(800, 6000);
    const sellingPrice = Math.round(purchasePrice * (1.4 + Math.random() * 0.8));
    const hasDiscount = Math.random() < 0.3;
    const stockQuantity = rand(0, 80);

    const ref = db.collection('products').doc();
    const product = {
      name,
      sku,
      productId: ref.id,
      qrData: sku, // QR codes encode the SKU; details are fetched from Firestore
      category,
      subCategory,
      brand,
      size: pick(SIZES),
      color,
      gender,
      material: pick(MATERIALS),
      purchasePrice,
      sellingPrice,
      discountPrice: hasDiscount ? Math.round(sellingPrice * 0.85) : null,
      tax: 5,
      stockQuantity,
      minStock: 10,
      supplierId: pick(supplierIds),
      description: `${name} crafted from premium ${pick(MATERIALS).toLowerCase()}. Part of the Veloura ${pick(['Summer', 'Winter', 'Festive', 'Essentials'])} collection.`,
      images: [],
      status: stockQuantity === 0 ? 'out_of_stock' : 'active',
      archived: false,
      totalSold: 0,
      createdAt: Timestamp.fromDate(daysAgo(rand(30, 300))),
      updatedAt: Timestamp.now(),
    };
    await ref.set(product);
    products.push({ id: ref.id, ...product });
  }
  summary.products = products.length;

  /* ---- Customers (20) ---- */
  const customers = [];
  for (let i = 0; i < 20; i++) {
    const first = FIRST_NAMES[i];
    const last = pick(LAST_NAMES);
    const ref = db.collection('customers').doc();
    const customer = {
      name: `${first} ${last}`,
      phone: `+92 3${rand(0, 4)}${rand(0, 9)} ${rand(1000000, 9999999)}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${rand(1, 99)}@gmail.com`,
      address: `House ${rand(1, 500)}, Block ${pick(['A', 'B', 'C', 'D'])}, ${pick(CITIES)}`,
      gender: i % 2 === 0 ? 'Female' : 'Male',
      birthday: `19${rand(70, 99)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
      rewardPoints: rand(0, 500),
      membershipLevel: pick(['Bronze', 'Silver', 'Gold', 'Platinum']),
      walletBalance: Math.random() < 0.25 ? rand(500, 5000) : 0,
      totalSpent: 0,
      totalOrders: 0,
      notes: '',
      status: 'active',
      createdAt: Timestamp.fromDate(daysAgo(rand(30, 365))),
    };
    await ref.set(customer);
    customers.push({ id: ref.id, ...customer });
  }
  summary.customers = customers.length;

  /* ---- Employees (5) ---- */
  const employeeRoles = ['manager', 'cashier', 'cashier', 'cashier', 'manager'];
  const employees = [];
  for (let i = 0; i < 5; i++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const ref = db.collection('employees').doc();
    const employee = {
      name,
      role: employeeRoles[i],
      phone: `+92 3${rand(0, 4)}${rand(0, 9)} ${rand(1000000, 9999999)}`,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@veloura.pk`,
      salary: employeeRoles[i] === 'manager' ? rand(80000, 120000) : rand(40000, 60000),
      joinDate: daysAgo(rand(90, 700)).toISOString().slice(0, 10),
      attendance: { present: rand(20, 26), absent: rand(0, 4), leave: rand(0, 2) },
      permissions: employeeRoles[i] === 'manager'
        ? ['inventory', 'sales', 'reports', 'customers']
        : ['sales', 'customers'],
      status: 'active',
      createdAt: Timestamp.fromDate(daysAgo(rand(90, 700))),
    };
    await ref.set(employee);
    employees.push({ id: ref.id, ...employee });
  }
  summary.employees = employees.length;

  /* ---- Sales (100) + saleItems + inventory logs ---- */
  const stockLeft = Object.fromEntries(products.map((p) => [p.id, p.stockQuantity + 200])); // seed sales draw from historical stock
  let invoiceNo = 1000;
  for (let i = 0; i < 100; i++) {
    const saleDate = daysAgo(rand(0, 90));
    const customer = Math.random() < 0.7 ? pick(customers) : null;
    const cashier = pick(employees.filter((e) => e.role === 'cashier'));
    const itemCount = rand(1, 4);
    const chosen = pickMany(products, itemCount);

    let subtotal = 0;
    const items = chosen.map((p) => {
      const quantity = rand(1, 3);
      const unitPrice = p.discountPrice || p.sellingPrice;
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      stockLeft[p.id] = Math.max(0, stockLeft[p.id] - quantity);
      return {
        productId: p.id, sku: p.sku, name: p.name, size: p.size, color: p.color,
        quantity, unitPrice, purchasePrice: p.purchasePrice, lineTotal,
      };
    });

    const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.1) : 0;
    const taxAmount = Math.round((subtotal - discount) * 0.05);
    const grandTotal = subtotal - discount + taxAmount;
    const profit = items.reduce((s, it) => s + (it.unitPrice - it.purchasePrice) * it.quantity, 0) - discount;

    const saleRef = db.collection('sales').doc();
    await saleRef.set({
      invoiceNumber: `INV-${invoiceNo++}`,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Walk-in Customer',
      cashierId: cashier.id,
      cashierName: cashier.name,
      items,
      subtotal,
      discount,
      couponCode: null,
      taxRate: 5,
      taxAmount,
      grandTotal,
      profit,
      paymentMethod: pick(PAYMENT_METHODS),
      payments: [{ method: pick(PAYMENT_METHODS), amount: grandTotal }],
      amountPaid: grandTotal,
      changeDue: 0,
      status: Math.random() < 0.05 ? 'refunded' : 'completed',
      notes: '',
      createdAt: Timestamp.fromDate(saleDate),
    });

    // Denormalised sale items for per-product reporting
    for (const it of items) {
      await db.collection('saleItems').add({
        saleId: saleRef.id,
        saleDate: Timestamp.fromDate(saleDate),
        ...it,
        profit: (it.unitPrice - it.purchasePrice) * it.quantity,
      });
      await db.collection('inventory').add({
        productId: it.productId,
        sku: it.sku,
        productName: it.name,
        type: 'stock_out',
        reason: 'sale',
        quantity: -it.quantity,
        referenceId: saleRef.id,
        userId: cashier.id,
        userName: cashier.name,
        createdAt: Timestamp.fromDate(saleDate),
      });
    }

    if (customer) {
      await db.collection('customers').doc(customer.id).update({
        totalSpent: (customer.totalSpent += grandTotal),
        totalOrders: (customer.totalOrders += 1),
        rewardPoints: customer.rewardPoints + Math.floor(grandTotal / 100),
      });
    }
  }
  summary.sales = 100;

  // Update per-product sold counters
  const soldSnap = await db.collection('saleItems').get();
  const soldByProduct = {};
  soldSnap.forEach((d) => {
    const { productId, quantity } = d.data();
    soldByProduct[productId] = (soldByProduct[productId] || 0) + quantity;
  });
  for (const [productId, totalSold] of Object.entries(soldByProduct)) {
    await db.collection('products').doc(productId).update({ totalSold });
  }

  /* ---- Expenses (last 3 months) ---- */
  let expenseCount = 0;
  for (let month = 0; month < 3; month++) {
    for (const category of EXPENSE_CATEGORIES) {
      if (category === 'Miscellaneous' && Math.random() < 0.5) continue;
      const amounts = { Electricity: rand(15000, 40000), Rent: 150000, Internet: 8000, Salary: rand(250000, 320000), Maintenance: rand(5000, 20000), Transport: rand(3000, 12000), Miscellaneous: rand(2000, 10000) };
      await db.collection('expenses').add({
        category,
        title: `${category} — monthly`,
        amount: amounts[category],
        date: daysAgo(month * 30 + rand(1, 15)).toISOString().slice(0, 10),
        paymentMethod: category === 'Rent' ? 'bank_transfer' : 'cash',
        notes: '',
        createdBy: adminUid,
        createdAt: Timestamp.fromDate(daysAgo(month * 30 + rand(1, 15))),
      });
      expenseCount++;
    }
  }
  summary.expenses = expenseCount;

  /* ---- Discounts ---- */
  const discounts = [
    { code: 'WELCOME10', type: 'percentage', value: 10, scope: 'all', minPurchase: 2000, active: true, description: 'New customer welcome discount' },
    { code: 'FLAT500', type: 'flat', value: 500, scope: 'all', minPurchase: 5000, active: true, description: 'Flat Rs. 500 off' },
    { code: 'EIDSALE', type: 'percentage', value: 20, scope: 'all', minPurchase: 0, active: true, description: 'Eid festival sale' },
    { code: 'GOLD15', type: 'percentage', value: 15, scope: 'members', minPurchase: 0, active: true, description: 'Gold member exclusive' },
    { code: 'WINTER25', type: 'percentage', value: 25, scope: 'category', category: 'Jackets', minPurchase: 0, active: false, description: 'Winter season sale' },
  ];
  for (const d of discounts) {
    await db.collection('discounts').doc(d.code).set({ ...d, usedCount: rand(0, 40), createdAt: Timestamp.now() });
  }
  summary.discounts = discounts.length;

  /* ---- Settings ---- */
  await db.collection('settings').doc('store').set({
    storeName: 'Veloura',
    tagline: 'Premium Fashion Store',
    logoUrl: '',
    address: 'Shop 12, Gulberg Galleria, Lahore',
    phone: '+92 42 3575 0000',
    email: 'hello@veloura.pk',
    taxRate: 5,
    currency: 'PKR',
    currencySymbol: 'Rs.',
    receiptFooter: 'Thank you for shopping at Veloura!',
    returnPolicy: 'Items can be exchanged within 14 days with the original receipt.',
    businessHours: { open: '10:00', close: '22:00' },
    language: 'en',
    lowStockThreshold: 10,
    sessionTimeoutMinutes: 30,
    theme: 'light',
    updatedAt: Timestamp.now(),
  });

  /* ---- Welcome notification ---- */
  await db.collection('notifications').add({
    type: 'system',
    title: 'Database seeded',
    message: 'Veloura POS demo data has been generated successfully.',
    read: false,
    createdAt: Timestamp.now(),
  });

  return summary;
}
