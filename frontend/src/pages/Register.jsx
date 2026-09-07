import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Car, Search, User, Store, Building2 } from 'lucide-react';
import GoogleButton from '../components/GoogleButton';

const SELLER_TYPES = [
  { value: 'PRIVATE', label: 'Private', description: 'Selling my own car', Icon: User },
  { value: 'DEALER', label: 'Dealer', description: 'I buy & sell cars', Icon: Store },
  { value: 'COMPANY', label: 'Company', description: 'Registered company', Icon: Building2 },
];

const Register = () => {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'BUYER',
    sellerType: 'PRIVATE'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match.');
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: form.role, sellerType: form.role === 'SELLER' ? form.sellerType : undefined });
      // Registration hands off a verification email in the background; take
      // the user to login and TELL them to confirm before signing in.
      navigate('/login', {
        state: { registeredEmail: form.email },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-bg py-12 px-4 sm:px-6 lg:px-8 mt-16">
      <div className="max-w-xl w-full bg-surface border border-bordercol rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <h2 className="font-display font-bold text-3xl text-textprimary mb-2">Create Account</h2>
          <p className="text-textsecondary text-center">Join Ghana's most trusted car marketplace</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-textprimary">Full Name</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                placeholder="Kwame Mensah" 
                required 
                className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-textprimary">Email Address</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm({...form, email: e.target.value})} 
                placeholder="you@example.com" 
                required 
                className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
              />
            </div>
          </div>

          {form.role === 'SELLER' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-textprimary">I am selling as...</label>
              <div className="grid grid-cols-3 gap-3">
                {SELLER_TYPES.map(({ value, label, description, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, sellerType: value })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-md border-2 text-center transition-colors ${
                      form.sellerType === value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-bordercol bg-surface text-textsecondary hover:bg-bg'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[11px] text-textmuted leading-snug">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">Phone Number</label>
            <input 
              type="tel" 
              value={form.phone} 
              onChange={(e) => setForm({...form, phone: e.target.value})} 
              placeholder="e.g. 024XXXXXXX" 
              className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-textprimary">I want to...</label>
            <div className="flex gap-4">
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-md font-medium border-2 transition-colors ${
                  form.role === 'BUYER' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-bordercol bg-surface text-textsecondary hover:bg-bg'
                }`}
                onClick={() => setForm({...form, role: 'BUYER'})}
              >
                <Search size={18} /> Buy Cars
              </button>
              <button
                type="button"
                className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-md font-medium border-2 transition-colors ${
                  form.role === 'SELLER' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-bordercol bg-surface text-textsecondary hover:bg-bg'
                }`}
                onClick={() => setForm({...form, role: 'SELLER'})}
              >
                <Car size={18} /> Sell Cars
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-textprimary">Password</label>
              <input 
                type="password" 
                value={form.password} 
                onChange={(e) => setForm({...form, password: e.target.value})} 
                placeholder="Min 6 characters" 
                required 
                className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-textprimary">Confirm Password</label>
              <input 
                type="password" 
                value={form.confirmPassword} 
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})} 
                placeholder="Repeat password" 
                required 
                className="w-full h-11 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-4 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>

          <div className="flex items-center gap-4 my-6">
            <span className="flex-1 h-px bg-bordercol"></span>
            <span className="text-xs font-medium text-textmuted uppercase tracking-wide">or sign up with Google</span>
            <span className="flex-1 h-px bg-bordercol"></span>
          </div>

          <GoogleButton role={form.role} sellerType={form.role === 'SELLER' ? form.sellerType : undefined} onError={setError} navigate={navigate} />
        </form>

        <p className="mt-8 text-center text-sm text-textsecondary">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primarylight transition-colors">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
