import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SearchResults from './pages/SearchResults';
import CarDetails from './pages/CarDetails';
import SellCar from './pages/SellCar';
import SellerDashboard from './pages/SellerDashboard';
import Favorites from './pages/Favorites';
import Messages from './pages/Messages';
import AdminDashboard from './pages/AdminDashboard';
import Compare from './pages/Compare';
import NotFound from './pages/NotFound';
import Pricing from './pages/Pricing';
import BillingCallback from './pages/BillingCallback';

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
            <Routes>
              <Route path="/"         element={<Home />} />
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/search"   element={<SearchResults />} />
              <Route path="/car/:id"  element={<CarDetails />} />
              <Route path="/sell"     element={<SellCar />} />
              <Route path="/sell/edit/:id" element={<SellCar />} />
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
          </main>
          <Footer />
          <BottomNav />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
