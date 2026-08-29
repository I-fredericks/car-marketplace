import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Car, Check } from 'lucide-react';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    make: '',
    model: '',
    minPrice: '',
    maxPrice: '',
    location: ''
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(searchParams).filter(([_, v]) => v !== ''))
    ).toString();
    navigate(`/search?${query}`);
  };

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero">
        <h1>FIND YOUR NEXT CAR</h1>
        <p>The most trusted vehicle marketplace in Ghana</p>
        
        <form className="search-bar" onSubmit={handleSearch}>
          <select 
            value={searchParams.make} 
            onChange={(e) => setSearchParams({...searchParams, make: e.target.value})}
          >
            <option value="">Make</option>
            <option value="Toyota">Toyota</option>
            <option value="Honda">Honda</option>
            <option value="Mercedes">Mercedes</option>
            <option value="Hyundai">Hyundai</option>
          </select>
          
          <input 
            type="text" 
            placeholder="Model (e.g. Camry)" 
            value={searchParams.model}
            onChange={(e) => setSearchParams({...searchParams, model: e.target.value})}
          />
          
          <input 
            type="number" 
            placeholder="Min Price (GH₵)" 
            value={searchParams.minPrice}
            onChange={(e) => setSearchParams({...searchParams, minPrice: e.target.value})}
          />
          
          <input 
            type="number" 
            placeholder="Max Price (GH₵)" 
            value={searchParams.maxPrice}
            onChange={(e) => setSearchParams({...searchParams, maxPrice: e.target.value})}
          />
          
          <select 
            value={searchParams.location}
            onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
          >
            <option value="">Location</option>
            <option value="Accra">Accra</option>
            <option value="Kumasi">Kumasi</option>
            <option value="Takoradi">Takoradi</option>
            <option value="Tamale">Tamale</option>
          </select>
          
          <button type="submit" className="search-submit">
            <Search size={18} /> SEARCH
          </button>
        </form>
      </section>

      {/* Featured Cars Placeholder */}
      <section className="featured">
        <h2>FEATURED CARS</h2>
        <div className="car-grid">
          {/* Example static card */}
          <div className="car-card">
            <div className="car-image-placeholder">
              <Car size={48} className="placeholder-icon" />
            </div>
            <h3>2021 Toyota Camry XSE</h3>
            <p className="price">GH₵185,000</p>
            <p className="location">
              <MapPin size={14} className="icon-inline" /> Kumasi
            </p>
          </div>
          <div className="car-card">
            <div className="car-image-placeholder">
              <Car size={48} className="placeholder-icon" />
            </div>
            <h3>2019 Honda Civic Sport</h3>
            <p className="price">GH₵150,000</p>
            <p className="location">
              <MapPin size={14} className="icon-inline" /> Accra
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <h2>WHY BUY FROM US?</h2>
        <ul className="trust-list">
          <li>
            <Check size={18} className="check-icon" /> Verified Sellers (Ghana Card & Phone Checked)
          </li>
          <li>
            <Check size={18} className="check-icon" /> Detailed Vehicle Information
          </li>
          <li>
            <Check size={18} className="check-icon" /> Thousands of Cars across Ghana
          </li>
          <li>
            <Check size={18} className="check-icon" /> Direct WhatsApp & Phone Contact
          </li>
        </ul>
      </section>
    </div>
  );
};

export default Home;
