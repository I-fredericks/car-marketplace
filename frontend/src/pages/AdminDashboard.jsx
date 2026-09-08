import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageThumbUrl } from '../utils/api';
import {
  ShieldAlert, LayoutDashboard, Car, List, AlertTriangle, Users,
  Check, X, Eye, Star, ShieldCheck, Trash2, CreditCard, FileText, Camera,
  UserX, UserCheck, RefreshCw, Heart, MessageCircle, ArrowRight, Package
} from 'lucide-react';
import Badge from '../components/Badge';
import Avatar from '../components/Avatar';

const AdminDashboard = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  // Deep links: notifications route admins to the exact moderation tab via
  // /admin?tab=<name> (e.g. /admin?tab=pending, ?tab=photos, ?tab=users...).
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState(() => {
    const VALID = new Set(['overview', 'pending', 'allListings', 'takenDown', 'audit', 'photos', 'payments', 'purchases', 'reports', 'users']);
    const initial = searchParams.get('tab');
    return initial && VALID.has(initial) ? initial : 'overview';
  });
  const setTab = (next) => {
    setTabState(next);
    setSearchParams({ tab: next }, { replace: true });
  };
  const [stats, setStats] = useState(null);
  const [pendingCars, setPendingCars] = useState([]);
  const [allCars, setAllCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deactivatedCars, setDeactivatedCars] = useState([]);
  const [pendingAvatars, setPendingAvatars] = useState([]);
  const [processingAvatar, setProcessingAvatar] = useState(null);
  const [activity, setActivity] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    entityType: '',
    actorId: '',
    from: '',
    to: '',
  });
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toast = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(auditPagination.page));
      params.set('limit', String(auditPagination.limit));
      if (auditFilters.action) params.set('action', auditFilters.action);
      if (auditFilters.entityType) params.set('entityType', auditFilters.entityType);
      if (auditFilters.actorId) params.set('actorId', auditFilters.actorId);
      if (auditFilters.from) params.set('from', auditFilters.from);
      if (auditFilters.to) params.set('to', auditFilters.to);

      const { data } = await api.get(`/admin/audit-logs?${params.toString()}`);
      setAuditLogs(data.logs || []);
      setAuditPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [auditPagination.page, auditPagination.limit, auditFilters]);

  useEffect(() => {
    if (tab === 'audit') {
      fetchAuditLogs();
    }
  }, [tab, fetchAuditLogs]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const [{ data: statsData }, { data: auditsData }, { data: purchasesData }, { data: paymentsData }] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/audit-logs?limit=8'),
          api.get('/admin/purchases'),
          api.get('/admin/payments'),
        ]);
        setStats(statsData);
        setActivity(auditsData.logs || []);
        setPurchases(purchasesData);
        setPayments(paymentsData);
      } else if (tab === 'pending') {
        const { data } = await api.get('/admin/vehicles/pending');
        setPendingCars(data);
      } else if (tab === 'allListings') {
        const { data } = await api.get('/admin/vehicles/all');
        setAllCars(data);
      } else if (tab === 'takenDown') {
        const { data } = await api.get('/admin/vehicles/all?status=DEACTIVATED');
        setDeactivatedCars(data);
      } else if (tab === 'photos') {
        const { data } = await api.get('/admin/avatars/pending');
        setPendingAvatars(data);
      } else if (tab === 'reports') {
        const { data } = await api.get('/admin/reports');
        setReports(data);
      } else if (tab === 'users') {
        const { data } = await api.get('/admin/users');
        setUsers(data);
      } else if (tab === 'payments') {
        const { data } = await api.get('/admin/payments');
        setPayments(data);
      } else if (tab === 'purchases') {
        const { data } = await api.get('/admin/purchases');
        setPurchases(data);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
        <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
      </div>
    );
  }

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
      if (status === 'AVAILABLE') {
        toast('Listing restored ✅');
      } else if (status === 'DEACTIVATED') {
        toast('Listing taken down. Seller notified to contact admin.');
      } else {
        toast(`Listing ${status === 'AVAILABLE' ? 'approved ✅' : 'rejected ❌'}`);
      }
      setPendingCars(prev => prev.filter(c => c.id !== id));
      setAllCars(prev => prev.map(c => c.id === id ? { ...c, status, featured: false } : c));
      setDeactivatedCars(prev => prev.map(c => c.id === id ? { ...c, status, featured: false } : c));
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

  const handleAvatarAction = async (userId, action) => {
    let reason;
    if (action === 'REJECTED') {
      reason = window.prompt('Reason for rejection (optional, shown to the user):') || '';
    }
    setProcessingAvatar(userId);
    try {
      await api.put(`/admin/users/${userId}/avatar/${action === 'APPROVED' ? 'approve' : 'reject'}`, { reason });
      setPendingAvatars(prev => prev.filter(u => u.id !== userId));
      toast(action === 'APPROVED' ? 'Profile photo approved ✅' : 'Profile photo rejected. User notified.');
    } catch (err) {
      toast(err.response?.data?.message || 'Action failed.');
    } finally {
      setProcessingAvatar(null);
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

  const handleToggleUserStatus = async (u) => {
    try {
      const { data } = await api.put(`/admin/users/${u.id}/status`, { isActive: !u.isActive });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
      toast(data.message || (!u.isActive ? 'Account reactivated.' : 'Account deactivated.'));
    } catch (err) {
      toast(err.response?.data?.message || 'Status change failed.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure? This will permanently delete the user.')) return;
    try {
      const { data } = await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast(data.message || 'User deleted.');
    } catch (err) {
      // Server guards self-deletion and admin deletion with explicit 400/403
      // messages — surface them instead of a vague "failed".
      toast(err.response?.data?.message || 'Delete failed.');
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

  const handleReleasePayout = async (id) => {
    const payoutRef = window.prompt('Payout reference (transfer ID / receipt no.):', '');
    if (payoutRef === null) return; // cancelled
    try {
      const { data } = await api.put(`/admin/purchases/${id}/release-payout`, { payoutRef: payoutRef || undefined });
      toast(data.message || 'Payout marked sent ✅');
      setPurchases(prev => prev.map(p => p.id === id ? { ...p, payoutStatus: 'SENT', payoutRef: data.purchase.payoutRef } : p));
    } catch (err) {
      toast(err.response?.data?.message || 'Release failed.');
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

  const renderAuditLogs = () => {
    const updateFilter = (key, value) => {
      setAuditFilters(prev => ({ ...prev, [key]: value }));
      setAuditPagination(prev => ({ ...prev, page: 1 }));
    };

    const actionColor = (action) => {
      if (action.startsWith('LISTING')) return 'text-primary';
      if (action.startsWith('USER')) return 'text-accent';
      if (action.startsWith('PAYMENT')) return 'text-success';
      if (action.startsWith('REPORT')) return 'text-[#EAB308]';
      return 'text-textsecondary';
    };

    const formatMeta = (meta) => {
      if (!meta) return '—';
      if (typeof meta === 'string') return meta;
      const entries = Object.entries(meta);
      return entries.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ');
    };

    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Audit Log</h2>
          <p className="text-sm text-textsecondary">Full moderation trail across listings, users, payments, and reports.</p>
        </div>

        <div className="bg-surface border border-bordercol rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Filter action (e.g. LISTING.)"
              value={auditFilters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              className="px-3 py-2 bg-bg border border-bordercol rounded text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Entity type (e.g. VEHICLE)"
              value={auditFilters.entityType}
              onChange={(e) => updateFilter('entityType', e.target.value)}
              className="px-3 py-2 bg-bg border border-bordercol rounded text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Actor ID"
              value={auditFilters.actorId}
              onChange={(e) => updateFilter('actorId', e.target.value)}
              className="px-3 py-2 bg-bg border border-bordercol rounded text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              type="date"
              value={auditFilters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
              className="px-3 py-2 bg-bg border border-bordercol rounded text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <input
              type="date"
              value={auditFilters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
              className="px-3 py-2 bg-bg border border-bordercol rounded text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-textmuted">
              {auditPagination.total > 0
                ? `${auditPagination.total} records`
                : 'No records'}
            </p>
            <button
              onClick={fetchAuditLogs}
              className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary hover:text-white transition-colors text-xs font-bold"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
            <FileText size={48} className="mx-auto text-bordercol mb-4" />
            <p>No audit logs match your filters.</p>
          </div>
        ) : (
          <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
                <tr>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Entity</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordercol">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-6 py-4 text-textsecondary whitespace-nowrap">
                      <div className="font-medium text-textprimary">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-textprimary">{log.actorName || `User #${log.actorId}`}</div>
                      <div className="text-[10px] text-textmuted uppercase tracking-wide">{log.actorRole || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-xs ${actionColor(log.action)}`}>{log.action}</span>
                    </td>
                    <td className="px-6 py-4 text-textsecondary">
                      {log.entityType}#{log.entityId ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-textmuted text-xs max-w-[260px] truncate" title={typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta)}>
                      {formatMeta(log.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {auditPagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAuditPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={auditPagination.page <= 1}
              className="px-4 py-2 bg-surface border border-bordercol rounded text-sm font-medium hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-textmuted">
              Page {auditPagination.page} of {auditPagination.totalPages}
            </span>
            <button
              onClick={() => setAuditPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={auditPagination.page >= auditPagination.totalPages}
              className="px-4 py-2 bg-surface border border-bordercol rounded text-sm font-medium hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────────────────────────────────────
  // SUB-RENDERS
  // ──────────────────────────────────────────────────────

  const renderOverview = () => {
    const kpis = stats ? [
      { label: 'Total Users', value: stats.users.total, Icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
      { label: 'Sellers', value: stats.users.sellers, Icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
      { label: 'Buyers', value: stats.users.buyers, Icon: Car, color: 'text-accent', bg: 'bg-accent/10' },
      { label: 'Live Listings', value: stats.listings.available, Icon: List, color: 'text-primary', bg: 'bg-primary/10' },
    ] : [];

    const statusSegments = stats ? [
      { key: 'available', label: 'Live', value: stats.listings.available, color: 'bg-success' },
      { key: 'pending', label: 'Pending', value: stats.listings.pending, color: 'bg-[#EAB308]' },
      { key: 'reserved', label: 'Reserved', value: stats.listings.reserved || 0, color: 'bg-accent' },
      { key: 'sold', label: 'Sold', value: stats.listings.sold, color: 'bg-primary' },
      { key: 'rejected', label: 'Rejected', value: stats.listings.rejected, color: 'bg-err' },
      { key: 'deactivated', label: 'Taken down', value: stats.listings.deactivated, color: 'bg-orange-500' },
      { key: 'removed', label: 'Removed', value: stats.listings.removed, color: 'bg-textmuted' },
    ] : [];
    const statusTotal = statusSegments.reduce((sum, s) => sum + (s.value || 0), 0) || 1;

    const quickActions = stats ? [
      { label: 'Review pending listings', tab: 'pending', count: stats.listings.pending, accent: stats.listings.pending > 0 },
      { label: 'Pending payments', tab: 'payments', count: payments.filter(p => p.status === 'PENDING').length, accent: payments.filter(p => p.status === 'PENDING').length > 0 },
      { label: 'Payouts to release', tab: 'purchases', count: purchases.filter(p => p.payoutStatus === 'PENDING').length, accent: purchases.filter(p => p.payoutStatus === 'PENDING').length > 0 },
      { label: 'Open reports', tab: 'reports', count: (stats.reports?.pending ?? reports.length), accent: (stats.reports?.pending ?? 0) > 0 },
      { label: 'Manage users', tab: 'users', count: stats.users.total, accent: false },
      { label: 'Audit log', tab: 'audit', count: null, accent: false },
    ] : [];

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Marketplace Overview</h2>
            <p className="text-sm text-textsecondary">Live stats across all users, listings, and activity.</p>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-surface border border-bordercol rounded-md text-xs font-medium text-textsecondary hover:bg-bg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI tiles */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {kpis.map(({ label, value, Icon, color, bg }) => (
                <div key={label} className="bg-surface border border-bordercol rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group">
                  <div className={`w-10 h-10 ${bg} ${color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <Icon size={20} />
                  </div>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-textprimary tracking-tight">{value}</div>
                  <div className="text-xs sm:text-sm text-textsecondary font-medium mt-0.5">{label}</div>
                </div>
              ))}
            </section>

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Listing status distribution */}
              <section className="bg-surface border border-bordercol rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="font-display font-semibold text-textprimary mb-4">Listing distribution</h3>
                <div className="h-3 rounded-full overflow-hidden flex bg-bg mb-4">
                  {statusSegments.map(seg => seg.value > 0 && (
                    <div key={seg.key} className={`${seg.color} transition-all`} style={{ width: `${(seg.value / statusTotal) * 100}%` }} title={`${seg.label}: ${seg.value}`} />
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {statusSegments.map(seg => (
                    <div key={seg.key} className="flex items-center gap-2 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
                      <span className="text-textsecondary">{seg.label}</span>
                      <span className="font-bold text-textprimary ml-auto">{seg.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Engagement */}
              <section className="bg-surface border border-bordercol rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="font-display font-semibold text-textprimary mb-4">Engagement</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-bg border border-bordercol/60 p-4">
                    <Heart size={18} className="text-err mb-2" />
                    <div className="text-xl font-display font-bold text-textprimary">{stats.favorites}</div>
                    <div className="text-[11px] text-textmuted uppercase font-medium">Saved by buyers</div>
                  </div>
                  <div className="rounded-lg bg-bg border border-bordercol/60 p-4">
                    <MessageCircle size={18} className="text-primary mb-2" />
                    <div className="text-xl font-display font-bold text-textprimary">{stats.messages}</div>
                    <div className="text-[11px] text-textmuted uppercase font-medium">Messages</div>
                  </div>
                  <div className="rounded-lg bg-bg border border-bordercol/60 p-4">
                    <Star size={18} className="text-[#EAB308] mb-2" />
                    <div className="text-xl font-display font-bold text-textprimary">{stats.listings.featured ?? 0}</div>
                    <div className="text-[11px] text-textmuted uppercase font-medium">Featured</div>
                  </div>
                  <div className="rounded-lg bg-bg border border-bordercol/60 p-4">
                    <ShieldAlert size={18} className="text-err mb-2" />
                    <div className="text-xl font-display font-bold text-textprimary">{stats.reports?.pending ?? 0}</div>
                    <div className="text-[11px] text-textmuted uppercase font-medium">Reports pending</div>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Quick actions */}
              <section className="bg-surface border border-bordercol rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="font-display font-semibold text-textprimary mb-4">Quick actions</h3>
                <div className="space-y-2">
                  {quickActions.map(({ label, tab, count, accent }) => (
                    <button
                      key={tab + label}
                      onClick={() => setTab(tab)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-bordercol hover:border-primary/40 hover:bg-bg transition-colors text-left group"
                    >
                      <span className="text-sm font-medium text-textprimary">{label}</span>
                      <span className="flex items-center gap-2">
                        {count != null && (
                          <span className={`min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full text-[11px] font-bold ${accent ? 'bg-[#EAB308]/15 text-[#EAB308]' : 'bg-bg border border-bordercol text-textmuted'}`}>
                            {count}
                          </span>
                        )}
                        <ArrowRight size={14} className="text-textmuted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Recent activity */}
              <section className="bg-surface border border-bordercol rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="font-display font-semibold text-textprimary mb-4">Recent activity</h3>
                {activity.length === 0 ? (
                  <p className="text-sm text-textmuted py-6 text-center">No activity yet.</p>
                ) : (
                  <div className="divide-y divide-bordercol/60 max-h-[300px] overflow-y-auto -mx-1">
                    {activity.map(log => (
                      <div key={log.id} className="px-1 py-2.5 flex items-center gap-3">
                        <Avatar name={log.actorName || 'System'} userId={log.actorId} size={28} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-textprimary truncate">
                            <span className="font-medium">{log.actorName || 'System'}</span>
                            <span className="text-textmuted"> · {log.action.replace('.', ' ').toLowerCase()}</span>
                          </p>
                          <p className="text-[11px] text-textmuted truncate">{log.entityType}#{log.entityId ?? '—'}</p>
                        </div>
                        <span className="text-[10px] text-textmuted whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setTab('audit')} className="mt-3 text-xs font-medium text-primary hover:text-primarylight transition-colors">
                  View full audit log →
                </button>
              </section>
            </div>
          </div>
        )}
      </div>
    );
  };

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
                    ? <img src={getImageThumbUrl(car.images[0])} alt={car.make} loading="lazy" decoding="async" onError={() => handleImageError(car.id)} className="w-full h-full object-cover" />
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
                          <img src={getImageThumbUrl(car.images[0])} alt={car.make} loading="lazy" decoding="async" onError={() => handleImageError(`all-${car.id}`)} className="w-full h-full object-cover" />
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
                      {car.status === 'AVAILABLE' && (
                        <button
                          onClick={() => handleListingAction(car.id, 'DEACTIVATED')}
                          className="px-3 py-1.5 bg-err/10 text-err border border-err/20 rounded hover:bg-err hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                        >
                          <AlertTriangle size={14} /> Take Down
                        </button>
                      )}
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

  const renderTakenDown = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Taken Down Listings ({deactivatedCars.length})</h2>
        <p className="text-sm text-textsecondary">Listings removed by admin. You can restore them if the issue is resolved.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : deactivatedCars.length === 0 ? (
        <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
          <Check size={48} className="mx-auto text-success/50 mb-4" />
          <p>No taken down listings.</p>
        </div>
      ) : (
        <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg border-b border border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Seller</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordercol">
              {deactivatedCars.map(car => (
                <tr key={car.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-10 bg-bg border border-bordercol rounded overflow-hidden flex-shrink-0">
                        {car.images && car.images.length > 0 && !brokenImages.has(`taken-${car.id}`) ? (
                          <img src={getImageThumbUrl(car.images[0])} alt={car.make} loading="lazy" decoding="async" onError={() => handleImageError(`taken-${car.id}`)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Car size={16} className="text-textmuted" /></div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-textprimary">{car.year} {car.make} {car.model}</h4>
                        <p className="text-xs text-textsecondary mt-0.5">{car.location}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-textprimary">GH₵{Number(car.price).toLocaleString()}</td>
                  <td className="px-6 py-4 text-textsecondary">{car.seller?.user?.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleListingAction(car.id, 'AVAILABLE')}
                        className="px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                      >
                        <Check size={14} /> Restore
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

  const renderPhotoReview = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">Profile Photo Review ({pendingAvatars.length})</h2>
        <p className="text-sm text-textsecondary">Approve or reject user-uploaded profile photos. Users are notified of the outcome.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-textmuted">
          <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
        </div>
      ) : pendingAvatars.length === 0 ? (
        <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
          <Camera size={48} className="mx-auto text-bordercol mb-4" />
          <p>No profile photos awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingAvatars.map(u => (
            <div key={u.id} className="bg-surface border border-bordercol rounded-lg shadow-sm p-5 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-bg border border-bordercol flex items-center justify-center mb-3">
                <img
                  src={`/api/users/${u.id}/avatar?v=${encodeURIComponent(u.updatedAt || '')}`}
                  alt={`${u.name}'s profile photo`}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="font-medium text-textprimary">{u.name}</h4>
              <p className="text-xs text-textmuted truncate max-w-full">{u.email}</p>
              <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-bg border border-bordercol text-textsecondary">
                {u.role.toLowerCase()}
              </span>
              <p className="text-[11px] text-textmuted mt-2">
                Uploaded {new Date(u.updatedAt).toLocaleString()}
              </p>
              <div className="flex gap-2 mt-4 w-full">
                <button
                  onClick={() => handleAvatarAction(u.id, 'APPROVED')}
                  disabled={processingAvatar === u.id}
                  className="flex-1 px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  onClick={() => handleAvatarAction(u.id, 'REJECTED')}
                  disabled={processingAvatar === u.id}
                  className="flex-1 px-3 py-1.5 bg-err/10 text-err border border-err/20 rounded hover:bg-err hover:text-white transition-colors text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
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

  const visibleUsers = users.filter(u => !/^deleted-\d+@deleted\./.test(u.email)); // scrubbed accounts stay in the DB for audit but don't belong in the management UI
  const renderUsers = () => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-textprimary mb-1">All Users ({visibleUsers.length})</h2>
        <p className="text-sm text-textsecondary">
          Manage accounts, verify sellers, remove bad actors.
          {users.length - visibleUsers.length > 0 && ` ${users.length - visibleUsers.length} deleted account(s) hidden.`}
        </p>
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
              {visibleUsers.map(u => (
                <tr key={u.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar userId={u.id} name={u.name} size={36} />
                      <div>
                        <div className="font-medium text-textprimary">{u.name}</div>
                        <div className="text-xs text-textmuted">{u.email}</div>
                      </div>
                    </div>
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
                    <div className="flex gap-2 items-center">
                      {!u.isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-bg border border-bordercol text-textmuted">
                          Deactivated
                        </span>
                      )}
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
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2.5 py-1.5 rounded-md border transition-colors text-xs font-bold flex items-center gap-1 ${
                            u.isActive
                              ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/20 hover:bg-[#EAB308] hover:text-white'
                              : 'bg-success/10 text-success border-success/20 hover:bg-success hover:text-white'
                          }`}
                          title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                        >
                          {u.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                          <span className="hidden md:inline">{u.isActive ? 'Deactivate' : 'Reactivate'}</span>
                        </button>
                      )}
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="px-2.5 py-1.5 bg-err/10 text-err border border-err/20 rounded-md hover:bg-err hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                          <span className="hidden md:inline">Delete</span>
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

  const renderPurchases = () => {
    const STATUS = {
      AWAITING_PAYMENT: <Badge type="accent">Awaiting payment</Badge>,
      PAID_HELD: <Badge type="neutral">Paid (escrow)</Badge>,
      HANDOVER_PENDING: <Badge type="neutral">Handover pending</Badge>,
      DELIVERED: <Badge type="neutral">Delivered</Badge>,
      COMPLETED: <Badge type="success">Completed</Badge>,
      CANCELLED: <Badge type="err">Cancelled</Badge>,
      REFUNDED: <Badge type="err">Refunded</Badge>,
    };
    const PAYOUT = {
      NONE: <span className="text-textmuted">—</span>,
      PENDING: <Badge type="accent">Payout pending</Badge>,
      SENT: <Badge type="success">Payout sent</Badge>,
    };
    const awaitingPayout = purchases.filter(p => p.payoutStatus === 'PENDING');
    const rest = purchases.filter(p => p.payoutStatus !== 'PENDING');

    const row = (p, withAction = false) => (
      <tr key={p.id} className="hover:bg-bg/50 transition-colors">
        <td className="px-6 py-4 font-medium text-textprimary">{p.reference}</td>
        <td className="px-6 py-4 text-textsecondary">{p.buyer?.name}</td>
        <td className="px-6 py-4 text-textsecondary">{p.seller?.user?.name}</td>
        <td className="px-6 py-4 text-textsecondary">{p.vehicle ? `${p.vehicle.year} ${p.vehicle.make} ${p.vehicle.model}` : '—'}</td>
        <td className="px-6 py-4 font-medium text-textprimary">GH₵{Number(p.amount / 100).toLocaleString()}</td>
        <td className="px-6 py-4 text-textsecondary">{p.method}</td>
        <td className="px-6 py-4">{STATUS[p.status] || p.status}</td>
        <td className="px-6 py-4">
          {PAYOUT[p.payoutStatus] || p.payoutStatus}
          {p.payoutRef && <div className="text-xs text-textmuted mt-1">ref {p.payoutRef}</div>}
        </td>
        <td className="px-6 py-4 text-textsecondary">{new Date(p.createdAt).toLocaleDateString()}</td>
        {withAction && (
          <td className="px-6 py-4">
            {p.payoutStatus === 'PENDING' && (
              <button
                onClick={() => handleReleasePayout(p.id)}
                className="px-3 py-2 bg-success/10 text-success border border-success/20 rounded hover:bg-success hover:text-white transition-colors text-xs font-bold whitespace-nowrap"
              >
                Mark payout sent
              </button>
            )}
          </td>
        )}
      </tr>
    );

    const tableHead = (withAction = false) => (
      <thead className="bg-bg border-b border-bordercol text-textsecondary uppercase tracking-wider font-semibold text-xs">
        <tr>
          <th className="px-6 py-4">Reference</th>
          <th className="px-6 py-4">Buyer</th>
          <th className="px-6 py-4">Seller</th>
          <th className="px-6 py-4">Vehicle</th>
          <th className="px-6 py-4">Amount</th>
          <th className="px-6 py-4">Method</th>
          <th className="px-6 py-4">Status</th>
          <th className="px-6 py-4">Payout</th>
          <th className="px-6 py-4">Date</th>
          {withAction && <th className="px-6 py-4">Action</th>}
        </tr>
      </thead>
    );

    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="font-display font-bold text-2xl text-textprimary mb-1">
            Purchases {awaitingPayout.length > 0 && <span className="text-err">({awaitingPayout.length} awaiting payout)</span>}
          </h2>
          <p className="text-sm text-textsecondary">
            Escrow orders: transfers release once you mark the payout sent (buyer keeps the car).
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
          </div>
        ) : purchases.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-12 text-center text-textsecondary">
            <Package size={48} className="mx-auto text-bordercol mb-4" />
            <p>No purchases yet. Escrowed checkouts will queue here once a buyer pays.</p>
          </div>
        ) : (
          <>
            {awaitingPayout.length > 0 && (
              <div>
                <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-3">Awaiting payout release</h3>
                <div className="bg-surface border border-accent/40 rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    {tableHead(true)}
                    <tbody className="divide-y divide-bordercol">
                      {awaitingPayout.map(p => row(p, true))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <div>
                <h3 className="font-medium text-textsecondary uppercase tracking-wider text-xs mb-3">
                  {awaitingPayout.length > 0 ? 'All orders' : 'Orders'}
                </h3>
                <div className="bg-surface border border-bordercol rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    {tableHead(false)}
                    <tbody className="divide-y divide-bordercol">
                      {rest.map(p => row(p))}
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
    { id: 'takenDown', icon: <AlertTriangle size={18} />, label: `Taken Down ${deactivatedCars.length > 0 ? `(${deactivatedCars.length})` : ''}` },
    { id: 'audit', icon: <FileText size={18} />, label: 'Audit Log' },
    { id: 'photos', icon: <Camera size={18} />, label: `Photos ${pendingAvatars.length > 0 ? `(${pendingAvatars.length})` : ''}` },
    { id: 'payments', icon: <CreditCard size={18} />, label: `Payments ${payments.filter(p => p.status === 'PENDING').length > 0 ? `(${payments.filter(p => p.status === 'PENDING').length})` : ''}` },
    { id: 'purchases', icon: <Package size={18} />, label: `Purchases ${purchases.filter(p => p.payoutStatus === 'PENDING').length > 0 ? `(${purchases.filter(p => p.payoutStatus === 'PENDING').length})` : ''}` },
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
            {tab === 'takenDown'   && renderTakenDown()}
            {tab === 'audit'       && renderAuditLogs()}
            {tab === 'photos'      && renderPhotoReview()}
            {tab === 'payments'    && renderPayments()}
            {tab === 'purchases'   && renderPurchases()}
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
