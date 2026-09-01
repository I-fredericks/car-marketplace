import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [pendingCars, setPendingCars] = useState([]);
  const [allCars, setAllCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());

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
      <div className="admin-guard">
        <h2>🚫 Access Denied</h2>
        <p>You need an admin account to view this page.</p>
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

  const handleImageError = (id) => {
    setBrokenImages(prev => new Set(prev).add(id));
  };

  // ──────────────────────────────────────────────────────
  // SUB-RENDERS
  // ──────────────────────────────────────────────────────

  const renderOverview = () => (
    <div>
      <h2>📊 Marketplace Overview</h2>
      <p className="admin-hint">Live stats across all users, listings, and activity.</p>

      {loading || !stats ? (
        <p className="loading-msg">Loading stats...</p>
      ) : (
        <>
          <div className="stats-section-label">Users</div>
          <div className="stats-grid">
            <div className="stat-card stat-blue">
              <div className="stat-icon">👥</div>
              <div className="stat-number">{stats.users.total}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">🏪</div>
              <div className="stat-number">{stats.users.sellers}</div>
              <div className="stat-label">Sellers</div>
            </div>
            <div className="stat-card stat-purple">
              <div className="stat-icon">🛒</div>
              <div className="stat-number">{stats.users.buyers}</div>
              <div className="stat-label">Buyers</div>
            </div>
          </div>

          <div className="stats-section-label">Listings</div>
          <div className="stats-grid stats-grid-4">
            <div className="stat-card stat-orange">
              <div className="stat-icon">⏳</div>
              <div className="stat-number">{stats.listings.pending}</div>
              <div className="stat-label">Pending Review</div>
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">✅</div>
              <div className="stat-number">{stats.listings.available}</div>
              <div className="stat-label">Live Listings</div>
            </div>
            <div className="stat-card stat-blue">
              <div className="stat-icon">🔑</div>
              <div className="stat-number">{stats.listings.sold}</div>
              <div className="stat-label">Sold</div>
            </div>
            <div className="stat-card stat-red">
              <div className="stat-icon">❌</div>
              <div className="stat-number">{stats.listings.rejected}</div>
              <div className="stat-label">Rejected</div>
            </div>
            <div className="stat-card stat-gold">
              <div className="stat-icon">⭐</div>
              <div className="stat-number">{stats.listings.featured}</div>
              <div className="stat-label">Featured</div>
            </div>
            <div className="stat-card stat-muted">
              <div className="stat-icon">🚗</div>
              <div className="stat-number">{stats.listings.total}</div>
              <div className="stat-label">Total Listings</div>
            </div>
          </div>

          <div className="stats-section-label">Engagement</div>
          <div className="stats-grid">
            <div className="stat-card stat-pink">
              <div className="stat-icon">❤️</div>
              <div className="stat-number">{stats.engagement.favorites}</div>
              <div className="stat-label">Total Favorites</div>
            </div>
            <div className="stat-card stat-teal">
              <div className="stat-icon">💬</div>
              <div className="stat-number">{stats.engagement.messages}</div>
              <div className="stat-label">Messages Sent</div>
            </div>
            <div className="stat-card stat-red">
              <div className="stat-icon">⚠️</div>
              <div className="stat-number">{stats.reports.pending}</div>
              <div className="stat-label">Pending Reports</div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderPending = () => (
    <div>
      <h2>Pending Listings ({pendingCars.length})</h2>
      <p className="admin-hint">Review and approve or reject submitted car listings.</p>
      {loading ? (
        <p className="loading-msg">Loading...</p>
      ) : pendingCars.length === 0 ? (
        <div className="empty-state">✅ No pending listings to review!</div>
      ) : (
        <div className="admin-cards">
          {pendingCars.map(car => (
            <div key={car.id} className="admin-listing-card">
              <div className="card-img">
                {car.images && car.images.length > 0 && !brokenImages.has(car.id)
                  ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(car.id)} />
                  : <div className="no-img">🚗</div>
                }
              </div>
              <div className="card-info">
                <h3>{car.year} {car.make} {car.model}</h3>
                <p className="card-price">GH₵{Number(car.price).toLocaleString()}</p>
                <p className="card-meta">📍 {car.location} &nbsp;|&nbsp; {car.condition.replace(/_/g, ' ')}</p>
                <p className="card-seller">Seller: <strong>{car.seller?.user?.name}</strong> ({car.seller?.user?.email})</p>
                <p className="card-date">Submitted: {new Date(car.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="card-actions">
                <button className="approve-btn" onClick={() => handleListingAction(car.id, 'AVAILABLE')}>✅ Approve</button>
                <button className="reject-btn" onClick={() => handleListingAction(car.id, 'REJECTED')}>❌ Reject</button>
                <button className="view-btn" onClick={() => navigate(`/car/${car.id}`)}>👁 View</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAllListings = () => (
    <div>
      <h2>All Live Listings ({allCars.length})</h2>
      <p className="admin-hint">Promote listings to the homepage by starring them as Featured.</p>
      {loading ? (
        <p className="loading-msg">Loading...</p>
      ) : allCars.length === 0 ? (
        <div className="empty-state">No live listings yet.</div>
      ) : (
        <div className="admin-cards">
          {allCars.map(car => (
            <div key={car.id} className={`admin-listing-card ${car.featured ? 'is-featured' : ''}`}>
              <div className="card-img">
                {car.images && car.images.length > 0 && !brokenImages.has(`all-${car.id}`)
                  ? <img src={getImageUrl(car.images[0].data)} alt={car.make} onError={() => handleImageError(`all-${car.id}`)} />
                  : <div className="no-img">🚗</div>
                }
              </div>
              <div className="card-info">
                <h3>
                  {car.featured && <span className="featured-badge">⭐ Featured</span>}
                  {car.year} {car.make} {car.model}
                </h3>
                <p className="card-price">GH₵{Number(car.price).toLocaleString()}</p>
                <p className="card-meta">📍 {car.location} &nbsp;|&nbsp; {car.condition.replace(/_/g, ' ')}</p>
                <p className="card-seller">Seller: <strong>{car.seller?.user?.name}</strong></p>
              </div>
              <div className="card-actions">
                <button
                  className={car.featured ? 'unfeature-btn' : 'feature-btn'}
                  onClick={() => handleToggleFeatured(car.id, car.featured)}
                >
                  {car.featured ? '★ Unfeature' : '⭐ Feature'}
                </button>
                <button className="view-btn" onClick={() => navigate(`/car/${car.id}`)}>👁 View</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderReports = () => {
    const pendingReports = reports.filter(r => r.status === 'PENDING');
    const resolvedReports = reports.filter(r => r.status === 'RESOLVED');
    return (
      <div>
        <h2>Reports ({reports.length})</h2>
        <p className="admin-hint">Review flagged listings and resolve or dismiss reports.</p>
        {loading ? (
          <p className="loading-msg">Loading...</p>
        ) : reports.length === 0 ? (
          <div className="empty-state">✅ No reports submitted yet.</div>
        ) : (
          <>
            {pendingReports.length > 0 && (
              <>
                <div className="reports-section-header">⚠️ Pending ({pendingReports.length})</div>
                <div className="table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Reporter</th>
                        <th>Vehicle</th>
                        <th>Reason</th>
                        <th>Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReports.map(r => (
                        <tr key={r.id}>
                          <td>{r.reporter?.name}<br /><small style={{color:'var(--color-text-muted)'}}>{r.reporter?.email}</small></td>
                          <td>
                            {r.vehicle
                              ? <Link to={`/car/${r.vehicle.id}`} className="report-car-link">{r.vehicle.year} {r.vehicle.make} {r.vehicle.model}</Link>
                              : <span style={{color:'var(--color-text-muted)'}}>—</span>
                            }
                          </td>
                          <td className="report-reason">{r.reason}</td>
                          <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td>
                            <button className="resolve-btn" onClick={() => handleResolveReport(r.id)}>✅ Resolve</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {resolvedReports.length > 0 && (
              <>
                <div className="reports-section-header resolved-header">✅ Resolved ({resolvedReports.length})</div>
                <div className="table-container">
                  <table className="users-table resolved-table">
                    <thead>
                      <tr>
                        <th>Reporter</th>
                        <th>Vehicle</th>
                        <th>Reason</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedReports.map(r => (
                        <tr key={r.id} className="resolved-row">
                          <td>{r.reporter?.name}</td>
                          <td>
                            {r.vehicle
                              ? <Link to={`/car/${r.vehicle.id}`} className="report-car-link">{r.vehicle.year} {r.vehicle.make} {r.vehicle.model}</Link>
                              : '—'
                            }
                          </td>
                          <td className="report-reason">{r.reason}</td>
                          <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td><span className="resolved-tag">Resolved</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const renderUsers = () => (
    <div>
      <h2>All Users ({users.length})</h2>
      <p className="admin-hint">Manage accounts, verify sellers, remove bad actors.</p>
      {loading ? (
        <p className="loading-msg">Loading...</p>
      ) : (
        <div className="table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Seller Type</th>
                <th>Verified</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td>
                  <td>{u.sellerProfile?.sellerType || '—'}</td>
                  <td>
                    {u.verified
                      ? <span className="verified-yes">🟢 Yes</span>
                      : <span className="verified-no">⚪ No</span>
                    }
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="user-actions">
                    {u.role === 'SELLER' && !u.verified && (
                      <button className="verify-btn" onClick={() => handleVerifySeller(u.id)}>Verify</button>
                    )}
                    {u.role !== 'ADMIN' && (
                      <button className="delete-btn" onClick={() => handleDeleteUser(u.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <h2>⚙️ Admin Panel</h2>
        <nav>
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
            📊 Overview
          </button>
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
            🚗 Pending Listings {pendingCars.length > 0 && `(${pendingCars.length})`}
          </button>
          <button className={tab === 'allListings' ? 'active' : ''} onClick={() => setTab('allListings')}>
            📋 All Listings
          </button>
          <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
            ⚠️ Reports {reports.filter(r => r.status === 'PENDING').length > 0 && `(${reports.filter(r => r.status === 'PENDING').length})`}
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            👤 Manage Users
          </button>
        </nav>
      </div>

      <div className="admin-main">
        {actionMsg && <div className="admin-toast">{actionMsg}</div>}

        {tab === 'overview'    && renderOverview()}
        {tab === 'pending'     && renderPending()}
        {tab === 'allListings' && renderAllListings()}
        {tab === 'reports'     && renderReports()}
        {tab === 'users'       && renderUsers()}
      </div>
    </div>
  );
};

export default AdminDashboard;
