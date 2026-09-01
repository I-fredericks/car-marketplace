import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import './SellerDashboard.css';

const STATUS_LABEL = {
  PENDING: 'Pending',
  AVAILABLE: 'Available',
  SOLD: 'Sold',
  REJECTED: 'Rejected'
};

const SellerDashboard = () => {
  const { user } = useContext(AuthContext);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());

  const fetchListings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/vehicles/seller/my-listings');
      setListings(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing permanently?')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      setListings(prev => prev.filter(item => item.id !== id));
    } catch {
      alert('Failed to delete listing.');
    }
  };

  const handleMarkSold = async (id) => {
    if (!window.confirm('Mark this car as sold?')) return;
    try {
      await api.put(`/vehicles/${id}/sold`);
      setListings(prev => prev.map(item => item.id === id ? { ...item, status: 'SOLD' } : item));
    } catch {
      alert('Failed to update status.');
    }
  };

  const handleImageError = (carId) => {
    setBrokenImages(prev => new Set(prev).add(carId));
  };

  const stats = {
    total: listings.length,
    pending: listings.filter(l => l.status === 'PENDING').length,
    available: listings.filter(l => l.status === 'AVAILABLE').length,
    sold: listings.filter(l => l.status === 'SOLD').length,
  };

  if (!user || user.role === 'BUYER') {
    return (
      <div className="seller-guard">
        <h2>Access Denied</h2>
        <p>You need a Seller account to view this page.</p>
        <Link to="/sell" className="btn-primary">Become a Seller</Link>
      </div>
    );
  }

  return (
    <div className="seller-dashboard">
      <div className="seller-header">
        <div>
          <h1>My Listings</h1>
          <p>Manage your car listings</p>
        </div>
        <Link to="/sell" className="btn-primary">+ New Listing</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="seller-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card pending">
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card available">
          <span className="stat-value">{stats.available}</span>
          <span className="stat-label">Available</span>
        </div>
        <div className="stat-card sold">
          <span className="stat-value">{stats.sold}</span>
          <span className="stat-label">Sold</span>
        </div>
      </div>

      {loading ? (
        <p className="loading-msg">Loading your listings...</p>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <p>You haven't listed any cars yet.</p>
          <Link to="/sell" className="btn-primary">Create Your First Listing</Link>
        </div>
      ) : (
        <div className="listings-grid">
          {listings.map(car => (
            <div key={car.id} className="listing-card">
              <div className="listing-img">
               {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                 ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(car.id)} />
                 : <div className="no-img">🚗</div>
               }
                <span className={`status-badge ${car.status.toLowerCase()}`}>
                  {STATUS_LABEL[car.status] || car.status}
                </span>
              </div>
              <div className="listing-info">
                <h3>{car.year} {car.make} {car.model}</h3>
                <p className="listing-price">GH₵{Number(car.price).toLocaleString()}</p>
                <p className="listing-meta">{car.location} • {car.condition.replace('_', ' ')}</p>
              </div>
              <div className="listing-actions">
                <Link to={`/car/${car.id}`} className="btn-small view">View</Link>
                <Link to={`/sell/edit/${car.id}`} className="btn-small edit">Edit</Link>
                {car.status !== 'SOLD' && (
                  <button onClick={() => handleMarkSold(car.id)} className="btn-small sold">Mark Sold</button>
                )}
                <button onClick={() => handleDelete(car.id)} className="btn-small delete">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
