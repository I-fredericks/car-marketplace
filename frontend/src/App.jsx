import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

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
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';

// Global styles
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container page-fade-in">
          <Navbar />
          <main className="main-content">
            <Suspense fallback={
              <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
                <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
              </div>
            }>
            <Routes>
              <Route path="/"         element={<Home />} />
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/search"   element={<SearchResults />} />
              <Route path="/car/:id"  element={<CarDetails />} />
              <Route path="/sell"     element={<SellCar />} />
              <Route path="/sell/edit/:id" element={<SellCar />} />
              <Route path="/become-seller" element={<BecomeSeller />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/seller/dashboard" element={<SellerDashboard />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId/:vehicleId" element={<Messages />} />
              <Route path="/admin"    element={<AdminDashboard />} />
              <Route path="/compare"  element={<Compare />} />
              <Route path="/pricing"  element={<Pricing />} />
              <Route path="/billing/callback" element={<BillingCallback />} />
              <Route path="*"        element={<NotFound />} />
            </Routes>
            </Suspense>
          </main>
          <Footer />
          <BottomNav />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
