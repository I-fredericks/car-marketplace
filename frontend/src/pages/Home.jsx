import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ChevronRight, ShieldCheck, BadgeCheck, PhoneCall, Car,
  LayoutGrid, CarFront, Truck, Bus, MapPin, Sparkles,
} from 'lucide-react';
import api, { getImageThumbUrl } from '../utils/api';
import { getSellerPlanBadge } from '../utils/sellerPlan';
import useSEO from '../hooks/useSEO';
import VehicleCard from '../components/VehicleCard';
import VehicleGridSkeleton from '../components/VehicleGridSkeleton';

// Body-type shortcuts shown as category tiles (jiji-style)
const CATEGORIES = [
  { label: 'All Cars', value: '', Icon: LayoutGrid },
  { label: 'Sedan', value: 'Sedan', Icon: Car },
  { label: 'SUV', value: 'SUV', Icon: CarFront },
  { label: 'Hatchback', value: 'Hatchback', Icon: CarFront },
  { label: 'Pickup', value: 'Pickup', Icon: Truck },
  { label: 'Van', value: 'Van', Icon: Bus },
];

const Home = () => {
  useSEO({
    title: 'Buy & Sell Cars in Ghana',
    description: 'Browse verified new and used cars for sale in Ghana from trusted dealers and private sellers. Compare prices, contact sellers, and find your next car today.',
  });
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [advanced, setAdvanced] = useState({
    make: '', minPrice: '', maxPrice: '', year: '',
  });
  const { data: featuredCars = [], isLoading: loading } = useQuery({
    queryKey: ['featured-cars'],
    queryFn: async () => {
      const { data } = await api.get('/vehicles/featured');
      return data;
    },
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const params = {};
    if (keyword.trim()) params.search = keyword.trim();
    if (location) params.location = location;
    Object.entries(advanced).forEach(([k, v]) => { if (v) params[k] = v; });
    navigate(`/search?${new URLSearchParams(params).toString()}`);
  };

  return (
    <div className="bg-bg min-h-screen pt-16 pb-24 md:pb-0">
      {/* ===== Compact hero with big jiji-style search ===== */}
      <section className="bg-primarydark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 md:py-16">
          <h1 className="font-display font-bold text-2xl sm:text-4xl lg:text-5xl mb-2 md:mb-4 tracking-tight text-center">
            Find cars, sell faster
          </h1>
          <p className="hidden md:block text-lg text-bordercol text-center max-w-2xl mx-auto mb-8">
            Ghana's most trusted vehicle marketplace — thousands of verified cars at unbeatable prices.
          </p>

          {/* Big rounded search bar (mobile-first, jiji style) */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-textmuted" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search make, model… e.g. Toyota Camry"
                  className="w-full h-12 pl-11 pr-4 rounded-full bg-surface text-textprimary text-sm md:text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-textmuted"
                />
              </div>
              <button
                type="submit"
                className="h-12 px-5 md:px-8 bg-accent text-primarydark font-bold rounded-full hover:bg-accentdark transition-colors shadow-lg flex items-center gap-2"
              >
                <Search size={18} className="md:hidden" />
                <span className="hidden md:inline">Search</span>
              </button>
            </div>

            {/* Location chip row (mobile) */}
            <div className="flex md:hidden items-center gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar">
              <MapPin size={14} className="text-bordercol flex-shrink-0" />
              {['', 'Accra', 'Kumasi', 'Takoradi', 'Tamale'].map(loc => (
                <button
                  key={loc || 'all'}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    location === loc
                      ? 'bg-accent text-primarydark border-accent font-bold'
                      : 'border-white/25 text-bordercol hover:border-white/50'
                  }`}
                >
                  {loc || 'All Ghana'}
                </button>
              ))}
            </div>

            {/* Advanced fields (desktop) */}
            <div className="hidden md:grid grid-cols-4 gap-3 mt-4">
              <select
                value={advanced.make}
                onChange={(e) => setAdvanced({ ...advanced, make: e.target.value })}
                className="h-11 px-3 rounded-lg bg-surface text-textprimary text-sm border border-transparent focus:border-accent focus:outline-none"
              >
                <option value="">Any Make</option>
                {['Toyota', 'Honda', 'Mercedes', 'Hyundai', 'Nissan', 'Kia'].map(m => <option key={m}>{m}</option>)}
              </select>
              <input
                type="number" placeholder="Min price (GH₵)" value={advanced.minPrice}
                onChange={(e) => setAdvanced({ ...advanced, minPrice: e.target.value })}
                className="h-11 px-3 rounded-lg bg-surface text-textprimary text-sm border border-transparent focus:border-accent focus:outline-none"
              />
              <input
                type="number" placeholder="Max price (GH₵)" value={advanced.maxPrice}
                onChange={(e) => setAdvanced({ ...advanced, maxPrice: e.target.value })}
                className="h-11 px-3 rounded-lg bg-surface text-textprimary text-sm border border-transparent focus:border-accent focus:outline-none"
              />
              <input
                type="number" placeholder="Year e.g. 2020" value={advanced.year}
                onChange={(e) => setAdvanced({ ...advanced, year: e.target.value })}
                className="h-11 px-3 rounded-lg bg-surface text-textprimary text-sm border border-transparent focus:border-accent focus:outline-none"
              />
            </div>
          </form>
        </div>
      </section>

      {/* ===== Category tiles (jiji-style shortcuts) ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 md:mt-10">
        <h2 className="font-display font-bold text-lg text-textprimary mb-3">Browse by body type</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-4">
          {CATEGORIES.map(({ label, value, Icon }) => (
            <Link
              key={label}
              to={value ? `/search?bodyType=${value}` : '/search'}
              className="flex flex-col items-center gap-2 bg-surface border border-bordercol rounded-xl py-4 px-2 text-center hover:border-primary hover:shadow-md transition-all group"
            >
              <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <Icon size={20} />
              </span>
              <span className="text-xs sm:text-sm font-medium text-textprimary">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== Featured feed (2-col on mobile, like jiji) ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 md:mt-12">
        <div className="flex justify-between items-end mb-4 md:mb-8">
          <div>
            <h2 className="font-display font-bold text-xl md:text-3xl text-textprimary flex items-center gap-2">
              <Sparkles size={20} className="text-accent hidden sm:inline" /> Featured Vehicles
            </h2>
            <p className="hidden md:block text-textsecondary mt-1">Hand-picked, premium cars just for you.</p>
          </div>
          <Link to="/search" className="flex items-center gap-1 text-primary text-sm md:text-base font-medium hover:text-primarylight transition-colors">
            See all <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <VehicleGridSkeleton count={8} className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
        ) : featuredCars.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-10 text-center flex flex-col items-center">
            <Car size={44} className="text-bordercol mb-3" />
            <h3 className="font-display font-semibold text-lg text-textprimary mb-1">No featured cars yet</h3>
            <p className="text-textsecondary text-sm">Check back later for new premium listings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {featuredCars.map(car => {
              const imageUrl = car.images?.length > 0 ? getImageThumbUrl(car.images[0]) : null;
              return (
                <VehicleCard
                  key={car.id}
                  id={car.id}
                  title={`${car.year} ${car.make} ${car.model}`}
                  price={car.price}
                  location={car.location}
                  condition={car.condition}
                  specs={[car.transmission, car.fuelType, car.mileage != null ? `${car.mileage} km` : ''].filter(Boolean)}
                  sellerName={car.seller?.user?.name || 'Private Seller'}
                  verified={Boolean(car.seller?.verified)}
                  badge="Featured"
                  sellerPlanBadge={getSellerPlanBadge(car)}
                  imageUrl={imageUrl}
                />
              );
            })}
          </div>
        )}

        <Link
          to="/search"
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 border border-primary text-primary font-medium rounded-md hover:bg-primary hover:text-white transition-colors"
        >
          View all vehicles <ChevronRight size={18} />
        </Link>
      </section>

      {/* ===== Trust section (desktop — mobile stays lean like jiji) ===== */}
      <section className="hidden md:block bg-surface border-t border-bordercol py-16 mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-display font-bold text-3xl text-primary mb-4">Why Buy From CarMarket?</h2>
            <p className="text-textsecondary">Experience a secure and seamless car buying journey.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-4">
                <BadgeCheck size={32} />
              </div>
              <h3 className="font-display font-semibold text-lg text-textprimary mb-2">Verified Sellers</h3>
              <p className="text-textsecondary text-sm">Every seller passes our strict Ghana Card & phone verification check.</p>
            </div>

            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-4">
                <ShieldCheck size={32} />
              </div>
              <h3 className="font-display font-semibold text-lg text-textprimary mb-2">Secure Transactions</h3>
              <p className="text-textsecondary text-sm">Detailed vehicle histories and transparent information you can trust.</p>
            </div>

            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-4">
                <Car size={32} />
              </div>
              <h3 className="font-display font-semibold text-lg text-textprimary mb-2">Huge Inventory</h3>
              <p className="text-textsecondary text-sm">Thousands of premium cars across all regions in Ghana.</p>
            </div>

            <div className="flex flex-col items-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-4">
                <PhoneCall size={32} />
              </div>
              <h3 className="font-display font-semibold text-lg text-textprimary mb-2">Direct Contact</h3>
              <p className="text-textsecondary text-sm">Connect instantly with sellers via WhatsApp or phone call.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Sell CTA (desktop emphasis; mobile has the bottom-nav + button) ===== */}
      <section className="hidden md:block py-20 px-4 sm:px-6 lg:px-8 bg-bg">
        <div className="max-w-4xl mx-auto bg-primary rounded-xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(27,42,74,0.4)]">
          <div className="p-8 md:p-12 text-center text-white">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">Ready to sell your car?</h2>
            <p className="text-primarylight mb-8 max-w-xl mx-auto">
              List your car on Ghana's fastest-growing marketplace and reach thousands of potential buyers today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/sell" className="px-8 py-4 bg-accent text-primarydark font-bold rounded-md hover:bg-accentdark transition-colors text-lg shadow-sm">
                Sell Your Car Now
              </Link>
              <Link to="/register" className="px-8 py-4 bg-transparent border border-white/30 font-medium rounded-md hover:bg-white/10 transition-colors text-lg">
                Create an Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
