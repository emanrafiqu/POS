import { useMemo, useState } from 'react';
import { endOfDay, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getSalesBetween } from '@/services/saleService';
import { getProducts } from '@/services/productService';
import { getExpenses } from '@/services/expenseService';
import { getCustomers } from '@/services/customerService';
import { getSuppliers } from '@/services/supplierService';
import { getAll, orderBy as fsOrderBy, limit as fsLimit } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { downloadReportPdf, groupByDay } from '@/utils/pdf';
import { exportExcel } from '@/utils/exportData';
import { formatCurrency, formatDate, toDate } from '@/utils/format';

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'profit', label: 'Profit Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'low_stock', label: 'Low Stock Report' },
  { value: 'customer', label: 'Customer Report' },
  { value: 'supplier', label: 'Supplier Report' },
  { value: 'cashier', label: 'Cashier Report' },
  { value: 'expense', label: 'Expense Report' },
  { value: 'discount', label: 'Discount Report' },
  { value: 'payment', label: 'Payment Methods Report' },
  { value: 'tax', label: 'Tax Report' },
  { value: 'returns', label: 'Returns Report' },
];

const RANGES = {
  today: { label: 'Today', from: () => startOfDay(new Date()) },
  week: { label: 'This Week', from: () => startOfWeek(new Date()) },
  month: { label: 'This Month', from: () => startOfMonth(new Date()) },
  '90d': { label: 'Last 90 Days', from: () => subDays(new Date(), 90) },
  year: { label: 'This Year', from: () => startOfYear(new Date()) },
  custom: { label: 'Custom range', from: null },
};

