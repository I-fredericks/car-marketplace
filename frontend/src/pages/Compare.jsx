import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Car, ShieldCheck, MapPin } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';
import './Compare.css';

const Compare = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);

  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());

  useEffect(() => {
    if (ids.length < 2) {
      setError('Please select two vehicles to compare.');
      setLoading(false);
      return;
    }

    const fetchCars = async () => {
      setLoading(true);
      try {
        const responses = await Promise.all(
          ids.slice(0, 2).map(id => api.get(`/vehicles/${id}`))
        );
        setCars(responses.map(res => res.data));
      } catch (err) {
        console.error('Error fetching cars for comparison:', err);
        setError('Could not load one or both vehicles for comparison.');
      } finally {
        setLoading(false);
      }
    };

    fetchCars();
  }, [idsParam]);

  const handleImageError = (carId) => {
    setBrokenImages(prev => new Set(prev).add(carId));
  };

  const formatPrice = (price) => `GH₵${Number(price).toLocaleString()}`;
  const formatLabel = (str) => str?.replace(/_/g, ' ') || '—';

  if (loading) {
    return <div className="compare-page page-loading">Loading vehicles comparison...</div>;
  }

  if (error || cars.length < 2) {
    return (
      <div className="compare-page error-container">
        <h2>Comparison Error</h2>
        <p>{error || 'Insufficient vehicles selected.'}</p>
        <button onClick={() => navigate('/search')} className="back-to-search-btn">
          <ArrowLeft size={16} /> Back to Search
        </button>
      </div>
    );
  }

  const [carA, carB] = cars;

  // Highlights
  const priceWinner = carA.price === carB.price ? null : carA.price < carB.price ? carA.id : carB.id;
  const mileageWinner = (carA.mileage && carB.mileage)
    ? (carA.mileage === carB.mileage ? null : carA.mileage < carB.mileage ? carA.id : carB.id)
    : null;

  // Features list combination
  const allFeaturesList = Array.from(
    new Set([
      ...(carA.features?.map(f => f.featureName) || []),
      ...(carB.features?.map(f => f.featureName) || [])
    ])
  );

  const specRows = [
    { label: 'Price', valueA: formatPrice(carA.price), valueB: formatPrice(carB.price), isPrice: true },
    { label: 'Year', valueA: carA.year, valueB: carB.year },
    { label: 'Condition', valueA: formatLabel(carA.condition), valueB: formatLabel(carB.condition) },
    { label: 'Mileage', valueA: carA.mileage ? `${carA.mileage.toLocaleString()} km` : '—', valueB: carB.mileage ? `${carB.mileage.toLocaleString()} km` : '—', isMileage: true },
    { label: 'Transmission', valueA: formatLabel(carA.transmission), valueB: formatLabel(carB.transmission) },
    { label: 'Fuel Type', valueA: formatLabel(carA.fuelType), valueB: formatLabel(carB.fuelType) },
    { label: 'Engine Size', valueA: carA.engineSize || '—', valueB: carB.engineSize || '—' },
    { label: 'Body Type', valueA: carA.bodyType || '—', valueB: carB.bodyType || '—' },
    { label: 'Color', valueA: carA.color || '—', valueB: carB.color || '—' },
    { label: 'Location', valueA: carA.location, valueB: carB.location },
  ];

  return (
    <div className="compare-page">
      <div className="compare-container">
        <div className="compare-header">
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={18} /> Back
          </button>
          <h1>Compare Vehicles</h1>
          <p>Side-by-side comparison to help you choose the best deal.</p>
        </div>

        <div className="compare-grid">
          {/* Header Row — Cards */}
          <div className="compare-cards-row">
            <div className="compare-card">
              <div className="compare-img-box">
                {carA.images && carA.images.length > 0 && !brokenImages.has(carA.id)
                  ? <img src={getImageUrl(carA.images[0].data)} alt={carA.make} onError={() => handleImageError(carA.id)} />
                  : <div className="no-img"><Car size={40} /></div>
                }
              </div>
              <h2>{carA.year} {carA.make} {carA.model}</h2>
              <p className="price-tag">{formatPrice(carA.price)}</p>
              <Link to={`/car/${carA.id}`} className="view-link-btn">View Listing</Link>
            </div>

            <div className="compare-vs">VS</div>

            <div className="compare-card">
              <div className="compare-img-box">
                {carB.images && carB.images.length > 0 && !brokenImages.has(carB.id)
                  ? <img src={getImageUrl(carB.images[0].data)} alt={carB.make} onError={() => handleImageError(carB.id)} />
                  : <div className="no-img"><Car size={40} /></div>
                }
              </div>
              <h2>{carB.year} {carB.make} {carB.model}</h2>
              <p className="price-tag">{formatPrice(carB.price)}</p>
              <Link to={`/car/${carB.id}`} className="view-link-btn">View Listing</Link>
            </div>
          </div>

          {/* Table — Key Specifications */}
          <div className="section-title">Key Specifications</div>
          <div className="compare-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="feature-col">Specification</th>
                  <th>{carA.year} {carA.make} {carA.model}</th>
                  <th>{carB.year} {carB.make} {carB.model}</th>
                </tr>
              </thead>
              <tbody>
                {specRows.map(row => {
                  let classA = '';
                  let classB = '';

                  if (row.isPrice && priceWinner) {
                    if (priceWinner === carA.id) classA = 'winner-cell';
                    if (priceWinner === carB.id) classB = 'winner-cell';
                  }

                  if (row.isMileage && mileageWinner) {
                    if (mileageWinner === carA.id) classA = 'winner-cell';
                    if (mileageWinner === carB.id) classB = 'winner-cell';
                  }

                  return (
                    <tr key={row.label}>
                      <td className="spec-name">{row.label}</td>
                      <td className={classA}>{row.valueA}</td>
                      <td className={classB}>{row.valueB}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table — Features Comparison */}
          {allFeaturesList.length > 0 && (
            <>
              <div className="section-title">Features & Options</div>
              <div className="compare-table-wrapper">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th className="feature-col">Feature</th>
                      <th>{carA.make} {carA.model}</th>
                      <th>{carB.make} {carB.model}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allFeaturesList.map(feat => {
                      const hasA = carA.features?.some(f => f.featureName === feat);
                      const hasB = carB.features?.some(f => f.featureName === feat);
                      return (
                        <tr key={feat}>
                          <td className="spec-name">{feat}</td>
                          <td>{hasA ? <Check className="icon-check" size={18} /> : <X className="icon-cross" size={18} />}</td>
                          <td>{hasB ? <Check className="icon-check" size={18} /> : <X className="icon-cross" size={18} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Seller Trust Comparison */}
          <div className="section-title">Seller Trust & Information</div>
          <div className="compare-table-wrapper">
            <table className="compare-table">
              <tbody>
                <tr>
                  <td className="spec-name">Seller Type</td>
                  <td>{formatLabel(carA.seller?.sellerType)}</td>
                  <td>{formatLabel(carB.seller?.sellerType)}</td>
                </tr>
                <tr>
                  <td className="spec-name">Verification Status</td>
                  <td>
                    {carA.seller?.verified ? (
                      <span className="verified-badge"><ShieldCheck size={14} /> Verified</span>
                    ) : 'Unverified'}
                  </td>
                  <td>
                    {carB.seller?.verified ? (
                      <span className="verified-badge"><ShieldCheck size={14} /> Verified</span>
                    ) : 'Unverified'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compare;
