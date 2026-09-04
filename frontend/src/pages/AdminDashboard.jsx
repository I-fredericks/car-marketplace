import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import {
  ShieldAlert, LayoutDashboard, Car, List, AlertTriangle, Users,
  Check, X, Eye, Star, ShieldCheck, Trash2, CreditCard
} from 'lucide-react';
import Badge from '../components/Badge';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingCars, setPendingCars] = useState([]);
  const [allCars, setAllCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toast = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const { data } = await api.get('/admin/stats');
        setStats(data);
      } else if (tab === 'pending') {
        const { data } = await api.get('/admin/vehicles/pending');
        setPendingCars(data);
      } else if (tab === 'allListings') {
        const { data } = await api.get('/admin/vehicles/all');
        setAllCars(data);
      } else if (tab === 'reports') {
        const { data } = await api.get('/admin/reports');
        setReports(data);
      } else if (tab === 'users') {
        const { data } = await api.get('/admin/users');
        setUsers(data);
      } else if (tab === 'payments') {
        const { data } = await api.get('/admin/payments');
        setPayments(data);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-err/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert size={32} className="text-err" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Access Denied</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            You need an admin account to view this page.
          </p>
          <Link to="/" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const handleListingAction = async (id, status) => {
    try {
      await api.put(`/admin/vehicles/${id}/status`, { status });
      toast(`Listing ${status === 'AVAILABLE' ? 'approved ✅' : 'rejected ❌'}`);
      setPendingCars(prev => prev.filter(c => c.id !== id));
    } catch {
      toast('Action failed.');
    }
  };

  const handleToggleFeatured = async (id, currentFeatured) => {
    try {
      await api.put(`/admin/vehicles/${id}/featured`);
      toast(currentFeatured ? 'Listing unfeatured' : '⭐ Listing featured on homepage!');
      setAllCars(prev => prev.map(c => c.id === id ? { ...c, featured: !c.featured } : c));
    } catch {
      toast('Featured toggle failed.');
    }
  };

  const handleVerifySeller = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/verify`);
      toast('Seller verified 🟢');
      fetchData();
    } catch {
      toast('Verification failed.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure? This will permanently delete the user.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast('User deleted.');
    } catch {
      toast('Delete failed.');
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await api.put(`/admin/reports/${reportId}/resolve`);
      toast('Report resolved ✅');
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'RESOLVED' } : r));
    } catch {
      toast('Failed to resolve report.');
    }
  };

  const handleVerifyPayment = async (id) => {
    try {
      const { data } = await api.put(`/admin/payments/${id}/verify`);
      toast(data.message || 'Payment verified ✅');
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'VERIFIED' } : p));
    } catch {
      toast('Verification failed.');
    }
  };

  const handleRejectPayment = async (id) => {
    if (!window.confirm('Reject this payment? The seller will need to pay again.')) return;
    try {
      await api.put(`/admin/payments/${id}/reject`);
      toast('Payment rejected.');
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'REJECTED' } : p));
    } catch {
      toast('Action failed.');
    }
  };

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  // ──────────────────────────────────────────────────────
  // SUB-RENDERS
  // ──────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Marketplace Overview</h2>
        <p className="text-sm text-textsecondary">Live stats across all users, listings, and activity.</p>
      </div>

      {loading || !stats ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-4">Users</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary"><Users size={24} /></div>
                <div>
                  <div className="text-2xl font-display font-bold text-textprimary">{stats.users.total}</div>
                  <div className="text-sm text-textsecondary font-medium">Total Users</div>
                </div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center text-success"><ShieldCheck size={24} /></div>
                <div>
                  <div className="text-2xl font-display font-bold text-textprimary">{stats.users.sellers}</div>
                  <div className="text-sm text-textsecondary font-medium">Sellers</div>
                </div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-5 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent"><Car size={24} /></div>
                <div>
                  <div className="text-2xl font-display font-bold text-textprimary">{stats.users.buyers}</div>
                  <div className="text-sm text-textsecondary font-medium">Buyers</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-4">Listings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-accent mb-1">{stats.listings.pending}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Pending</div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-success mb-1">{stats.listings.available}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Live</div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-primary mb-1">{stats.listings.sold}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Sold</div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-err mb-1">{stats.listings.rejected}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Rejected</div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-[#EAB308] mb-1">{stats.listings.featured}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Featured</div>
              </div>
              <div className="bg-surface border border-bordercol rounded-lg p-4 text-center shadow-sm">
                <div className="text-xl font-display font-bold text-textprimary mb-1">{stats.listings.total}</div>
                <div className="text-[11px] font-medium text-textsecondary uppercase">Total</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPending = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Pending Listings ({pendingCars.length})</h2>
        <p className="text-sm text-textsecondary">Review and approve or reject submitted car listings.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : pendingCars.length === 0 ? (
        <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
          <Check size={48} className="mx-auto text-success/50 mb-4" />
          <p>No pending listings to review!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingCars.map(car => (
            <div key={car.id} className="bg-surface border border-bordercol rounded-lg p-4 flex flex-col shadow-sm">
              <div className="flex gap-4 mb-4">
                <div className="w-24 h-24 bg-bg rounded-md border border-bordercol flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                    ? <img src={getImageUrl(car.images[0])} alt={car.make} onError={() => handleImageError(car.id)} className="w-full h-full object-cover" />
                    : <Car size={24} className="text-textmuted" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-textprimary truncate">{car.year} {car.make} {car.model}</h3>
                  <p className="font-bold text-primary mb-1">GH₵{Number(car.price).toLocaleString()}</p>
                  <p className="text-xs text-textsecondary mb-1">📍 {car.location} • {car.condition.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-textmuted truncate">Seller: {car.seller?.user?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-auto">
                <button 
                  onClick={() => handleListingAction(car.id, 'AVAILABLE')} 
                  className="py-2 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold flex justify-center items-center gap-1"
                >
                  <Check size={14} /> Approve
                </button>
                <button 
                  onClick={() => handleListingAction(car.id, 'REJECTED')} 
                  className="py-2 bg-err/10 text-err border border-err/20 rounded hover:bg-err hover:text-white transition-colors text-xs font-bold flex justify-center items-center gap-1"
                >
                  <X size={14} /> Reject
                </button>
                <Link 
                  to={`/car/${car.id}`} 
                  className="py-2 bg-bg text-textprimary border border-bordercol rounded hover:bg-bordercol/30 transition-colors text-xs font-bold flex justify-center items-center gap-1"
                >
                  <Eye size={14} /> View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAllListings = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">All Live Listings ({allCars.length})</h2>
        <p className="text-sm text-textsecondary">Promote listings to the homepage by starring them as Featured.</p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : allCars.length === 0 ? (
        <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
          No live listings yet.
        </div>
      ) : (
        <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Seller</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordercol">
              {allCars.map(car => (
                <tr key={car.id} className={`transition-colors ${car.featured ? 'bg-[#EAB308]/5' : 'hover:bg-bg/50'}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-10 bg-bg border border-bordercol rounded overflow-hidden flex-shrink-0">
                        {car.images && car.images.length > 0 && !brokenImages.has(`all-${car.id}`) ? (
                          <img src={getImageUrl(car.images[0])} alt={car.make} onError={() => handleImageError(`all-${car.id}`)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Car size={16} className="text-textmuted" /></div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-textprimary">{car.year} {car.make} {car.model}</h4>
                          {car.featured && <Badge type="accent">Featured</Badge>}
                        </div>
                        <p className="text-xs text-textsecondary mt-0.5">{car.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-textprimary">GH₵{Number(car.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-textsecondary">{car.seller?.user?.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${
                          car.featured 
                            ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/20 hover:bg-[#EAB308] hover:text-white' 
                            : 'bg-surface text-textsecondary border-bordercol hover:bg-bg'
                        }`}
                        onClick={() => handleToggleFeatured(car.id, car.featured)}
                      >
                        <Star size={14} fill={car.featured ? "currentColor" : "none"} /> 
                        {car.featured ? 'Unfeature' : 'Feature'}
                      </button>
                      <Link 
                        to={`/car/${car.id}`} 
                        className="p-1.5 text-textsecondary bg-bg border border-bordercol rounded hover:text-primary transition-colors"
                      >
                        <Eye size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderReports = () => {
    const pendingReports = reports.filter(r => r.status === 'PENDING');
    const resolvedReports = reports.filter(r => r.status === 'RESOLVED');
    
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Reports ({reports.length})</h2>
          <p className="text-sm text-textsecondary">Review flagged listings and resolve or dismiss reports.</p>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
            <Check size={48} className="mx-auto text-success/50 mb-4" />
            <p>No reports submitted yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingReports.length > 0 && (
              <div>
                <h3 className="font-medium text-err mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} /> Pending ({pendingReports.length})
                </h3>
                <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
                      <tr>
                        <th className="px-6 py-4">Reporter</th>
                        <th className="px-6 py-4">Vehicle</th>
                        <th className="px-6 py-4">Reason</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordercol">
                      {pendingReports.map(r => (
                        <tr key={r.id}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-textprimary">{r.reporter?.name}</div>
                            <div className="text-xs text-textmuted">{r.reporter?.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            {r.vehicle ? (
                              <Link to={`/car/${r.vehicle.id}`} className="text-primary hover:underline font-medium">
                                {r.vehicle.year} {r.vehicle.make}
                              </Link>
                            ) : (
                              <span className="text-textmuted">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-err max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                          <td className="px-6 py-4 text-textsecondary">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => handleResolveReport(r.id)} 
                              className="px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold"
                            >
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {resolvedReports.length > 0 && (
              <div>
                <h3 className="font-medium text-textsecondary mb-3 flex items-center gap-2">
                  <Check size={18} /> Resolved ({resolvedReports.length})
                </h3>
                <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto opacity-75">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg border-b border-bordercol text-textmuted uppercase tracking-wider font-semibold text-xs">
                      <tr>
                        <th className="px-6 py-4">Reporter</th>
                        <th className="px-6 py-4">Vehicle</th>
                        <th className="px-6 py-4">Reason</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordercol">
                      {resolvedReports.map(r => (
                        <tr key={r.id}>
                          <td className="px-6 py-4 text-textsecondary">{r.reporter?.name}</td>
                          <td className="px-6 py-4">
                            {r.vehicle ? (
                              <Link to={`/car/${r.vehicle.id}`} className="text-primary/70 hover:underline">
                                {r.vehicle.make}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="px-6 py-4 text-textsecondary truncate max-w-[200px]">{r.reason}</td>
                          <td className="px-6 py-4">
                            <Badge type="neutral">Resolved</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderUsers = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">All Users ({users.length})</h2>
        <p className="text-sm text-textsecondary">Manage accounts, verify sellers, remove bad actors.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : (
        <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Verified</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordercol">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-textprimary">{u.name}</div>
                    <div className="text-xs text-textmuted">{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                      u.role === 'ADMIN' ? 'bg-err/10 text-err' : u.role === 'SELLER' ? 'bg-primary/10 text-primary' : 'bg-bg border border-bordercol text-textsecondary'
                    }`}>
                      {u.role}
                    </span>
                    {u.role === 'SELLER' && u.sellerProfile && (
                      <span className="block text-[10px] text-textmuted mt-1 uppercase">{u.sellerProfile.sellerType}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.verified ? (
                      <span className="inline-flex items-center gap-1 text-success font-medium text-xs">
                        <ShieldCheck size={14} /> Yes
                      </span>
                    ) : (
                      <span className="text-textmuted text-xs font-medium">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-textsecondary">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {u.role === 'SELLER' && !u.verified && (
                        <button 
                          onClick={() => handleVerifySeller(u.id)} 
                          className="px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold"
                        >
                          Verify
                        </button>
                      )}
                      {u.role !== 'ADMIN' && (
                        <button 
                          onClick={() => handleDeleteUser(u.id)} 
                          className="p-1.5 bg-surface text-err border border-bordercol rounded hover:bg-err hover:text-white hover:border-err transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPayments = () => {
    const pending = payments.filter(p => p.status === 'PENDING');
    const processed = payments.filter(p => p.status !== 'PENDING');
    const statusBadge = (status) => {
      if (status === 'PENDING') return <Badge type="accent">Pending</Badge>;
      if (status === 'VERIFIED') return <Badge type="success">Verified</Badge>;
      return <Badge type="err">Rejected</Badge>;
    };

    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-2xl text-textprimary mb-1">
            Payments {pending.length > 0 && <span className="text-err">({pending.length} awaiting)</span>}
          </h2>
          <p className="text-sm text-textsecondary">
            Verify Mobile Money payments to activate listing boosts and dealer subscriptions.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
            <CreditCard size={48} className="mx-auto text-bordercol mb-4" />
            <p>No payments yet. Seller purchases will appear here for verification.</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-3">Awaiting verification</h3>
                <div className="space-y-3">
                  {pending.map(p => (
                    <div key={p.id} className="bg-surface border border-accent/40 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-display font-bold text-textprimary">{p.reference}</span>
                          <Badge type="neutral">{p.plan.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-sm text-textsecondary">
                          {p.user?.name} ({p.user?.email}{p.user?.phone ? ` · ${p.user.phone}` : ''})
                        </p>
                        {p.vehicle && (
                          <p className="text-xs text-textmuted mt-0.5">
                            Boosting: {p.vehicle.year} {p.vehicle.make} {p.vehicle.model}
                          </p>
                        )}
                        <p className="text-xs text-textmuted mt-0.5">
                          Requested {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-lg text-primary">GH₵{Number(p.amount / 100).toLocaleString()}</span>
                        <button
                          onClick={() => handleVerifyPayment(p.id)}
                          className="px-4 py-2 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                        >
                          <Check size={14} /> Verify
                        </button>
                        <button
                          onClick={() => handleRejectPayment(p.id)}
                          className="px-4 py-2 bg-err/10 text-err border border-err/20 rounded hover:bg-err hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {processed.length > 0 && (
              <div>
                <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-3">History</h3>
                <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
                      <tr>
                        <th className="px-6 py-4">Reference</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">Seller</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordercol">
                      {processed.map(p => (
                        <tr key={p.id} className="hover:bg-bg/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-textprimary">{p.reference}</td>
                          <td className="px-6 py-4 text-textsecondary">{p.plan.replace('_', ' ')}</td>
                          <td className="px-6 py-4 text-textsecondary">{p.user?.name}</td>
                          <td className="px-6 py-4 font-medium text-textprimary">GH₵{Number(p.amount / 100).toLocaleString()}</td>
                          <td className="px-6 py-4">{statusBadge(p.status)}</td>
                          <td className="px-6 py-4 text-textsecondary">{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { id: 'pending', icon: <Car size={18} />, label: `Pending ${pendingCars.length > 0 ? `(${pendingCars.length})` : ''}` },
    { id: 'allListings', icon: <List size={18} />, label: 'All Listings' },
    { id: 'payments', icon: <CreditCard size={18} />, label: `Payments ${payments.filter(p => p.status === 'PENDING').length > 0 ? `(${payments.filter(p => p.status === 'PENDING').length})` : ''}` },
    { id: 'reports', icon: <AlertTriangle size={18} />, label: `Reports ${reports.filter(r => r.status === 'PENDING').length > 0 ? `(${reports.filter(r => r.status === 'PENDING').length})` : ''}` },
    { id: 'users', icon: <Users size={18} />, label: 'Manage Users' },
  ];

  return (
    <div className="bg-bg min-h-screen pt-16">
      
      {/* Toast Notification */}
      {actionMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-white px-4 py-3 rounded-md shadow-lg font-medium text-sm animate-fade-in flex items-center gap-2">
          <Check size={16} /> {actionMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-surface border-r border-bordercol flex-shrink-0 flex flex-col z-20">
          <div className="p-4 border-b border-bordercol flex items-center justify-between md:block">
            <h2 className="font-display font-bold text-lg text-primary flex items-center gap-2">
              <ShieldCheck size={20} /> Admin Panel
            </h2>
            <button 
              className="md:hidden p-2 bg-bg rounded text-textsecondary"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <List size={20} />
            </button>
          </div>
          
          <nav className={`flex-1 overflow-y-auto py-4 ${isMobileMenuOpen ? 'block' : 'hidden md:block'}`}>
            <ul className="space-y-1 px-3">
              {tabs.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => { setTab(t.id); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      tab === t.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-textsecondary hover:bg-bg hover:text-textprimary'
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {tab === 'overview'    && renderOverview()}
            {tab === 'pending'     && renderPending()}
            {tab === 'allListings' && renderAllListings()}
            {tab === 'payments'    && renderPayments()}
            {tab === 'reports'     && renderReports()}
            {tab === 'users'       && renderUsers()}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default AdminDashboard;
