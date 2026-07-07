import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PageLoader } from './components/ui/Spinner';

/* Lazy-loaded pages keep the initial bundle small */
const Login = lazy(() => import('./pages/auth/Login'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Billing = lazy(() => import('./pages/Billing'));
const SalesHistory = lazy(() => import('./pages/SalesHistory'));
const Products = lazy(() => import('./pages/products/Products'));
const ProductForm = lazy(() => import('./pages/products/ProductForm'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Employees = lazy(() => import('./pages/Employees'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Discounts = lazy(() => import('./pages/Discounts'));
const Reports = lazy(() => import('./pages/Reports'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

const MANAGERS = ['admin', 'manager'];
const EVERYONE = ['admin', 'manager', 'cashier'];

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Authenticated app */}
        <Route
          element={
            <ProtectedRoute roles={EVERYONE}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/sales" element={<SalesHistory />} />
          <Route path="/products" element={<Products />} />

          <Route path="/products/new" element={<ProtectedRoute roles={MANAGERS}><ProductForm /></ProtectedRoute>} />
          <Route path="/products/:id/edit" element={<ProtectedRoute roles={MANAGERS}><ProductForm /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute roles={MANAGERS}><Inventory /></ProtectedRoute>} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<ProtectedRoute roles={MANAGERS}><Suppliers /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute roles={MANAGERS}><Employees /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute roles={MANAGERS}><Expenses /></ProtectedRoute>} />
          <Route path="/discounts" element={<ProtectedRoute roles={MANAGERS}><Discounts /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute roles={MANAGERS}><Reports /></ProtectedRoute>} />
          <Route path="/activity-logs" element={<ProtectedRoute roles={MANAGERS}><ActivityLogs /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>

        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}
