export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'EasyPaisa' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'store_credit', label: 'Store Credit' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
export const GENDERS = ['Men', 'Women', 'Unisex', 'Kids'];
export const MATERIALS = ['Cotton', 'Denim', 'Linen', 'Polyester', 'Wool Blend', 'Silk', 'Viscose', 'Leather'];
export const COLORS = ['Black', 'White', 'Gold', 'Navy', 'Beige', 'Olive', 'Maroon', 'Grey', 'Sky Blue', 'Rust', 'Red', 'Green'];

export const EXPENSE_CATEGORIES = [
  'Electricity', 'Rent', 'Internet', 'Salary', 'Maintenance', 'Transport', 'Miscellaneous',
];

export const MEMBERSHIP_LEVELS = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export const INVENTORY_TYPES = [
  { value: 'stock_in', label: 'Stock In' },
  { value: 'stock_out', label: 'Stock Out' },
  { value: 'purchase', label: 'Purchase Entry' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'returned', label: 'Returned' },
];

export const SALE_STATUS = {
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  EXCHANGED: 'exchanged',
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/** Sidebar navigation with role gating. */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin', 'manager', 'cashier'] },
  { to: '/billing', label: 'Billing (POS)', icon: 'ShoppingCart', roles: ['admin', 'manager', 'cashier'] },
  { to: '/sales', label: 'Sales History', icon: 'ReceiptText', roles: ['admin', 'manager', 'cashier'] },
  { to: '/products', label: 'Products', icon: 'Shirt', roles: ['admin', 'manager', 'cashier'] },
  { to: '/inventory', label: 'Inventory', icon: 'Boxes', roles: ['admin', 'manager'] },
  { to: '/customers', label: 'Customers', icon: 'Users', roles: ['admin', 'manager', 'cashier'] },
  { to: '/suppliers', label: 'Suppliers', icon: 'Truck', roles: ['admin', 'manager'] },
  { to: '/employees', label: 'Employees', icon: 'IdCard', roles: ['admin', 'manager'] },
  { to: '/expenses', label: 'Expenses', icon: 'Wallet', roles: ['admin', 'manager'] },
  { to: '/discounts', label: 'Discounts', icon: 'BadgePercent', roles: ['admin', 'manager'] },
  { to: '/reports', label: 'Reports', icon: 'BarChart3', roles: ['admin', 'manager'] },
  { to: '/activity-logs', label: 'Activity Logs', icon: 'History', roles: ['admin', 'manager'] },
  { to: '/users', label: 'Users', icon: 'ShieldCheck', roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: 'Settings', roles: ['admin'] },
];
