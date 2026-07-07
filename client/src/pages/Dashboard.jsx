import { Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  AlertTriangle, Banknote, Boxes, Clock, PackageX, Plus,
  ReceiptText, ShoppingCart, TrendingUp, Wallet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getDashboardData } from '@/services/dashboardService';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/utils/format';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const GOLD = '#c9a227';
const INK = '#0c0c0e';

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const { data, loading } = useAsyncData(getDashboardData, []);

  if (loading || !data) return <PageLoader label="Crunching your store numbers…" />;

  const { today, month, lastMonth, dailySeries, recentSales, topProducts, topCustomers, inventory, peakHour, categoryBreakdown } = data;
  const revenueTrend = lastMonth.revenue
    ? Math.round(((month.revenue - lastMonth.revenue) / lastMonth.revenue) * 100)
    : 0;
  const isManager = hasRole('admin', 'manager');

  const lineData = {
    labels: dailySeries.map((d) => formatDate(d.date, 'dd MMM')),
    datasets: [
      {
        label: 'Revenue',
        data: dailySeries.map((d) => d.revenue),
        borderColor: GOLD,
        backgroundColor: 'rgba(201,162,39,0.12)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 12,
      },
      ...(isManager
        ? [{
            label: 'Profit',
            data: dailySeries.map((d) => d.profit),
            borderColor: INK,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 12,
            borderDash: [5, 4],
          }]
        : []),
    ],
  };

  const barData = {
    labels: dailySeries.slice(-14).map((d) => formatDate(d.date, 'dd')),
    datasets: [{
      label: 'Orders',
      data: dailySeries.slice(-14).map((d) => d.orders),
      backgroundColor: 'rgba(12,12,14,0.85)',
      borderRadius: 6,
    }],
  };

  const doughnutData = {
    labels: categoryBreakdown.map(([cat]) => cat),
    datasets: [{
      data: categoryBreakdown.map(([, qty]) => qty),
      backgroundColor: ['#c9a227', '#0c0c0e', '#e6c65c', '#4b5563', '#a3821c', '#9ca3af', '#6b7280', '#d1d5db', '#78716c', '#e5e7eb'],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { family: 'Poppins' }, boxWidth: 12 } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 10 } } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 10 } } },
    },
  };

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-ink/50">Here's what's happening at your store today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/billing"><Button variant="gold"><ShoppingCart className="h-4 w-4" /> New Sale</Button></Link>
          {isManager && <Link to="/products/new"><Button variant="outline"><Plus className="h-4 w-4" /> Add Product</Button></Link>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's Orders" value={formatNumber(today.sales)} icon={ReceiptText} tone="dark" />
        <StatCard label="Today's Revenue" value={formatCurrency(today.revenue)} icon={Banknote} tone="gold" />
        <StatCard label="Monthly Revenue" value={formatCurrency(month.revenue)} icon={TrendingUp} trend={revenueTrend} trendLabel="vs last month" />
        {isManager && <StatCard label="Monthly Profit" value={formatCurrency(month.profit)} icon={Wallet} />}
        {isManager && <StatCard label="Monthly Expenses" value={formatCurrency(month.expenses)} icon={Wallet} />}
        <StatCard label="Avg. Bill" value={formatCurrency(month.avgBill)} icon={ReceiptText} />
      </div>

      {/* Inventory alerts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className="rounded-xl bg-ink/5 p-3"><Boxes className="h-5 w-5 text-ink/60" /></div>
          <div>
            <p className="text-lg font-semibold">{formatNumber(inventory.totalProducts)}</p>
            <p className="text-xs text-ink/50">Active products · stock value {formatCurrency(inventory.inventoryValue)}</p>
          </div>
        </Card>
        <Link to="/inventory">
          <Card className="flex items-center gap-4 p-4 transition-colors hover:border-amber-300">
            <div className="rounded-xl bg-amber-50 p-3"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-lg font-semibold">{inventory.lowStock.length}</p>
              <p className="text-xs text-ink/50">Low stock items — restock soon</p>
            </div>
          </Card>
        </Link>
        <Link to="/inventory">
          <Card className="flex items-center gap-4 p-4 transition-colors hover:border-red-300">
            <div className="rounded-xl bg-red-50 p-3"><PackageX className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-lg font-semibold">{inventory.outOfStock.length}</p>
              <p className="text-xs text-ink/50">Out of stock items</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue — last 30 days" subtitle={isManager ? 'Gold: revenue · dashed: profit' : undefined}
            action={<Badge variant="gold"><Clock className="h-3 w-3" /> Peak hour: {peakHour}:00</Badge>} />
          <CardBody><div className="h-72"><Line data={lineData} options={chartOptions} /></div></CardBody>
        </Card>
        <Card>
          <CardHeader title="Inventory by category" subtitle="Units in stock" />
          <CardBody>
            <div className="h-72">
              <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Poppins', size: 10 }, boxWidth: 10 } } } }} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Orders — last 14 days" />
          <CardBody><div className="h-64"><Bar data={barData} options={chartOptions} /></div></CardBody>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader title="Top selling products" action={<Link to="/products" className="text-xs font-medium text-gold-dark hover:underline">View all</Link>} />
          <CardBody className="space-y-3 p-4">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-faint text-xs font-bold text-gold-dark">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-ink/45">{p.sku} · {formatNumber(p.totalSold || 0)} sold</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(p.sellingPrice)}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Top customers */}
        <Card>
          <CardHeader title="Top customers" action={<Link to="/customers" className="text-xs font-medium text-gold-dark hover:underline">View all</Link>} />
          <CardBody className="space-y-3 p-4">
            {topCustomers.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-gold">
                  {c.name?.[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-ink/45">{c.totalOrders || 0} orders · <Badge variant="gold">{c.membershipLevel}</Badge></p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(c.totalSpent)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader title="Recent transactions" action={<Link to="/sales" className="text-xs font-medium text-gold-dark hover:underline">Sales history</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-xs uppercase tracking-wide text-ink/40">
                <th className="px-5 py-2.5">Invoice</th>
                <th className="px-5 py-2.5">Customer</th>
                <th className="px-5 py-2.5">Items</th>
                <th className="px-5 py-2.5">Total</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((s) => (
                <tr key={s.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-5 py-3 font-medium">{s.invoiceNumber}</td>
                  <td className="px-5 py-3">{s.customerName}</td>
                  <td className="px-5 py-3">{s.items?.length || 0}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(s.grandTotal)}</td>
                  <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-3 text-ink/50">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
