import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Car, Search } from 'lucide-react';

const Register = () => {
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'BUYER'
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
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: form.role });
      navigate('/login');
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
