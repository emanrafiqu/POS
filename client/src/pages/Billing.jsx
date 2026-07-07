import { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent, Minus, PauseCircle, PlayCircle, Plus, QrCode,
  ShoppingCart, StickyNote, Trash2, UserPlus, X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getProducts } from '@/services/productService';
import { getCustomers, createCustomer } from '@/services/customerService';
import { checkoutSale, holdBill, getHeldBills, deleteHeldBill } from '@/services/saleService';
import { applyCoupon, incrementCouponUse } from '@/services/discountService';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field, Textarea } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { QRScannerModal } from '@/components/scanner/QRScannerModal';
import { PaymentDialog } from '@/components/billing/PaymentDialog';
import { ReceiptDialog } from '@/components/receipt/Receipt';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { playSuccessSound } from '@/utils/sound';

export default function Billing() {
  const { user } = useAuth();
  const cart = useCart();
  const { items, customer, coupon, manualDiscount, notes, totals } = cart;

  const { data: products, reload: reloadProducts } = useAsyncData(getProducts, []);
  const { data: customers, reload: reloadCustomers } = useAsyncData(getCustomers, []);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [category, setCategory] = useState('all');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [heldBills, setHeldBills] = useState([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const categories = useMemo(
    () => ['all', ...new Set((products || []).map((p) => p.category).filter(Boolean))],
    [products]
  );

  const filtered = useMemo(() => {
    const list = (products || []).filter((p) => !p.archived);
    const q = debouncedSearch.toLowerCase();
    return list
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, debouncedSearch, category]);

  /* ---------------- Cart actions ---------------- */
  const addToCart = (product) => {
    if ((Number(product.stockQuantity) || 0) <= 0) {
      toast.warn(`"${product.name}" is out of stock.`);
      return;
    }
    const inCart = items.find((i) => i.productId === product.id);
    if (inCart && inCart.quantity >= inCart.maxStock) {
      toast.warn(`Only ${inCart.maxStock} units of "${product.name}" available.`);
      return;
    }
    cart.addProduct(product);
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const result = await applyCoupon(couponInput, {
        subtotal: totals.subtotal,
        customer,
        cartCategories: [...new Set(items.map((i) => (products || []).find((p) => p.id === i.productId)?.category))],
      });
      cart.setCoupon(result);
      toast.success(`Coupon ${result.code} applied — ${formatCurrency(result.amount)} off.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleHold = async () => {
    if (items.length === 0) return;
    try {
      await holdBill({
        items, customer, coupon, manualDiscount, notes,
        heldBy: user.name,
        label: customer?.name || `Bill · ${items.length} items`,
      });
      cart.clearCart();
      setCouponInput('');
      setDiscountInput('');
      toast.info('Bill held. Resume it anytime from "Held Bills".');
    } catch {
      toast.error('Could not hold this bill.');
    }
  };

  const openHeldBills = async () => {
    setHoldOpen(true);
    try {
      setHeldBills(await getHeldBills());
    } catch {
      toast.error('Failed to load held bills.');
    }
  };

  const resumeBill = async (bill) => {
    cart.restoreCart({
      items: bill.items,
      customer: bill.customer,
      coupon: bill.coupon,
      manualDiscount: bill.manualDiscount || 0,
      notes: bill.notes || '',
    });
    await deleteHeldBill(bill.id);
    setHoldOpen(false);
    toast.success('Bill resumed.');
  };

  const handleCheckout = async ({ payments, amountPaid, changeDue }) => {
    setCheckingOut(true);
    try {
      const sale = await checkoutSale({
        cart: items,
        customer,
        totals: { ...totals, amountPaid, changeDue },
        payments,
        notes,
        coupon: coupon?.code || null,
        cashier: { uid: user.uid, name: user.name },
      });
      if (coupon?.code) incrementCouponUse(coupon.code);
      playSuccessSound();
      setPaymentOpen(false);
      setCompletedSale(sale);
      cart.clearCart();
      setCouponInput('');
      setDiscountInput('');
      reloadProducts();
      if (customer) reloadCustomers();
    } catch (err) {
      toast.error(err.message || 'Checkout failed.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('Name and phone are required.');
      return;
    }
    try {
      const id = await createCustomer(newCustomer);
      cart.setCustomer({ id, ...newCustomer });
      setNewCustomerOpen(false);
      setNewCustomer({ name: '', phone: '' });
      reloadCustomers();
      toast.success('Customer added and attached to this bill.');
    } catch {
      toast.error('Could not add the customer.');
    }
  };

  // Keyboard shortcut: F2 opens the scanner
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setScannerOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      {/* ============ LEFT: product catalogue ============ */}
      <div className="xl:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or SKU…" className="flex-1 min-w-52" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
            {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </Select>
          <Button variant="gold" onClick={() => setScannerOpen(true)} title="F2">
            <QrCode className="h-4 w-4" /> Scan Product
          </Button>
        </div>

        <div className="grid max-h-[calc(100vh-220px)] grid-cols-2 gap-3 overflow-y-auto pb-2 pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const out = (p.stockQuantity || 0) <= 0;
            const price = p.discountPrice || p.sellingPrice;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={out}
                className="group rounded-2xl border border-ink/5 bg-white p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-gold disabled:opacity-45"
              >
                <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-xl bg-surface">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ShoppingCart className="h-7 w-7 text-ink/15" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-medium leading-snug">{p.name}</p>
                <p className="mt-0.5 text-[10px] text-ink/40">{p.sku} · {p.size}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold-dark">{formatCurrency(price)}</span>
                  {out
                    ? <Badge variant="danger">Out</Badge>
                    : p.stockQuantity <= (p.minStock || 10) && <Badge variant="warning">{p.stockQuantity} left</Badge>}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-ink/40">No products match your search.</p>
          )}
        </div>
      </div>

      {/* ============ RIGHT: cart / bill ============ */}
      <div className="xl:col-span-2">
        <div className="flex h-full flex-col rounded-2xl border border-ink/5 bg-white shadow-soft">
          {/* Customer */}
          <div className="border-b border-ink/5 p-4">
            <div className="flex items-center gap-2">
              <Select
                value={customer?.id || ''}
                onChange={(e) => {
                  const c = (customers || []).find((x) => x.id === e.target.value);
                  cart.setCustomer(c || null);
                }}
                className="flex-1"
                aria-label="Select customer"
              >
                <option value="">Walk-in Customer</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => setNewCustomerOpen(true)} title="Add customer">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            {customer && (
              <p className="mt-2 text-xs text-ink/50">
                <Badge variant="gold">{customer.membershipLevel || 'Member'}</Badge>{' '}
                {customer.rewardPoints || 0} points · wallet {formatCurrency(customer.walletBalance || 0)}
              </p>
            )}
          </div>

          {/* Cart items */}
          <div className="min-h-48 flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-ink/30">
                <ShoppingCart className="h-10 w-10" />
                <p className="text-sm">Cart is empty — scan or tap a product.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 rounded-xl border border-ink/5 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-ink/45">{item.sku} · {formatCurrency(item.unitPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="subtle" size="icon" className="h-7 w-7" onClick={() => cart.setQuantity(item.productId, item.quantity - 1)} aria-label="Decrease quantity">
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button variant="subtle" size="icon" className="h-7 w-7" onClick={() => cart.setQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxStock} aria-label="Increase quantity">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <span className="w-20 text-right text-sm font-semibold">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    <button onClick={() => cart.removeItem(item.productId)} className="text-ink/30 hover:text-red-500" aria-label="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discounts */}
          <div className="space-y-2 border-t border-ink/5 p-4">
            {coupon ? (
              <div className="flex items-center justify-between rounded-xl bg-gold-faint px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-gold-dark">
                  <BadgePercent className="h-4 w-4" /> {coupon.code} — {formatCurrency(coupon.amount)} off
                </span>
                <button onClick={() => cart.setCoupon(null)} aria-label="Remove coupon"><X className="h-4 w-4 text-ink/40" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" className="h-9 flex-1 text-xs" />
                <Button variant="outline" size="sm" className="h-9" onClick={handleApplyCoupon}>Apply</Button>
                <Input
                  type="number" min="0" value={discountInput}
                  onChange={(e) => { setDiscountInput(e.target.value); cart.setManualDiscount(e.target.value); }}
                  placeholder="Flat disc." className="h-9 w-24 text-xs"
                  aria-label="Manual flat discount"
                />
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1 pt-1 text-sm">
              <div className="flex justify-between text-ink/60"><span>Subtotal ({totals.itemCount} items)</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatCurrency(totals.discount)}</span></div>}
              <div className="flex justify-between text-ink/60"><span>Tax ({totals.taxRate}%)</span><span>{formatCurrency(totals.taxAmount)}</span></div>
              <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold">
                <span>Grand Total</span><span className="text-gold-dark">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <Button variant="subtle" size="sm" onClick={handleHold} disabled={items.length === 0} title="Hold bill">
                <PauseCircle className="h-4 w-4" /> Hold
              </Button>
              <Button variant="subtle" size="sm" onClick={openHeldBills} title="Resume a held bill">
                <PlayCircle className="h-4 w-4" /> Resume
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setNotesOpen(true)} title="Bill notes">
                <StickyNote className="h-4 w-4" /> {notes ? 'Note ✓' : 'Note'}
              </Button>
              <Button
                variant="destructive" size="sm"
                onClick={() => { cart.clearCart(); setCouponInput(''); setDiscountInput(''); }}
                disabled={items.length === 0} title="Cancel bill"
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
            <Button variant="gold" size="lg" className="w-full" disabled={items.length === 0} onClick={() => setPaymentOpen(true)}>
              Charge {formatCurrency(totals.grandTotal)}
            </Button>
          </div>
        </div>
      </div>

      {/* ============ Dialogs ============ */}
      <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onProductScanned={addToCart} />

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        grandTotal={totals.grandTotal}
        onConfirm={handleCheckout}
        loading={checkingOut}
      />

      <ReceiptDialog sale={completedSale} open={!!completedSale} onClose={() => setCompletedSale(null)} />

      {/* Held bills */}
      <Dialog open={holdOpen} onClose={() => setHoldOpen(false)} title="Held Bills">
        {heldBills.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">No bills on hold.</p>
        ) : (
          <div className="space-y-2">
            {heldBills.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-ink/5 p-3">
                <div>
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="text-xs text-ink/45">{b.items?.length} items · held by {b.heldBy} · {formatDateTime(b.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="gold" size="sm" onClick={() => resumeBill(b)}>Resume</Button>
                  <Button variant="ghost" size="icon" onClick={async () => { await deleteHeldBill(b.id); setHeldBills((p) => p.filter((x) => x.id !== b.id)); }} aria-label="Delete held bill">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* Notes */}
      <Dialog open={notesOpen} onClose={() => setNotesOpen(false)} title="Bill Notes">
        <Textarea value={notes} onChange={(e) => cart.setNotes(e.target.value)} placeholder="e.g. Gift wrap the blue kurta…" rows={4} />
        <div className="mt-4 flex justify-end">
          <Button variant="gold" onClick={() => setNotesOpen(false)}>Save Note</Button>
        </div>
      </Dialog>

      {/* Quick add customer */}
      <Dialog open={newCustomerOpen} onClose={() => setNewCustomerOpen(false)} title="Quick Add Customer">
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
          </Field>
          <Field label="Phone" required>
            <Input value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} placeholder="+92 3xx xxxxxxx" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={handleAddCustomer}>Add & Attach</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
