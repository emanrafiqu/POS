import { startOfDay, startOfMonth, subDays, subMonths, endOfMonth } from 'date-fns';
import { getSalesBetween } from './saleService';
import { getProducts } from './productService';
import { getExpenses } from './expenseService';
import { getCustomers } from './customerService';
import { toDate } from '@/utils/format';

/**
 * Aggregates everything the dashboard needs in one pass.
 * Sales are fetched once for the last 90 days and bucketed client-side
 * to keep Firestore reads low.
 */
export async function getDashboardData() {
  const now = new Date();
  const [sales, products, expenses, customers] = await Promise.all([
    getSalesBetween(subDays(now, 90), now),
    getProducts(),
    getExpenses(),
    getCustomers(),
  ]);

  const completed = sales.filter((s) => s.status !== 'refunded');
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const inRange = (s, from, to = now) => {
    const d = toDate(s.createdAt);
    return d && d >= from && d <= to;
  };
  const sum = (arr, field) => arr.reduce((acc, s) => acc + (Number(s[field]) || 0), 0);

  const todaySales = completed.filter((s) => inRange(s, todayStart));
  const monthSales = completed.filter((s) => inRange(s, monthStart));
  const lastMonthSales = completed.filter((s) => inRange(s, lastMonthStart, lastMonthEnd));

  const monthExpenses = expenses.filter((e) => {
    const d = toDate(e.date || e.createdAt);
    return d && d >= monthStart;
  });

  // 30-day daily revenue series for the sales graph
  const dailySeries = [];
  for (let i = 29; i >= 0; i--) {
    const day = startOfDay(subDays(now, i));
    const next = startOfDay(subDays(now, i - 1));
    const daySales = completed.filter((s) => inRange(s, day, next));
    dailySeries.push({
      date: day,
      revenue: sum(daySales, 'grandTotal'),
      orders: daySales.length,
      profit: sum(daySales, 'profit'),
    });
  }

  // Top selling products (by units sold, lifetime counter on the product)
  const topProducts = [...products].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)).slice(0, 5);
  const worstProducts = [...products]
    .filter((p) => !p.archived)
    .sort((a, b) => (a.totalSold || 0) - (b.totalSold || 0))
    .slice(0, 5);

  const topCustomers = [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5);

  const active = products.filter((p) => !p.archived);
  const lowStock = active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= (p.minStock || 10));
  const outOfStock = active.filter((p) => (p.stockQuantity || 0) <= 0);
  const inventoryValue = active.reduce((s, p) => s + (p.purchasePrice || 0) * (p.stockQuantity || 0), 0);

  // Peak sale hour (0-23) across the 90-day window
  const hourBuckets = Array(24).fill(0);
  completed.forEach((s) => {
    const d = toDate(s.createdAt);
    if (d) hourBuckets[d.getHours()] += s.grandTotal || 0;
  });
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  return {
    today: {
      sales: todaySales.length,
      revenue: sum(todaySales, 'grandTotal'),
      profit: sum(todaySales, 'profit'),
    },
    month: {
      revenue: sum(monthSales, 'grandTotal'),
      profit: sum(monthSales, 'profit'),
      orders: monthSales.length,
      expenses: sum(monthExpenses, 'amount'),
      avgBill: monthSales.length ? Math.round(sum(monthSales, 'grandTotal') / monthSales.length) : 0,
    },
    lastMonth: {
      revenue: sum(lastMonthSales, 'grandTotal'),
      orders: lastMonthSales.length,
    },
    dailySeries,
    recentSales: sales.slice(0, 8),
    topProducts,
    worstProducts,
    topCustomers,
    inventory: {
      totalProducts: active.length,
      lowStock,
      outOfStock,
      inventoryValue,
    },
    peakHour,
    categoryBreakdown: Object.entries(
      active.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + (p.stockQuantity || 0);
        return acc;
      }, {})
    ),
  };
}
