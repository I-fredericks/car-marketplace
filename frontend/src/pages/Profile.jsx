import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import { User, ShieldCheck, Edit2, Save, X, Store, Building2, ArrowRight, Camera, Clock, CheckCircle, XCircle, KeyRound, Wallet } from 'lucide-react';

const SELLER_TYPES = [
  { value: 'PRIVATE', label: 'Private Seller', Icon: User },
  { value: 'DEALER', label: 'Car Dealer', Icon: Store },
  { value: 'COMPANY', label: 'Company', Icon: Building2 },
];

const Profile = () => {
  const { user, loading: authLoading, setUser } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarInputRef = useRef(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    location: '',
    sellerType: 'PRIVATE',
    payoutMethod: '',
    payoutAccount: '',
    payoutName: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        whatsapp: user.sellerProfile?.whatsapp || '',
        location: user.sellerProfile?.location || '',
        sellerType: user.sellerProfile?.sellerType || 'PRIVATE',
        payoutMethod: user.sellerProfile?.payoutMethod || '',
        payoutAccount: user.sellerProfile?.payoutAccount || '',
        payoutName: user.sellerProfile?.payoutName || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
      };
      if (user.role === 'SELLER') {
        payload.whatsapp = form.whatsapp;
        payload.location = form.location;
        payload.sellerType = form.sellerType;
        payload.payoutMethod = form.payoutMethod || undefined;
        payload.payoutAccount = form.payoutAccount;
        payload.payoutName = form.payoutName;
      }
      const { data } = await api.put('/auth/profile', payload);
      setUser(data.user);
      if (data.sellerProfile && user.role === 'SELLER') {
        setUser(prev => ({ ...prev, sellerProfile: data.sellerProfile }));
      }
      setSuccess('Profile updated successfully');
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError('');
    setSuccess('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Refresh the profile so avatarStatus/updatedAt come from the server
      const { data: profile } = await api.get('/auth/me');
      setAvatarFailed(false);
      setUser(profile);
      setSuccess(data.message || 'Profile photo uploaded — awaiting admin review.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return setPwError('New passwords do not match.');
    }
    if (pwForm.newPassword.length < 6) {
      return setPwError('New password must be at least 6 characters.');
    }
    setPwSaving(true);
    try {
      const { data } = await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess(data.message || 'Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg mt-16">
        <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <User size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Login Required</h2>
          <p className="text-textsecondary mb-8">Please log in to view your profile.</p>
          <Link to="/login" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const isSeller = user.role === 'SELLER';
  const hasAvatar = user.avatarStatus && user.avatarStatus !== 'NONE' && !avatarFailed;

  const avatarStatusBadge = (() => {
    if (user.avatarStatus === 'PENDING') {
      return (
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/20">
          <Clock size={11} /> Photo awaiting admin review
        </span>
      );
    }
    if (user.avatarStatus === 'APPROVED') {
      return (
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/10 text-success border border-success/20">
          <CheckCircle size={11} /> Photo approved
        </span>
      );
    }
    if (user.avatarStatus === 'REJECTED') {
      return (
        <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-err/10 text-err border border-err/20">
          <XCircle size={11} /> Photo rejected
        </span>
      );
    }
    return null;
  })();

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-bordercol flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary overflow-hidden border border-bordercol">
                  {hasAvatar ? (
                    <img
                      key={user.updatedAt}
                      src={`/api/users/${user.id}/avatar?v=${encodeURIComponent(user.updatedAt || '')}`}
                      alt={`${user.name}'s profile`}
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={36} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title={hasAvatar ? 'Replace photo' : 'Upload photo'}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primarylight transition-colors disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Camera size={15} />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl text-textprimary">{user.name}</h1>
                <p className="text-sm text-textsecondary capitalize">{user.role.toLowerCase()} Account</p>
                {avatarStatusBadge}
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 border border-bordercol rounded-md text-sm font-medium hover:bg-bg transition-colors flex items-center gap-2"
              >
                <Edit2 size={16} /> Edit Profile
              </button>
            )}
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-6 p-4 bg-success/10 border border-success/20 rounded-md text-success text-sm font-medium">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            {/* Profile Photo review info */}
            <section>
              <h2 className="font-display font-semibold text-lg text-textprimary mb-4 flex items-center gap-2">
                <Camera size={18} /> Profile Photo
              </h2>
              {user.avatarStatus === 'REJECTED' && (
                <div className="mb-4 p-4 bg-err/10 border border-err/20 rounded-md text-sm">
                  <p className="text-err font-medium flex items-center gap-2">
                    <XCircle size={14} /> Your photo was rejected by admin
                  </p>
                  {user.avatarRejectionReason && (
                    <p className="text-textsecondary mt-1">Reason: {user.avatarRejectionReason}</p>
                  )}
                  <p className="text-textmuted mt-1">Upload a different photo to submit it for review again.</p>
                </div>
              )}
              {user.avatarStatus === 'PENDING' && (
                <div className="mb-4 p-4 bg-[#EAB308]/10 border border-[#EAB308]/20 rounded-md text-sm text-textsecondary flex items-center gap-2">
                  <Clock size={14} className="text-[#EAB308] flex-shrink-0" />
                  Your photo is awaiting admin review. It will appear on your profile once approved.
                </div>
              )}
              {user.avatarStatus !== 'PENDING' && (
                <p className="text-sm text-textsecondary">
                  {hasAvatar
                    ? 'Your photo is visible on your profile. Use the camera button to replace it — replacements are reviewed again by admin.'
                    : 'Upload a profile photo with the camera button above. Photos are reviewed by admin before they appear publicly.'}
                </p>
              )}
            </section>

            {/* Account Info */}
            <section>
              <h2 className="font-display font-semibold text-lg text-textprimary mb-4">Account Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textsecondary">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={!editing}
                    className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textsecondary">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm text-textmuted cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textsecondary">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    disabled={!editing}
                    placeholder="e.g. 024XXXXXXX"
                    className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textsecondary">Role</label>
                  <div className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm flex items-center capitalize text-textmuted">
                    {user.role.toLowerCase()}
                  </div>
                </div>
              </div>
            </section>

            {/* Seller Info */}
            {isSeller && (
              <section>
                <h2 className="font-display font-semibold text-lg text-textprimary mb-4 flex items-center gap-2">
                  <Store size={18} /> Seller Profile
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">Seller Type</label>
                    <div className="flex gap-2">
                      {SELLER_TYPES.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!editing}
                          onClick={() => setForm({ ...form, sellerType: value })}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-md border-2 text-center transition-colors ${
                            form.sellerType === value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-bordercol bg-bg text-textsecondary hover:bg-bg/50'
                          } ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <Icon size={18} />
                          <span className="text-xs font-semibold">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">WhatsApp Number</label>
                    <input
                      type="tel"
                      name="whatsapp"
                      value={form.whatsapp}
                      onChange={handleChange}
                      disabled={!editing}
                      placeholder="e.g. 024XXXXXXX"
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium text-textsecondary">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      disabled={!editing}
                      placeholder="e.g. Accra, Kumasi"
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                </div>
                {user.sellerProfile?.verified && (
                  <div className="mt-4 flex items-center gap-2 text-success text-sm font-medium">
                    <ShieldCheck size={16} /> Verified Seller
                  </div>
                )}
              </section>
            )}

            {/* Payout method — where escrowed sale money is sent */}
            {isSeller && (
              <section className="bg-surface border border-bordercol rounded-lg p-6">
                <h2 className="font-display font-semibold text-lg text-textprimary mb-1 flex items-center gap-2">
                  <Wallet size={18} className="text-primary" /> Payout Account
                </h2>
                <p className="text-sm text-textsecondary mb-5">
                  When a buyer pays through the site, CarMarket holds the money and sends your sale proceeds here after delivery is confirmed (minus the platform fee).
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium text-textsecondary">Method</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'MOMO_MTN', label: 'MTN MoMo' },
                        { value: 'MOMO_TELECEL', label: 'Telecel Cash' },
                        { value: 'MOMO_AIRTELTIGO', label: 'AirtelTigo Money' },
                        { value: 'BANK', label: 'Bank account' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!editing}
                          onClick={() => setForm({ ...form, payoutMethod: value })}
                          className={`px-4 py-2 rounded-md border-2 text-sm font-semibold transition-colors ${
                            form.payoutMethod === value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-bordercol bg-bg text-textsecondary hover:bg-bg/50'
                          } ${!editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">
                      {form.payoutMethod === 'BANK' ? 'Account number' : 'Wallet number'}
                    </label>
                    <input
                      type="text"
                      name="payoutAccount"
                      value={form.payoutAccount}
                      onChange={handleChange}
                      disabled={!editing}
                      placeholder={form.payoutMethod === 'BANK' ? 'e.g. 0201234567890' : 'e.g. 024XXXXXXX'}
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">Registered name</label>
                    <input
                      type="text"
                      name="payoutName"
                      value={form.payoutName}
                      onChange={handleChange}
                      disabled={!editing}
                      placeholder="Name on the wallet / account"
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>
                </div>
                {form.payoutAccount && (
                  <p className="mt-3 text-xs text-success flex items-center gap-1"><ShieldCheck size={14} /> Payout account saved — you'll get paid here automatically on sales.</p>
                )}
              </section>
            )}

            {/* Become a Seller CTA for buyers */}
            {!isSeller && (
              <section className="bg-primary/5 border border-primary/10 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display font-semibold text-lg text-textprimary mb-1">Start Selling</h2>
                    <p className="text-sm text-textsecondary">Upgrade your account to list cars and reach thousands of buyers.</p>
                  </div>
                  <Link
                    to="/become-seller"
                    className="whitespace-nowrap px-5 py-2.5 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center gap-2"
                  >
                    Become a Seller <ArrowRight size={16} />
                  </Link>
                </div>
              </section>
            )}

            {/* Security: Change Password */}
            <section>
              <h2 className="font-display font-semibold text-lg text-textprimary mb-4 flex items-center gap-2">
                <KeyRound size={18} /> Change Password
              </h2>
              {pwError && (
                <div className="mb-4 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="mb-4 p-4 bg-success/10 border border-success/20 rounded-md text-success text-sm font-medium">
                  {pwSuccess}
                </div>
              )}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">Current Password</label>
                    <input
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      required
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">New Password</label>
                    <input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      placeholder="Min 6 characters"
                      required
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-textsecondary">Confirm New Password</label>
                    <input
                      type="password"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      placeholder="Repeat new password"
                      required
                      className="w-full h-11 px-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-textmuted">
                    Forgot your current password?{' '}
                    <Link to="/forgot-password" className="text-primary font-medium hover:text-primarylight transition-colors">
                      Reset it by email
                    </Link>
                  </p>
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="px-5 py-2 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {pwSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Updating...
                      </span>
                    ) : (
                      <><KeyRound size={16} /> Update Password</>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Actions */}
            {editing && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-bordercol">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError('');
                    setSuccess('');
                    setForm({
                      name: user.name || '',
                      phone: user.phone || '',
                      whatsapp: user.sellerProfile?.whatsapp || '',
                      location: user.sellerProfile?.location || '',
                      sellerType: user.sellerProfile?.sellerType || 'PRIVATE',
                    });
                  }}
                  className="px-4 py-2 border border-bordercol rounded-md text-sm font-medium hover:bg-bg transition-colors flex items-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      Saving...
                    </span>
                  ) : (
                    <><Save size={16} /> Save Changes</>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
