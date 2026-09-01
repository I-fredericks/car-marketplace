import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, MapPin, Car, ChevronRight, ShieldCheck, BadgeCheck, PhoneCall } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    make: '',
    model: '',
    minPrice: '',
    maxPrice: '',
    year: '',
    location: ''
  });
  const [featuredCars, setFeaturedCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState(new Set());

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/vehicles/featured');
        setFeaturedCars(data);
      } catch (err) {
        console.error('Error fetching featured cars:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v !== ''))
    ).toString();
    navigate(`/search?${query}`);
  };

  const handleImageError = (carId) => {
    setBrokenImages(prev => new Set(prev).add(carId));
  };

  const formatPrice = (price) => `GH₵${Number(price).toLocaleString()}`;

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Find Your Next Dream Car</h1>
          <p>The most trusted vehicle marketplace in Ghana. Discover premium, verified cars at unbeatable prices.</p>

          <div className="search-glass-container">
            <form className="search-bar" onSubmit={handleSearch}>
              <div className="search-inputs">
                <div className="input-group">
                  <select
                    value={searchParams.make}
                    onChange={(e) => setSearchParams({...searchParams, make: e.target.value})}
                  >
                    <option value="">Any Make</option>
                    <option value="Toyota">Toyota</option>
                    <option value="Honda">Honda</option>
                    <option value="Mercedes">Mercedes</option>
                    <option value="Hyundai">Hyundai</option>
                  </select>
                </div>

                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Model (e.g. Camry)"
                    value={searchParams.model}
                    onChange={(e) => setSearchParams({...searchParams, model: e.target.value})}
                  />
                </div>

                <div className="input-group">
                  <input
                    type="number"
                    placeholder="Min Price (GH₵)"
                    value={searchParams.minPrice}
                    onChange={(e) => setSearchParams({...searchParams, minPrice: e.target.value})}
                  />
                </div>

                <div className="input-group">
                  <input
                    type="number"
                    placeholder="Max Price (GH₵)"
                    value={searchParams.maxPrice}
                    onChange={(e) => setSearchParams({...searchParams, maxPrice: e.target.value})}
                  />
                </div>

                <div className="input-group">
                  <input
                    type="number"
                    placeholder="Year (e.g. 2021)"
                    value={searchParams.year}
                    onChange={(e) => setSearchParams({...searchParams, year: e.target.value})}
                  />
                </div>

                <div className="input-group">
                  <select
                    value={searchParams.location}
                    onChange={(e) => setSearchParams({...searchParams, location: e.target.value})}
                  >
                    <option value="">Any Location</option>
                    <option value="Accra">Accra</option>
                    <option value="Kumasi">Kumasi</option>
                    <option value="Takoradi">Takoradi</option>
                    <option value="Tamale">Tamale</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="search-submit">
                <Search size={20} /> Search Vehicles
              </button>
            </form>
          </div>
        </div>
        <div className="hero-pattern-overlay"></div>
      </section>

      {/* Featured Cars */}
      <section className="featured">
        <div className="section-header">
          <h2>Trending Premium Cars</h2>
          <Link to="/search" className="view-all-link">View all <ChevronRight size={16} /></Link>
        </div>
        
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading featured cars...</p>
          </div>
        ) : featuredCars.length === 0 ? (
          <div className="empty-state">
            <Car size={48} className="empty-icon" />
            <p>No featured cars available right now.</p>
          </div>
        ) : (
          <div className="car-grid">
            {featuredCars.map(car => (
              <Link to={`/car/${car.id}`} key={car.id} className="car-card">
                <div className="car-image-container">
                  {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                    ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(car.id)} className="car-img" />
                    : <div className="placeholder-img"><Car size={48} /></div>
                  }
                  <div className="car-badge">Featured</div>
                </div>
                <div className="car-details">
                  <div className="car-title-row">
                    <h3>{car.year} {car.make} {car.model}</h3>
                  </div>
                  <p className="price">{formatPrice(car.price)}</p>
                  <div className="car-meta">
                    <span className="location">
                      <MapPin size={14} className="icon-inline" /> {car.location}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-container">
          <div className="trust-header">
            <h2>Why Buy From CarMarket?</h2>
            <p>Experience a secure and seamless car buying journey.</p>
          </div>
          
          <div className="trust-features-grid">
            <div className="trust-feature-card">
              <div className="trust-icon-wrapper"><BadgeCheck size={32} /></div>
              <h3>Verified Sellers</h3>
              <p>Every seller passes our strict Ghana Card & phone verification check.</p>
            </div>
            
            <div className="trust-feature-card">
              <div className="trust-icon-wrapper"><ShieldCheck size={32} /></div>
              <h3>Secure Transactions</h3>
              <p>Detailed vehicle histories and transparent information you can trust.</p>
            </div>
            
            <div className="trust-feature-card">
              <div className="trust-icon-wrapper"><Car size={32} /></div>
              <h3>Huge Inventory</h3>
              <p>Thousands of premium cars across all regions in Ghana.</p>
            </div>
            
            <div className="trust-feature-card">
              <div className="trust-icon-wrapper"><PhoneCall size={32} /></div>
              <h3>Direct Contact</h3>
              <p>Connect instantly with sellers via WhatsApp or phone call.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
