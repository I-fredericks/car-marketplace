import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { Heart, Flag } from 'lucide-react';
import './CarDetails.css';

const CarDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [brokenImages, setBrokenImages] = useState(new Set());

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const { data } = await api.get(`/vehicles/${id}`);
        setCar(data);
    } catch {
      console.error('Error fetching car');
    } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  useEffect(() => {
    if (!user || !car) return;
    const checkFavorite = async () => {
      try {
        const { data } = await api.get('/favorites');
        setIsFavorite(data.some(v => v.id === car.id));
      } catch (err) {
        console.error('Error checking favorite:', err);
      }
    };
    checkFavorite();
  }, [user, car]);

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await api.post(`/favorites/${id}`);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setReportSubmitting(true);
    try {
      await api.post('/reports', { vehicleId: id, reason: reportReason });
      alert('Report submitted. Thank you.');
      setShowReportModal(false);
      setReportReason('');
    } catch {
      alert('Failed to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleImageError = (imgId) => {
    setBrokenImages(prev => new Set(prev).add(imgId));
  };

  if (loading) return <div className="page-loading">Loading car details...</div>;
  if (!car) return <div className="page-loading">Car not found.</div>;

  const seller = car.seller;
  const sellerName = seller?.user?.name || 'Seller';
  const sellerPhone = seller?.user?.phone || '';
  const sellerWhatsApp = seller?.whatsapp || sellerPhone;

  const whatsappMsg = encodeURIComponent(
    `Hello, I'm interested in your ${car.year} ${car.make} ${car.model} listed on CarMarket Ghana for GH₵${Number(car.price).toLocaleString()}. Is it still available?`
  );

  const formatLabel = (str) => str?.replace(/_/g, ' ') || '—';

  const specs = [
    { label: 'Year',         value: car.year },
    { label: 'Mileage',      value: car.mileage ? `${car.mileage.toLocaleString()} km` : '—' },
    { label: 'Transmission', value: formatLabel(car.transmission) },
    { label: 'Fuel Type',    value: formatLabel(car.fuelType) },
    { label: 'Engine Size',  value: car.engineSize || '—' },
    { label: 'Body Type',    value: car.bodyType || '—' },
    { label: 'Condition',    value: formatLabel(car.condition) },
    { label: 'Color',        value: car.color || '—' },
    { label: 'Location',     value: car.location },
  ];

  return (
    <div className="car-details-page">
      <div className="details-container">

        {/* Left — Gallery + Info */}
        <div className="details-left">

          {/* Image Gallery */}
          <div className="gallery">
            <div className="gallery-main">
              {car.images && car.images.length > 0 && !brokenImages.has(`main-${car.id}`)
                ? <img src={getImageUrl(car.images[activeImg]?.data)} alt={car.make} onError={() => handleImageError(`main-${car.id}`)} />
                : <div className="no-image-placeholder">🚗 No Photos</div>
              }
            </div>
            {car.images && car.images.length > 1 && (
              <div className="gallery-thumbs">
                {car.images.map((img, i) => (
                  <img
                    key={img.id}
                    src={getImageUrl(img.data)}
                    alt={`thumb-${i}`}
                    className={i === activeImg ? 'thumb active' : 'thumb'}
                    onClick={() => setActiveImg(i)}
                    onError={() => handleImageError(img.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Car Title + Price */}
          <div className="car-header">
            <h1>{car.year} {car.make} {car.model}</h1>
            <p className="details-price">GH₵{Number(car.price).toLocaleString()}</p>
            <div className="car-meta-tags">
              <span>📍 {car.location}</span>
              <span className="condition-tag">{formatLabel(car.condition)}</span>
              {car.seller?.verified && <span className="verified-tag">🟢 Verified Seller</span>}
            </div>
          </div>

          {/* Specs Table */}
          <div className="section-card">
            <h2>Vehicle Specifications</h2>
            <table className="specs-table">
              <tbody>
                {specs.map(s => (
                  <tr key={s.label}>
                    <td className="spec-label">{s.label}</td>
                    <td className="spec-value">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Features */}
          {car.features && car.features.length > 0 && (
            <div className="section-card">
              <h2>Features</h2>
              <div className="features-grid">
                {car.features.map(f => (
                  <span key={f.id} className="feature-chip">✓ {f.featureName}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {car.description && (
            <div className="section-card">
              <h2>Description</h2>
              <p className="description-text">{car.description}</p>
            </div>
          )}
        </div>

        {/* Right — Seller Contact Card */}
        <div className="details-right">
          <div className="seller-card">
            <h3>Seller Information</h3>
            <div className="seller-name">
              <span className="seller-avatar">👤</span>
              <div>
                <p className="seller-fullname">{sellerName}</p>
                <p className="seller-type">{formatLabel(seller?.sellerType)} Seller</p>
              </div>
            </div>

            {seller?.verified && (
              <div className="trust-badges">
                <span className="badge green">🟢 Verified Seller</span>
                {seller?.rating > 0 && <span className="badge blue">⭐ {seller.rating.toFixed(1)} / 5</span>}
              </div>
            )}

            <div className="contact-buttons">
              {sellerWhatsApp && (
                <a
                  href={`https://wa.me/${sellerWhatsApp.replace(/\D/g, '')}?text=${whatsappMsg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="contact-btn whatsapp"
                >
                  💬 WhatsApp Seller
                </a>
              )}
              {sellerPhone && (
                <a href={`tel:${sellerPhone}`} className="contact-btn phone">
                  📞 Call Seller
                </a>
              )}
              {user && user.id !== car.seller?.userId && (
                <Link to={`/messages/${car.seller.userId}/${car.id}`} className="contact-btn message">
                  ✉️ Message Seller
                </Link>
              )}
            </div>

            <p className="contact-note">
              Mention CarMarket Ghana when you call. Always inspect the vehicle before paying.
            </p>

            <div className="action-buttons">
              <button onClick={toggleFavorite} className={`action-btn favorite ${isFavorite ? 'active' : ''}`}>
                <Heart size={18} fill={isFavorite ? '#DC2626' : 'none'} />
                {isFavorite ? 'Saved' : 'Save Car'}
              </button>
              <button onClick={() => setShowReportModal(true)} className="action-btn report">
                <Flag size={18} />
                Report
              </button>
            </div>

            {/* If seller is the owner, show edit button */}
            {user && user.role === 'SELLER' && car.seller?.userId === user.id && (
              <button
                className="edit-btn"
                onClick={() => navigate(`/sell/edit/${car.id}`)}
              >
                ✏️ Edit Listing
              </button>
            )}
          </div>

          {/* Safety tip */}
          <div className="safety-card">
            <h4>🛡️ Safety Tips</h4>
            <ul>
              <li>Always meet in a public place</li>
              <li>Inspect the car before making any payment</li>
              <li>Verify ownership documents</li>
              <li>Never send money in advance</li>
            </ul>
          </div>
        </div>

      </div>

      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Report Listing</h3>
            <p>Please provide a reason for reporting this listing.</p>
            <form onSubmit={handleReport}>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                required
              />
              <div className="modal-actions">
                <button type="button" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button type="submit" disabled={reportSubmitting}>
                  {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarDetails;
