import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EventProvider } from './context/EventContext';

// First-paint pages stay in the main bundle
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SearchResults from './pages/SearchResults';
import NotFound from './pages/NotFound';

// Everything else is code-split on demand
const CarDetails = lazy(() => import('./pages/CarDetails'));
const SellCar = lazy(() => import('./pages/SellCar'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Messages = lazy(() => import('./pages/Messages'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Compare = lazy(() => import('./pages/Compare'));
const Pricing = lazy(() => import('./pages/Pricing'));
const BillingCallback = lazy(() => import('./pages/BillingCallback'));
const BecomeSeller = lazy(() => import('./pages/BecomeSeller'));
const Profile = lazy(() => import('./pages/Profile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';

// Global styles
import './App.css';

// Surfaces where a marketing footer hurts the UX: auth screens, dashboards,
// in-app messaging and checkout handshakes render chrome-free instead.
const NO_FOOTER_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/seller/dashboard',
  '/messages',
  '/profile',
  '/favorites',
  '/sell',
  '/become-seller',
  '/billing/callback',
];

// The staff portal renders fully chrome-free — no public navbar, footer or
// bottom nav. It's the one intentionally unlisted surface of the app.
const CHROME_FREE_ROUTES = ['/admin/login'];

const shouldHideFooter = (pathname) =>
  NO_FOOTER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

const isChromeFree = (pathname) =>
  CHROME_FREE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

function AppShell() {
  const location = useLocation();
  const hideFooter = shouldHideFooter(location.pathname) || isChromeFree(location.pathname);
  const hideChrome = isChromeFree(location.pathname);

  return (
    <div className="app-container page-fade-in">
      {!hideChrome && <Navbar />}
      <main className="main-content">
        <ErrorBoundary>
        <Suspense fallback={
          <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        }>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin/login" element={<StaffLogin />} />
          <Route path="/search"   element={<SearchResults />} />
          <Route path="/car/:id"  element={<CarDetails />} />
          <Route path="/sell"     element={<SellCar />} />
          <Route path="/sell/edit/:id" element={<SellCar />} />
           <Route path="/become-seller" element={<BecomeSeller />} />
           <Route path="/profile" element={<Profile />} />
           <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/seller/dashboard" element={<SellerDashboard />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:userId/:vehicleId" element={<Messages />} />
          <Route path="/admin"    element={<AdminDashboard />} />
          <Route path="/compare"  element={<Compare />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/billing/callback" element={<BillingCallback />} />
          <Route path="*"        element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      {!hideFooter && <Footer />}
      {!hideChrome && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <EventProvider>
          <AppShell />
        </EventProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
