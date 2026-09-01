import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { Heart, Car, MapPin } from 'lucide-react';
import './Favorites.css';

const Favorites = () => {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brokenImages, setBrokenImages] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      try {
        const { data } = await api.get('/favorites');
        setFavorites(data);
      } catch (err) {
        console.error('Error fetching favorites:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, [user]);

  const removeFavorite = async (vehicleId) => {
    try {
      await api.delete(`/favorites/${vehicleId}`);
      setFavorites(prev => prev.filter(v => v.id !== vehicleId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  const handleImageError = (carId) => {
    setBrokenImages(prev => new Set(prev).add(carId));
  };

  if (!user) {
    return (
      <div className="fav-guard">
        <h2>Please log in to view your saved cars.</h2>
        <Link to="/login" className="btn-primary">Login</Link>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <div className="favorites-header">
        <h1>Saved Cars</h1>
        <p>Cars you've saved for later</p>
      </div>

      {loading ? (
        <p className="loading-msg">Loading...</p>
      ) : favorites.length === 0 ? (
        <div className="empty-state">
          <Heart size={48} className="empty-icon" />
          <p>You haven't saved any cars yet.</p>
          <Link to="/search" className="btn-primary">Browse Cars</Link>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map(car => (
            <div key={car.id} className="fav-card">
              <Link to={`/car/${car.id}`} className="fav-img">
                 {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                   ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(car.id)} />
                   : <div className="no-img"><Car size={32} /></div>
                 }
              </Link>
              <div className="fav-info">
                <Link to={`/car/${car.id}`}>
                  <h3>{car.year} {car.make} {car.model}</h3>
                </Link>
                <p className="fav-price">GH₵{Number(car.price).toLocaleString()}</p>
                <p className="fav-meta"><MapPin size={14} /> {car.location}</p>
              </div>
              <button onClick={() => removeFavorite(car.id)} className="remove-fav">
                <Heart size={16} fill="#DC2626" color="#DC2626" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
