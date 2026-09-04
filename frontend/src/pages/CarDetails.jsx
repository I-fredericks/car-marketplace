import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { Heart, Flag, MapPin, MessageCircle, Phone, CheckCircle, ShieldCheck, Car, Star } from 'lucide-react';
import SpecGrid from '../components/SpecGrid';
import StickyContactBar from '../components/StickyContactBar';
import Badge from '../components/Badge';

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

  if (loading) return (
    <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg">
      <div className="animate-spin w-10 h-10 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
      <p className="text-textsecondary">Loading vehicle details...</p>
    </div>
  );
  
  if (!car) return (
    <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg">
      <Car size={64} className="text-bordercol mb-4" />
      <h2 className="font-display font-bold text-2xl text-textprimary mb-2">Vehicle Not Found</h2>
      <Link to="/search" className="text-primary font-medium hover:underline">Return to search</Link>
    </div>
  );

  const seller = car.seller;
  const sellerName = seller?.user?.name || 'Seller';
  const sellerPhone = seller?.user?.phone || '';
  const sellerWhatsApp = seller?.whatsapp || sellerPhone;
  const isVerified = seller?.role === 'ADMIN' || seller?.role === 'SELLER';

  const whatsappMsg = encodeURIComponent(
    `Hello, I'm interested in your ${car.year} ${car.make} ${car.model} listed on CarMarket Ghana for GH₵${Number(car.price).toLocaleString()}. Is it still available?`
  );

  const formatLabel = (str) => str?.replace(/_/g, ' ') || '—';

  const specs = [
    { label: 'Year', value: car.year },
    { label: 'Mileage', value: car.mileage ? `${car.mileage.toLocaleString()} km` : '—' },
    { label: 'Transmission', value: formatLabel(car.transmission) },
    { label: 'Fuel Type', value: formatLabel(car.fuelType) },
    { label: 'Engine Size', value: car.engineSize || '—' },
    { label: 'Body Type', value: car.bodyType || '—' },
    { label: 'Condition', value: formatLabel(car.condition) },
    { label: 'Color', value: car.color || '—' },
  ];

  return (
    <div className="bg-bg min-h-screen pt-24 pb-32 md:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Gallery & Details */}
          <div className="flex-1 min-w-0">
            {/* Header for Mobile */}
            <div className="lg:hidden mb-6">
              <h1 className="font-display font-bold text-3xl text-textprimary mb-2">
                {car.year} {car.make} {car.model}
              </h1>
              <p className="font-display font-bold text-2xl text-primary mb-3">
                GH₵{Number(car.price).toLocaleString()}
              </p>
              <div className="flex items-center gap-3 text-sm">
                <Badge type="neutral">{formatLabel(car.condition)}</Badge>
                <span className="flex items-center gap-1 text-textsecondary">
                  <MapPin size={16} /> {car.location}
                </span>
              </div>
            </div>

            {/* Gallery */}
            <div className="bg-surface border border-bordercol rounded-lg p-2 mb-8 shadow-sm">
              <div className="aspect-[4/3] rounded-md overflow-hidden bg-bg mb-2">
                {car.images && car.images.length > 0 ? (
                  <img 
                    src={getImageUrl(car.images[activeImg])} 
                    alt={`${car.make} ${car.model}`} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-textmuted">
                    <Car size={48} className="mb-2" />
                    <p>No photos available</p>
                  </div>
                )}
              </div>
              
              {car.images && car.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-1 custom-scrollbar">
                  {car.images.map((img, i) => (
                    <button 
                      key={img.id}
                      onClick={() => setActiveImg(i)}
                      className={`flex-shrink-0 w-24 h-18 rounded-md overflow-hidden border-2 ${activeImg === i ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'} transition-all`}
                    >
                      <img src={getImageUrl(img)} alt={`Thumbnail ${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Header for Desktop */}
            <div className="hidden lg:block mb-8">
              <h1 className="font-display font-bold text-4xl text-textprimary mb-2">
                {car.year} {car.make} {car.model}
              </h1>
              <div className="flex items-end justify-between">
                <p className="font-display font-bold text-3xl text-primary">
                  GH₵{Number(car.price).toLocaleString()}
                </p>
                <div className="flex items-center gap-3">
                  <Badge type="neutral">{formatLabel(car.condition)}</Badge>
                  <span className="flex items-center gap-1 text-textsecondary text-sm">
                    <MapPin size={16} /> {car.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="mb-10">
              <h2 className="font-display font-semibold text-xl text-textprimary mb-4">Vehicle Specifications</h2>
              <SpecGrid specs={specs} />
            </div>

            {/* Features Checklist */}
            {car.features && car.features.length > 0 && (
              <div className="mb-10">
                <h2 className="font-display font-semibold text-xl text-textprimary mb-4">Features</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {car.features.map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-sm text-textsecondary">
                      <CheckCircle size={16} className="text-success flex-shrink-0" />
                      <span>{f.featureName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {car.description && (
              <div className="mb-10">
                <h2 className="font-display font-semibold text-xl text-textprimary mb-4">Description</h2>
                <div className="bg-surface border border-bordercol rounded-lg p-5">
                  <p className="text-textsecondary whitespace-pre-wrap leading-relaxed text-sm">
                    {car.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Seller & Actions */}
          <div className="w-full lg:w-[350px] flex-shrink-0">
            <div className="sticky top-24 flex flex-col gap-6">
              
              {/* Seller Card */}
              <div className="bg-surface border border-bordercol rounded-lg p-6 shadow-sm">
                <h3 className="font-display font-semibold text-lg text-textprimary mb-4 border-b border-bordercol pb-2">Seller Information</h3>
                
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-bg rounded-full flex items-center justify-center text-primary text-xl font-bold border border-bordercol">
                    {sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium text-textprimary text-lg">{sellerName}</h4>
                    <p className="text-sm text-textsecondary capitalize">{formatLabel(seller?.sellerType)} Seller</p>
                  </div>
                </div>

                {isVerified && (
                  <div className="flex gap-2 mb-6">
                    <Badge type="success">
                      <ShieldCheck size={14} /> Verified Seller
                    </Badge>
                    {seller?.rating > 0 && (
                      <Badge type="neutral">
                        <Star size={14} className="text-accent" fill="currentColor" /> {seller.rating.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Desktop Action Buttons */}
                <div className="hidden md:flex flex-col gap-3 mb-6">
                  {sellerWhatsApp && (
                    <a 
                      href={`https://wa.me/${sellerWhatsApp.replace(/\D/g, '')}?text=${whatsappMsg}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3 bg-[#25D366] text-white font-bold rounded-md hover:bg-[#1DA851] transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={20} /> WhatsApp Seller
                    </a>
                  )}
                  {sellerPhone && (
                    <a 
                      href={`tel:${sellerPhone}`} 
                      className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
                    >
                      <Phone size={20} /> Call Seller
                    </a>
                  )}
                  {user && user.id !== car.seller?.userId && (
                    <Link 
                      to={`/messages/${car.seller.userId}/${car.id}`} 
                      className="w-full py-3 bg-bg border border-bordercol text-textprimary font-medium rounded-md hover:bg-bordercol/30 transition-colors flex items-center justify-center gap-2"
                    >
                      Message Seller
                    </Link>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-bordercol pt-5">
                  <button 
                    onClick={toggleFavorite} 
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${isFavorite ? 'text-err' : 'text-textsecondary hover:text-primary'}`}
                  >
                    <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                    {isFavorite ? 'Saved' : 'Save Car'}
                  </button>
                  
                  <button 
                    onClick={() => setShowReportModal(true)} 
                    className="flex items-center gap-2 text-sm font-medium text-textmuted hover:text-textprimary transition-colors"
                  >
                    <Flag size={18} /> Report
                  </button>
                </div>

                {user && user.role === 'SELLER' && car.seller?.userId === user.id && (
                  <button
                    className="w-full mt-4 py-2 border border-primary text-primary font-medium rounded-md hover:bg-primary hover:text-white transition-colors"
                    onClick={() => navigate(`/sell/edit/${car.id}`)}
                  >
                    Edit Listing
                  </button>
                )}
              </div>

              {/* Safety Tips */}
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-5">
                <h4 className="font-display font-semibold text-primary mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} /> Safety Tips
                </h4>
                <ul className="text-sm text-textsecondary space-y-2">
                  <li className="flex gap-2"><span className="text-primary">•</span> Always meet in a public place</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Inspect the car before making any payment</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Verify ownership documents</li>
                  <li className="flex gap-2"><span className="text-primary">•</span> Never send money in advance</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Contact Bar */}
      <StickyContactBar
        phone={sellerPhone}
        whatsapp={sellerWhatsApp}
        sellerUserId={car.seller?.userId}
        vehicleId={car.id}
        isLoggedIn={Boolean(user)}
      />

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-textprimary/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-xl text-textprimary mb-2">Report Listing</h3>
            <p className="text-sm text-textsecondary mb-4">Please provide a reason for reporting this listing.</p>
            <form onSubmit={handleReport}>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full p-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary mb-4 resize-none"
                required
              />
              <div className="flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-textsecondary hover:bg-bg rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={reportSubmitting}
                  className="px-4 py-2 text-sm font-medium bg-err text-white rounded-md hover:bg-err/90 transition-colors disabled:opacity-50"
                >
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