export default function Reports() {
  const [type, setType] = useState('sales');
  const [range, setRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(() => {
    if (range === 'custom' && customFrom) {
      return {
        from: startOfDay(new Date(customFrom)),
        to: endOfDay(customTo ? new Date(customTo) : new Date()),
      };
    }
    return { from: (RANGES[range].from || RANGES.month.from)(), to: endOfDay(new Date()) };
  }, [range, customFrom, customTo]);

  const { data, loading } = useAsyncData(async () => {
    const [sales, products, expenses, customers, suppliers, returns] = await Promise.all([
      getSalesBetween(from, to),
      getProducts(),
      getExpenses(),
      getCustomers(),
      getSuppliers(),
      getAll('returns', fsOrderBy('createdAt', 'desc'), fsLimit(200)),
    ]);
    return { sales, products, expenses, customers, suppliers, returns };
  }, [from.getTime(), to.getTime()]);

  /* ---------------- Report builders ---------------- */
  const report = useMemo(() => {
    if (!data) return null;
    const { sales, products, expenses, customers, suppliers, returns } = data;
    const completed = sales.filter((s) => s.status !== 'refunded');
    const inRangeExpenses = expenses.filter((e) => {
      const d = toDate(e.date || e.createdAt);
      return d && d >= from && d <= to;
    });
    const sum = (arr, f) => arr.reduce((s, x) => s + (Number(x[f]) || 0), 0);

    switch (type) {
      case 'sales': {
        const byDay = groupByDay(completed);
        return {
          title: 'Sales Report',
          columns: ['Date', 'Orders', 'Items Sold', 'Discounts', 'Tax', 'Revenue'],
          rows: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => [
            formatDate(day), list.length,
            list.reduce((s, x) => s + x.items.reduce((a, i) => a + i.quantity, 0), 0),
            formatCurrency(sum(list, 'discount')), formatCurrency(sum(list, 'taxAmount')), formatCurrency(sum(list, 'grandTotal')),
          ]),
          summary: [
            ['Total orders', completed.length],
            ['Total revenue', formatCurrency(sum(completed, 'grandTotal'))],
            ['Average bill', formatCurrency(completed.length ? Math.round(sum(completed, 'grandTotal') / completed.length) : 0)],
          ],
        };
      }
      case 'profit': {
        const revenue = sum(completed, 'grandTotal');
        const profit = sum(completed, 'profit');
        const exp = sum(inRangeExpenses, 'amount');
        const byDay = groupByDay(completed);
        return {
          title: 'Profit Report',
          columns: ['Date', 'Revenue', 'Gross Profit', 'Margin %'],
          rows: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => {
            const rev = sum(list, 'grandTotal');
            const pr = sum(list, 'profit');
            return [formatDate(day), formatCurrency(rev), formatCurrency(pr), rev ? `${Math.round((pr / rev) * 100)}%` : '—'];
          }),
          summary: [
            ['Revenue', formatCurrency(revenue)],
            ['Gross profit', formatCurrency(profit)],
            ['Expenses (period)', formatCurrency(exp)],
            ['Net profit', formatCurrency(profit - exp)],
          ],
        };
      }
      case 'inventory': {
        const active = products.filter((p) => !p.archived);
        return {
          title: 'Inventory Report',
          columns: ['Product', 'SKU', 'Category', 'In Stock', 'Min', 'Cost Value', 'Retail Value'],
          rows: active.map((p) => [
            p.name, p.sku, p.category, p.stockQuantity ?? 0, p.minStock ?? 10,
            formatCurrency((p.purchasePrice || 0) * (p.stockQuantity || 0)),
            formatCurrency((p.sellingPrice || 0) * (p.stockQuantity || 0)),
          ]),
          summary: [
            ['Products', active.length],
            ['Total units', active.reduce((s, p) => s + (p.stockQuantity || 0), 0)],
            ['Inventory value (cost)', formatCurrency(active.reduce((s, p) => s + (p.purchasePrice || 0) * (p.stockQuantity || 0), 0))],
          ],
        };
      }
      case 'low_stock': {
        const low = products.filter((p) => !p.archived && (p.stockQuantity || 0) <= (p.minStock || 10));
        return {
          title: 'Low Stock Report',
          columns: ['Product', 'SKU', 'Category', 'In Stock', 'Min Level', 'Status'],
          rows: low.sort((a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0)).map((p) => [
            p.name, p.sku, p.category, p.stockQuantity ?? 0, p.minStock ?? 10,
            (p.stockQuantity || 0) <= 0 ? 'OUT OF STOCK' : 'LOW',
          ]),
          summary: [['Items needing restock', low.length]],
        };
      }
      case 'customer':
        return {
          title: 'Customer Report',
          columns: ['Customer', 'Phone', 'Membership', 'Orders', 'Points', 'Total Spent'],
          rows: [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).map((c) => [
            c.name, c.phone, c.membershipLevel || 'Bronze', c.totalOrders || 0, c.rewardPoints || 0, formatCurrency(c.totalSpent || 0),
          ]),
          summary: [
            ['Total customers', customers.length],
            ['Lifetime customer revenue', formatCurrency(sum(customers, 'totalSpent'))],
          ],
        };
      case 'supplier':
        return {
          title: 'Supplier Report',
          columns: ['Supplier', 'Contact', 'Phone', 'Total Purchases', 'Outstanding'],
          rows: suppliers.map((s) => [
            s.name, s.contactPerson || '—', s.phone, formatCurrency(s.totalPurchases || 0), formatCurrency(s.outstandingBalance || 0),
          ]),
          summary: [
            ['Suppliers', suppliers.length],
            ['Total outstanding', formatCurrency(sum(suppliers, 'outstandingBalance'))],
          ],
        };
      case 'cashier': {
        const byCashier = {};
        completed.forEach((s) => {
          const key = s.cashierName || 'Unknown';
          byCashier[key] = byCashier[key] || { orders: 0, revenue: 0, discount: 0 };
          byCashier[key].orders++;
          byCashier[key].revenue += s.grandTotal || 0;
          byCashier[key].discount += s.discount || 0;
        });
        return {
          title: 'Cashier Report',
          columns: ['Cashier', 'Orders', 'Discounts Given', 'Revenue'],
          rows: Object.entries(byCashier).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, v]) => [
            name, v.orders, formatCurrency(v.discount), formatCurrency(v.revenue),
          ]),
          summary: [['Active cashiers', Object.keys(byCashier).length]],
        };
      }
      case 'expense': {
        const byCat = {};
        inRangeExpenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0); });
        return {
          title: 'Expense Report',
          columns: ['Date', 'Category', 'Description', 'Method', 'Amount'],
          rows: inRangeExpenses.map((e) => [formatDate(e.date), e.category, e.title, (e.paymentMethod || '').replace('_', ' '), formatCurrency(e.amount)]),
          summary: [
            ['Total expenses', formatCurrency(sum(inRangeExpenses, 'amount'))],
            ...Object.entries(byCat).map(([c, a]) => [c, formatCurrency(a)]),
          ],
        };
      }
      case 'discount': {
        const discounted = completed.filter((s) => (s.discount || 0) > 0);
        return {
          title: 'Discount Report',
          columns: ['Invoice', 'Date', 'Customer', 'Coupon', 'Discount', 'Total'],
          rows: discounted.map((s) => [s.invoiceNumber, formatDate(s.createdAt), s.customerName, s.couponCode || 'Manual', formatCurrency(s.discount), formatCurrency(s.grandTotal)]),
          summary: [
            ['Discounted sales', discounted.length],
            ['Total discounts given', formatCurrency(sum(discounted, 'discount'))],
          ],
        };
      }
      case 'payment': {
        const byMethod = {};
        completed.forEach((s) => (s.payments || [{ method: s.paymentMethod, amount: s.grandTotal }]).forEach((p) => {
          byMethod[p.method] = byMethod[p.method] || { count: 0, amount: 0 };
          byMethod[p.method].count++;
          byMethod[p.method].amount += p.amount || 0;
        }));
        return {
          title: 'Payment Methods Report',
          columns: ['Method', 'Transactions', 'Amount'],
          rows: Object.entries(byMethod).sort((a, b) => b[1].amount - a[1].amount).map(([m, v]) => [m.replace('_', ' ').toUpperCase(), v.count, formatCurrency(v.amount)]),
          summary: [['Total collected', formatCurrency(Object.values(byMethod).reduce((s, v) => s + v.amount, 0))]],
        };
      }
      case 'tax': {
        const byDay = groupByDay(completed);
        return {
          title: 'Tax Report',
          columns: ['Date', 'Taxable Sales', 'Tax Collected'],
          rows: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => [
            formatDate(day), formatCurrency(sum(list, 'subtotal') - sum(list, 'discount')), formatCurrency(sum(list, 'taxAmount')),
          ]),
          summary: [['Total tax collected', formatCurrency(sum(completed, 'taxAmount'))]],
        };
      }
      case 'returns':
        return {
          title: 'Returns Report',
          columns: ['Invoice', 'Date', 'Items', 'Reason', 'Processed By', 'Refunded'],
          rows: returns.map((r) => [
            r.invoiceNumber, formatDate(r.createdAt), (r.items || []).reduce((s, i) => s + i.quantity, 0),
            r.reason || '—', r.processedByName, formatCurrency(r.refundAmount),
          ]),
          summary: [
            ['Total returns', returns.length],
            ['Total refunded', formatCurrency(sum(returns, 'refundAmount'))],
          ],
        };
      default:
        return null;
    }
  }, [data, type, from, to]);

  /* ---------------- Exports ---------------- */
  const subtitle = `${formatDate(from)} — ${formatDate(to)}`;

  const handlePdf = () => {
    downloadReportPdf({
      title: report.title, subtitle,
      columns: report.columns, rows: report.rows, summaryRows: report.summary,
      fileName: `veloura-${type}-report`,
    });
    toast.success('PDF downloaded.');
  };

  const handleExcel = () => {
    const rows = report.rows.map((r) => Object.fromEntries(report.columns.map((c, i) => [c, r[i]])));
    exportExcel(rows, `veloura-${type}-report.xlsx`, report.title.slice(0, 30));
    toast.success('Excel downloaded.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports & Analytics</h1>
          <p className="text-sm text-ink/50">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExcel} disabled={!report}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={handlePdf} disabled={!report}><Download className="h-4 w-4" /> PDF</Button>
          <Button variant="gold" onClick={() => window.print()} disabled={!report}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-56">
          {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
        <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44">
          {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        {range === 'custom' && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" aria-label="From date" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" aria-label="To date" />
          </>
        )}
      </div>

      {loading || !report ? (
        <PageLoader label="Building your report…" />
      ) : (
        <div className="print-area space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            {report.summary.map(([label, value]) => (
              <Card key={label} className="px-4 py-3">
                <p className="text-xs text-ink/50">{label}</p>
                <p className="text-lg font-semibold">{value}</p>
              </Card>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-ink text-gold">
                    {report.columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr><td colSpan={report.columns.length} className="px-4 py-12 text-center text-ink/40">No data for this period.</td></tr>
                  ) : (
                    report.rows.map((row, i) => (
                      <tr key={i} className="border-b border-ink/5 last:border-0 odd:bg-surface/50">
                        {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-4 py-2.5">{cell}</td>)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
