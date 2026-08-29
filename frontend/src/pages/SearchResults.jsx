import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Car, MapPin, Gauge, Settings, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';
import './SearchResults.css';

const MAKES = ['Toyota', 'Honda', 'Mercedes', 'Hyundai', 'Nissan', 'Ford', 'Kia', 'BMW', 'Volkswagen'];
const LOCATIONS = ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani'];
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'];
const CONDITIONS = ['BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED'];

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Local state for filters
  const [filters, setFilters] = useState({
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    location: searchParams.get('location') || '',
    transmission: searchParams.get('transmission') || '',
    fuelType: searchParams.get('fuelType') || '',
    condition: searchParams.get('condition') || '',
  });

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const params = Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        );
        const { data } = await api.get('/vehicles', { params });
        setVehicles(data);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [searchParams]);

  const applyFilters = (e) => {
    e.preventDefault();
    setSearchParams(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')));
  };

  const clearFilters = () => {
    setFilters({ make: '', model: '', minPrice: '', maxPrice: '', location: '', transmission: '', fuelType: '', condition: '' });
    setSearchParams({});
  };

  const formatPrice = (price) => `GH₵${Number(price).toLocaleString()}`;

  return (
    <div className="search-page">
      {/* Sidebar Filters */}
      <aside className="filters-sidebar">
        <div className="filters-header">
          <h3>Filters</h3>
          <button onClick={clearFilters} className="clear-btn">Clear All</button>
        </div>
        <form onSubmit={applyFilters}>
          <div className="filter-group">
            <label>Make</label>
            <select value={filters.make} onChange={(e) => setFilters({...filters, make: e.target.value})}>
              <option value="">Any Make</option>
              {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Model</label>
            <input type="text" placeholder="e.g. Camry" value={filters.model} onChange={(e) => setFilters({...filters, model: e.target.value})} />
          </div>
          <div className="filter-group">
            <label>Price Range (GH₵)</label>
            <input type="number" placeholder="Min Price" value={filters.minPrice} onChange={(e) => setFilters({...filters, minPrice: e.target.value})} />
            <input type="number" placeholder="Max Price" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: e.target.value})} style={{marginTop: '0.5rem'}} />
          </div>
          <div className="filter-group">
            <label>Location</label>
            <select value={filters.location} onChange={(e) => setFilters({...filters, location: e.target.value})}>
              <option value="">Any Location</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Condition</label>
            <select value={filters.condition} onChange={(e) => setFilters({...filters, condition: e.target.value})}>
              <option value="">Any Condition</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Transmission</label>
            <select value={filters.transmission} onChange={(e) => setFilters({...filters, transmission: e.target.value})}>
              <option value="">Any</option>
              {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Fuel Type</label>
            <select value={filters.fuelType} onChange={(e) => setFilters({...filters, fuelType: e.target.value})}>
              <option value="">Any</option>
              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button type="submit" className="apply-btn">Apply Filters</button>
        </form>
      </aside>

      {/* Results */}
      <main className="results-main">
        <div className="results-header">
          <h2>{loading ? 'Searching...' : `${vehicles.length} Cars Found`}</h2>
        </div>

        {loading ? (
          <div className="loading">Loading cars...</div>
        ) : vehicles.length === 0 ? (
          <div className="no-results">
            <p>No cars match your search. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="results-grid">
            {vehicles.map(car => (
              <Link to={`/car/${car.id}`} key={car.id} className="result-card">
                <div className="result-img">
                  {car.images && car.images.length > 0
                    ? <img src={`http://localhost:5000${car.images[0].url}`} alt={car.make} />
                    : <div className="img-placeholder"><Car size={40} className="placeholder-icon" /></div>
                  }
                  <span className={`condition-badge ${car.condition}`}>
                    {car.condition.replace('_', ' ')}
                  </span>
                </div>
                <div className="result-info">
                  <h3>{car.year} {car.make} {car.model}</h3>
                  <p className="result-price">{formatPrice(car.price)}</p>
                  <div className="result-meta">
                    <span className="meta-item"><MapPin size={14} /> {car.location}</span>
                    {car.mileage && <span className="meta-item"><Gauge size={14} /> {car.mileage.toLocaleString()} km</span>}
                    <span className="meta-item"><Settings size={14} /> {car.transmission}</span>
                  </div>
                  {car.seller?.verified && (
                    <span className="verified-badge"><CheckCircle2 size={12} /> Verified Seller</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;
