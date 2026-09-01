import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Car, MapPin, Gauge, Settings, CheckCircle2, Heart, GitCompareArrows, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import './SearchResults.css';

const MAKES = ['Toyota', 'Honda', 'Mercedes', 'Hyundai', 'Nissan', 'Ford', 'Kia', 'BMW', 'Volkswagen'];
const LOCATIONS = ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani'];
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'];
const CONDITIONS = ['BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED'];
const SELLER_TYPES = ['PRIVATE', 'DEALER', 'COMPANY'];

const SearchResults = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [favorites, setFavorites] = useState(new Set());
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [compareList, setCompareList] = useState([]);

  const [filters, setFilters] = useState({
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    year: searchParams.get('year') || '',
    minMileage: searchParams.get('minMileage') || '',
    maxMileage: searchParams.get('maxMileage') || '',
    location: searchParams.get('location') || '',
    transmission: searchParams.get('transmission') || '',
    fuelType: searchParams.get('fuelType') || '',
    condition: searchParams.get('condition') || '',
    sellerType: searchParams.get('sellerType') || '',
    verifiedOnly: searchParams.get('verifiedOnly') || '',
  });

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const params = Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== '')
        );
        const { data } = await api.get('/vehicles', { params });
        setVehicles(data.vehicles || []);
        setTotal(data.total || 0);
        setCurrentPage(data.page || 1);
        setTotalPages(data.pages || 1);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [searchParams, filters]);

  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      try {
        const { data } = await api.get('/favorites');
        setFavorites(new Set(data.map(v => v.id)));
      } catch (err) {
        console.error('Error fetching favorites:', err);
      }
    };
    fetchFavorites();
  }, [user]);

  const toggleFavorite = async (e, vehicleId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    try {
      if (favorites.has(vehicleId)) {
        await api.delete(`/favorites/${vehicleId}`);
        setFavorites(prev => { const n = new Set(prev); n.delete(vehicleId); return n; });
      } else {
        await api.post(`/favorites/${vehicleId}`);
        setFavorites(prev => new Set(prev).add(vehicleId));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const toggleCompare = (e, car) => {
    e.preventDefault();
    e.stopPropagation();
    setCompareList(prev => {
      const alreadyIn = prev.find(c => c.id === car.id);
      if (alreadyIn) return prev.filter(c => c.id !== car.id);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, car];
    });
  };

  const removeFromCompare = (carId) => {
    setCompareList(prev => prev.filter(c => c.id !== carId));
  };

  const goCompare = () => {
    if (compareList.length === 2) {
      navigate(`/compare?ids=${compareList[0].id},${compareList[1].id}`);
    }
  };

  const handleImageError = (vehicleId) => {
    setBrokenImages(prev => new Set(prev).add(vehicleId));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    setSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')));
  };

  const clearFilters = () => {
    setFilters({ make: '', model: '', minPrice: '', maxPrice: '', year: '', minMileage: '', maxMileage: '', location: '', transmission: '', fuelType: '', condition: '', sellerType: '', verifiedOnly: '' });
    setSearchParams({});
  };

  const formatPrice = (price) => `GH₵${Number(price).toLocaleString()}`;

  const isInCompare = (id) => compareList.some(c => c.id === id);
  const compareMaxed = compareList.length >= 2;

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
          <div className="filter-group">
            <label>Year</label>
            <input type="number" placeholder="e.g. 2021" value={filters.year} onChange={(e) => setFilters({...filters, year: e.target.value})} />
          </div>
          <div className="filter-group">
            <label>Mileage Range (km)</label>
            <input type="number" placeholder="Min Mileage" value={filters.minMileage} onChange={(e) => setFilters({...filters, minMileage: e.target.value})} />
            <input type="number" placeholder="Max Mileage" value={filters.maxMileage} onChange={(e) => setFilters({...filters, maxMileage: e.target.value})} style={{marginTop: '0.5rem'}} />
          </div>
          <div className="filter-group">
            <label>Seller Type</label>
            <select value={filters.sellerType} onChange={(e) => setFilters({...filters, sellerType: e.target.value})}>
              <option value="">Any</option>
              {SELLER_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>
              <input type="checkbox" checked={filters.verifiedOnly === 'true'} onChange={(e) => setFilters({...filters, verifiedOnly: e.target.checked ? 'true' : ''})} />
              {' '}Verified Sellers Only
            </label>
          </div>
          <button type="submit" className="apply-btn">Apply Filters</button>
        </form>
      </aside>

      {/* Results */}
      <main className="results-main" style={{ paddingBottom: compareList.length > 0 ? '96px' : undefined }}>
        <div className="results-header">
          <h2>{loading ? 'Searching...' : `${total} Cars Found`}</h2>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setSearchParams({ ...Object.fromEntries(searchParams), page: newPage.toString() });
                }}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  setSearchParams({ ...Object.fromEntries(searchParams), page: newPage.toString() });
                }}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
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
                  {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                    ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(car.id)} />
                    : <div className="img-placeholder"><Car size={40} className="placeholder-icon" /></div>
                  }
                  <span className={`condition-badge ${car.condition}`}>
                    {car.condition.replace('_', ' ')}
                  </span>
                  {user && (
                    <button
                      className={`favorite-btn ${favorites.has(car.id) ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(e, car.id)}
                      title="Save to Favorites"
                    >
                      <Heart size={18} fill={favorites.has(car.id) ? '#DC2626' : 'none'} />
                    </button>
                  )}
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
                  {/* Compare button */}
                  <button
                    id={`compare-btn-${car.id}`}
                    className={`compare-btn ${isInCompare(car.id) ? 'in-compare' : ''} ${compareMaxed && !isInCompare(car.id) ? 'compare-maxed' : ''}`}
                    onClick={(e) => toggleCompare(e, car)}
                    title={compareMaxed && !isInCompare(car.id) ? 'Remove a car first to add another' : 'Compare this car'}
                  >
                    <GitCompareArrows size={14} />
                    {isInCompare(car.id) ? 'Added ✓' : compareMaxed ? 'Max 2' : '+ Compare'}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Sticky Compare Bar */}
      {compareList.length > 0 && (
        <div className="compare-bar" role="region" aria-label="Compare selected cars">
          <div className="compare-bar-inner">
            <div className="compare-bar-label">
              <GitCompareArrows size={20} />
              <span>Compare</span>
            </div>

            <div className="compare-bar-slots">
              {compareList.map(car => (
                <div key={car.id} className="compare-slot">
                  <span className="compare-slot-name">{car.year} {car.make} {car.model}</span>
                  <button
                    className="compare-slot-remove"
                    onClick={() => removeFromCompare(car.id)}
                    aria-label={`Remove ${car.make} ${car.model} from compare`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {compareList.length === 1 && (
                <div className="compare-slot compare-slot-empty">
                  <span>Pick one more car</span>
                </div>
              )}
            </div>

            <button
              id="compare-now-btn"
              className="compare-now-btn"
              onClick={goCompare}
              disabled={compareList.length < 2}
            >
              Compare Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
