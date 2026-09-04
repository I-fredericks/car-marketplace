import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Car, ShieldCheck } from 'lucide-react';
import api, { getImageUrl } from '../utils/api';

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
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg text-textmuted">
        <div className="animate-spin w-10 h-10 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
        <p>Loading vehicles comparison...</p>
      </div>
    );
  }

  if (error || cars.length < 2) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg px-4">
        <div className="bg-surface border border-bordercol rounded-xl p-8 max-w-md w-full text-center">
          <h2 className="font-display font-bold text-2xl text-err mb-2">Comparison Error</h2>
          <p className="text-textsecondary mb-6">{error || 'Insufficient vehicles selected.'}</p>
          <button 
            onClick={() => navigate('/search')} 
            className="w-full py-3 bg-primary text-white font-medium rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Back to Search
          </button>
        </div>
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
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-1 text-sm font-medium text-textsecondary hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="font-display font-bold text-3xl text-textprimary mb-2">Compare Vehicles</h1>
          <p className="text-textsecondary">Side-by-side comparison to help you choose the best deal.</p>
        </div>

        <div className="bg-surface border border-bordercol rounded-lg overflow-hidden shadow-sm">
          
          {/* Header Row — Cards */}
          <div className="grid grid-cols-2 p-4 sm:p-6 gap-4 sm:gap-6 border-b border-bordercol relative">
            <div className="absolute inset-y-0 left-1/2 w-px bg-bordercol transform -translate-x-1/2"></div>
            
            {[carA, carB].map((car, idx) => (
              <div key={car.id} className={`flex flex-col items-center text-center ${idx === 0 ? 'pr-2' : 'pl-2'}`}>
                <div className="w-full aspect-[4/3] bg-bg rounded-md overflow-hidden mb-4 border border-bordercol flex items-center justify-center">
                  {car.images && car.images.length > 0 && !brokenImages.has(car.id) ? (
                    <img src={getImageUrl(car.images[0])} alt={car.make} onError={() => handleImageError(car.id)} className="w-full h-full object-cover" />
                  ) : (
                    <Car size={32} className="text-bordercol" />
                  )}
                </div>
                <h2 className="font-display font-semibold text-lg text-textprimary line-clamp-1 mb-1">
                  {car.year} {car.make} {car.model}
                </h2>
                <p className="font-display font-bold text-xl text-primary mb-4">
                  {formatPrice(car.price)}
                </p>
                <Link 
                  to={`/car/${car.id}`} 
                  className="w-full py-2 bg-primary/5 text-primary border border-primary/20 font-medium rounded-md hover:bg-primary hover:text-white transition-colors text-sm"
                >
                  View Listing
                </Link>
              </div>
            ))}
          </div>

          {/* Table — Key Specifications */}
          <div className="overflow-x-auto">
            <div className="bg-bg px-6 py-3 border-b border-bordercol">
              <h3 className="font-display font-semibold text-textprimary">Key Specifications</h3>
            </div>
            <table className="w-full text-sm text-left border-collapse">
              <tbody>
                {specRows.map((row, i) => {
                  let classA = 'py-4 px-4 sm:px-6 w-[35%] align-top';
                  let classB = 'py-4 px-4 sm:px-6 w-[35%] align-top';

                  if (row.isPrice && priceWinner) {
                    if (priceWinner === carA.id) classA += ' bg-success/10 font-semibold text-success';
                    if (priceWinner === carB.id) classB += ' bg-success/10 font-semibold text-success';
                  }

                  if (row.isMileage && mileageWinner) {
                    if (mileageWinner === carA.id) classA += ' bg-success/10 font-semibold text-success';
                    if (mileageWinner === carB.id) classB += ' bg-success/10 font-semibold text-success';
                  }

                  return (
                    <tr key={row.label} className={i !== specRows.length - 1 ? 'border-b border-bordercol' : ''}>
                      <td className="py-4 px-4 sm:px-6 font-medium text-textsecondary w-[30%] bg-surface border-r border-bordercol align-top">
                        {row.label}
                      </td>
                      <td className={`${classA} border-r border-bordercol`}>{row.valueA}</td>
                      <td className={classB}>{row.valueB}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table — Features Comparison */}
          {allFeaturesList.length > 0 && (
            <div className="overflow-x-auto border-t border-bordercol">
              <div className="bg-bg px-6 py-3 border-b border-bordercol">
                <h3 className="font-display font-semibold text-textprimary">Features & Options</h3>
              </div>
              <table className="w-full text-sm text-left border-collapse">
                <tbody>
                  {allFeaturesList.map((feat, i) => {
                    const hasA = carA.features?.some(f => f.featureName === feat);
                    const hasB = carB.features?.some(f => f.featureName === feat);
                    return (
                      <tr key={feat} className={i !== allFeaturesList.length - 1 ? 'border-b border-bordercol' : ''}>
                        <td className="py-3 px-4 sm:px-6 font-medium text-textsecondary w-[30%] bg-surface border-r border-bordercol align-top">
                          {feat}
                        </td>
                        <td className="py-3 px-4 sm:px-6 w-[35%] text-center border-r border-bordercol">
                          {hasA ? <Check className="text-success inline-block" size={18} /> : <X className="text-textmuted inline-block" size={18} />}
                        </td>
                        <td className="py-3 px-4 sm:px-6 w-[35%] text-center">
                          {hasB ? <Check className="text-success inline-block" size={18} /> : <X className="text-textmuted inline-block" size={18} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Seller Trust Comparison */}
          <div className="overflow-x-auto border-t border-bordercol">
            <div className="bg-bg px-6 py-3 border-b border-bordercol">
              <h3 className="font-display font-semibold text-textprimary">Seller Trust & Info</h3>
            </div>
            <table className="w-full text-sm text-left border-collapse">
              <tbody>
                <tr className="border-b border-bordercol">
                  <td className="py-4 px-4 sm:px-6 font-medium text-textsecondary w-[30%] bg-surface border-r border-bordercol">Seller Type</td>
                  <td className="py-4 px-4 sm:px-6 w-[35%] border-r border-bordercol capitalize">{formatLabel(carA.seller?.sellerType)}</td>
                  <td className="py-4 px-4 sm:px-6 w-[35%] capitalize">{formatLabel(carB.seller?.sellerType)}</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 sm:px-6 font-medium text-textsecondary w-[30%] bg-surface border-r border-bordercol">Verification</td>
                  <td className="py-4 px-4 sm:px-6 w-[35%] border-r border-bordercol">
                    {carA.seller?.verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs font-bold rounded-full">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-textmuted">Unverified</span>
                    )}
                  </td>
                  <td className="py-4 px-4 sm:px-6 w-[35%]">
                    {carB.seller?.verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success text-xs font-bold rounded-full">
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-textmuted">Unverified</span>
                    )}
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
