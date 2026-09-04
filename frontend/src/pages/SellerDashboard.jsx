import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { Car, Plus, ShieldAlert, Eye, Edit2, CheckCircle, Trash2, CreditCard } from 'lucide-react';
import Badge from '../components/Badge';

const STATUS_LABEL = {
  PENDING: 'Pending',
  AVAILABLE: 'Available',
  SOLD: 'Sold',
  REJECTED: 'Rejected'
};

const SellerDashboard = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [billing, setBilling] = useState(null);

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
    if (user && (user.role === 'SELLER' || user.role === 'ADMIN')) {
      api.get('/billing/status')
        .then(({ data }) => setBilling(data))
        .catch(() => {});
    }
  }, [user]);

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

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
        <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!user || user.role === 'BUYER') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Become a Seller</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            You need a Seller account to view this dashboard. Upgrade your buyer account to get started.
          </p>
          {user ? (
            <Link to="/become-seller" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
              Upgrade to Seller
            </Link>
          ) : (
            <Link to="/login" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
              Sign In
            </Link>
          )}
          <Link to="/" className="w-full h-11 mt-3 bg-bg border border-bordercol text-textprimary font-medium rounded-md hover:bg-bordercol/30 transition-colors flex items-center justify-center">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadgeType = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'success';
      case 'PENDING': return 'accent';
      case 'REJECTED': return 'err';
      case 'SOLD': return 'neutral';
      default: return 'neutral';
    }
  };

  // Free-plan listings are taken down after 90 days unless the seller upgrades
  const expiryInfo = (expiresAt) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt) - Date.now()) / 86400000);
    if (days <= 0) return { label: 'Expired — taken down', tone: 'err', expired: true };
    if (days <= 14) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warn', expired: false };
    return { label: `${days} days left`, tone: 'muted', expired: false };
  };

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-textprimary mb-2">My Listings</h1>
            <p className="text-textsecondary">Manage your car listings</p>
          </div>
          <Link 
            to="/sell" 
            className="h-11 px-6 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} /> New Listing
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
            {error}
          </div>
        )}

        {/* Billing / plan status */}
        {billing && (
          <div className="mb-8 bg-surface border border-bordercol rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <CreditCard size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-textprimary">
                  {billing.plan.label} plan
                  <span className="ml-2 text-sm font-normal text-textsecondary">
                    {billing.listingLimit === null
                      ? `· ${billing.listingsUsed} listings (unlimited)`
                      : `· ${billing.listingsUsed} of ${billing.listingLimit} listings used`}
                  </span>
                </h3>
                <p className="text-sm text-textsecondary">
                  {billing.isSubscribed
                    ? `Renews ${new Date(billing.renewsAt).toLocaleDateString()} — your listings never expire`
                    : 'Free tier — 1 active listing, taken down after 90 days'}
                </p>
              </div>
            </div>
            <Link
              to="/pricing"
              className="h-10 px-5 border border-primary text-primary font-medium rounded-md hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <CreditCard size={16} /> Upgrade Plan
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm">
            <span className="block text-3xl font-display font-bold text-textprimary mb-1">{stats.total}</span>
            <span className="text-sm font-medium text-textsecondary uppercase tracking-wider">Total</span>
          </div>
          <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm">
            <span className="block text-3xl font-display font-bold text-accent mb-1">{stats.pending}</span>
            <span className="text-sm font-medium text-textsecondary uppercase tracking-wider">Pending</span>
          </div>
          <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm">
            <span className="block text-3xl font-display font-bold text-success mb-1">{stats.available}</span>
            <span className="text-sm font-medium text-textsecondary uppercase tracking-wider">Available</span>
          </div>
          <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm">
            <span className="block text-3xl font-display font-bold text-textmuted mb-1">{stats.sold}</span>
            <span className="text-sm font-medium text-textsecondary uppercase tracking-wider">Sold</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-textmuted">
            <div className="animate-spin w-10 h-10 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
            <p>Loading your listings...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-16 text-center flex flex-col items-center shadow-sm">
            <Car size={48} className="text-bordercol mb-4" />
            <h3 className="font-display font-semibold text-xl text-textprimary mb-2">You haven't listed any cars yet</h3>
            <p className="text-textsecondary mb-8">Start selling by creating your first listing.</p>
            <Link 
              to="/sell" 
              className="px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primarylight transition-colors flex items-center gap-2"
            >
              <Plus size={18} /> Create Listing
            </Link>
          </div>
        ) : (
          <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
                  <tr>
                    <th className="px-6 py-4">Vehicle</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bordercol">
                  {listings.map(car => (
                    <tr key={car.id} className="hover:bg-bg/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 bg-bg border border-bordercol rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {car.images && car.images.length > 0 && !brokenImages.has(car.id) ? (
                              <img src={getImageUrl(car.images[0])} alt={car.make} onError={() => handleImageError(car.id)} className="w-full h-full object-cover" />
                            ) : (
                              <Car size={20} className="text-textmuted" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-textprimary">{car.year} {car.make} {car.model}</h4>
                            <p className="text-xs text-textsecondary mt-0.5">{car.location} • {car.condition.replace('_', ' ')}</p>
                            {expiryInfo(car.expiresAt) && (() => {
                              const exp = expiryInfo(car.expiresAt);
                              const tones = {
                                err: 'bg-err/10 text-err border-err/20',
                                warn: 'bg-[#EAB308]/10 text-[#B45309] border-[#EAB308]/30',
                                muted: 'bg-bg text-textmuted border-bordercol',
                              };
                              return (
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${tones[exp.tone]}`}>
                                  {exp.label}
                                </span>
                              );
                            })()}
                            {car.expiresAt && new Date(car.expiresAt) < new Date() && (
                              <Link to="/pricing" className="inline-block mt-1 text-[11px] font-bold text-primary hover:underline">
                                Upgrade to reactivate →
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-textprimary">
                        GH₵{Number(car.price).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <Badge type={getStatusBadgeType(car.status)}>
                          {STATUS_LABEL[car.status] || car.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link
                            to={`/car/${car.id}`}
                            className="p-2 text-textsecondary bg-bg border border-bordercol rounded-md hover:text-primary hover:border-primary transition-colors"
                            title="View"
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            to={`/sell/edit/${car.id}`}
                            className="p-2 text-textsecondary bg-bg border border-bordercol rounded-md hover:text-primary hover:border-primary transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </Link>
                          {car.status !== 'SOLD' && (
                            <button 
                              onClick={() => handleMarkSold(car.id)} 
                              className="p-2 text-success bg-success/10 border border-success/20 rounded-md hover:bg-success hover:text-white transition-colors"
                              title="Mark as Sold"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(car.id)} 
                            className="p-2 text-err bg-err/10 border border-err/20 rounded-md hover:bg-err hover:text-white transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;
