import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText, Shirt, Truck, User } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce } from '@/hooks/useDebounce';
import { getProducts } from '@/services/productService';
import { getCustomers } from '@/services/customerService';
import { getSuppliers } from '@/services/supplierService';
import { findSaleByInvoice } from '@/services/saleService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/format';

/**
 * Global search across products (name/SKU/QR), customers, suppliers
 * and exact invoice numbers. Data is loaded once when opened, then
 * filtered client-side for instant results.
 */
export function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [term, setTerm] = useState('');
  const [data, setData] = useState(null);
  const [invoiceHit, setInvoiceHit] = useState(null);
  const debounced = useDebounce(term, 250);

  useEffect(() => {
    if (!open || data) return;
    (async () => {
      try {
        const [products, customers, suppliers] = await Promise.all([
          getProducts(),
          getCustomers(),
          hasRole('admin', 'manager') ? getSuppliers() : Promise.resolve([]),
        ]);
        setData({ products, customers, suppliers });
      } catch (err) {
        console.error('[GlobalSearch]', err);
        setData({ products: [], customers: [], suppliers: [] });
      }
    })();
  }, [open, data, hasRole]);

  // Invoice lookup (exact match, e.g. "INV-240705-1234")
  useEffect(() => {
    setInvoiceHit(null);
    if (/^inv-/i.test(debounced.trim())) {
      findSaleByInvoice(debounced.toUpperCase()).then(setInvoiceHit).catch(() => {});
    }
  }, [debounced]);

  const results = useMemo(() => {
    if (!data || debounced.trim().length < 2) return null;
    const q = debounced.toLowerCase();
    const match = (...fields) => fields.some((f) => (f || '').toLowerCase().includes(q));
    return {
      products: data.products.filter((p) => match(p.name, p.sku, p.category, p.brand)).slice(0, 6),
      customers: data.customers.filter((c) => match(c.name, c.phone, c.email)).slice(0, 4),
      suppliers: data.suppliers.filter((s) => match(s.name, s.phone)).slice(0, 3),
    };
  }, [data, debounced]);

  const go = (path) => {
    onClose();
    setTerm('');
    navigate(path);
  };

  const Section = ({ icon: Icon, title, children }) => (
    <div className="mb-3">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );

  const Row = ({ onClick, primary, secondary }) => (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-gold-faint">
      <span className="truncate text-sm font-medium">{primary}</span>
      <span className="ml-3 shrink-0 text-xs text-ink/45">{secondary}</span>
    </button>
  );

  return (
    <Dialog open={open} onClose={onClose} title="Global Search" subtitle="Products · SKU/QR · Customers · Invoices · Suppliers">
      <SearchInput value={term} onChange={setTerm} placeholder="Type at least 2 characters…" />
      <div className="mt-4 min-h-[120px]">
        {open && !data && <div className="flex justify-center py-8"><Spinner /></div>}
        {invoiceHit && (
          <Section icon={ReceiptText} title="Invoice">
            <Row onClick={() => go(`/sales?invoice=${invoiceHit.invoiceNumber}`)} primary={invoiceHit.invoiceNumber} secondary={formatCurrency(invoiceHit.grandTotal)} />
          </Section>
        )}
        {results && (
          <>
            {results.products.length > 0 && (
              <Section icon={Shirt} title="Products">
                {results.products.map((p) => (
                  <Row key={p.id} onClick={() => go(`/products?highlight=${p.id}`)} primary={p.name} secondary={`${p.sku} · ${formatCurrency(p.sellingPrice)}`} />
                ))}
              </Section>
            )}
            {results.customers.length > 0 && (
              <Section icon={User} title="Customers">
                {results.customers.map((c) => (
                  <Row key={c.id} onClick={() => go(`/customers?highlight=${c.id}`)} primary={c.name} secondary={c.phone} />
                ))}
              </Section>
            )}
            {results.suppliers.length > 0 && (
              <Section icon={Truck} title="Suppliers">
                {results.suppliers.map((s) => (
                  <Row key={s.id} onClick={() => go(`/suppliers?highlight=${s.id}`)} primary={s.name} secondary={s.phone} />
                ))}
              </Section>
            )}
            {!invoiceHit && results.products.length + results.customers.length + results.suppliers.length === 0 && (
              <p className="py-8 text-center text-sm text-ink/40">No results for “{debounced}”.</p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
