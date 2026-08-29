import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('listings');
  const [pendingCars, setPendingCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Guard — redirect non-admins
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="admin-guard">
        <h2>🚫 Access Denied</h2>
        <p>You need an admin account to view this page.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'listings') {
        const { data } = await api.get('/admin/vehicles/pending');
        setPendingCars(data);
      } else if (tab === 'users') {
        const { data } = await api.get('/admin/users');
        setUsers(data);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleListingAction = async (id, status) => {
    try {
      await api.put(`/admin/vehicles/${id}/status`, { status });
      setActionMsg(`Listing ${status === 'AVAILABLE' ? 'approved ✅' : 'rejected ❌'}`);
      setPendingCars(prev => prev.filter(c => c.id !== id));
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg('Action failed.');
    }
  };

  const handleVerifySeller = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/verify`);
      setActionMsg('Seller verified 🟢');
      fetchData();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg('Verification failed.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure? This will permanently delete the user.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setActionMsg('User deleted.');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) {
      setActionMsg('Delete failed.');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-sidebar">
        <h2>⚙️ Admin Panel</h2>
        <nav>
          <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>
            🚗 Pending Listings {pendingCars.length > 0 && `(${pendingCars.length})`}
          </button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            👤 Manage Users
          </button>
        </nav>
      </div>

      <div className="admin-main">
        {actionMsg && <div className="admin-toast">{actionMsg}</div>}

        {/* ===== PENDING LISTINGS ===== */}
        {tab === 'listings' && (
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
                      {car.images && car.images.length > 0
                        ? <img src={`http://localhost:5000${car.images[0].url}`} alt={car.make} />
                        : <div className="no-img">🚗</div>
                      }
                    </div>
                    <div className="card-info">
                      <h3>{car.year} {car.make} {car.model}</h3>
                      <p className="card-price">GH₵{Number(car.price).toLocaleString()}</p>
                      <p className="card-meta">📍 {car.location} &nbsp;|&nbsp; {car.condition.replace('_', ' ')}</p>
                      <p className="card-seller">
                        Seller: <strong>{car.seller?.user?.name}</strong> ({car.seller?.user?.email})
                      </p>
                      <p className="card-date">Submitted: {new Date(car.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="card-actions">
                      <button
                        className="approve-btn"
                        onClick={() => handleListingAction(car.id, 'AVAILABLE')}
                      >✅ Approve</button>
                      <button
                        className="reject-btn"
                        onClick={() => handleListingAction(car.id, 'REJECTED')}
                      >❌ Reject</button>
                      <button
                        className="view-btn"
                        onClick={() => navigate(`/car/${car.id}`)}
                      >👁 View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== USERS ===== */}
        {tab === 'users' && (
          <div>
            <h2>All Users ({users.length})</h2>
            <p className="admin-hint">Manage accounts, verify sellers, remove bad actors.</p>

            {loading ? (
              <p className="loading-msg">Loading...</p>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
