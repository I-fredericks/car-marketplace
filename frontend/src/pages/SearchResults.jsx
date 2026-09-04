import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Filter, X, Search, SlidersHorizontal, GitCompareArrows } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { getSellerPlanBadge } from '../utils/sellerPlan';
import VehicleCard from '../components/VehicleCard';

const MAKES = ['Toyota', 'Honda', 'Mercedes', 'Hyundai', 'Nissan', 'Ford', 'Kia', 'BMW', 'Volkswagen'];
const LOCATIONS = ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani'];
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'];
const CONDITIONS = ['BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED'];
const SELLER_TYPES = ['PRIVATE', 'DEALER', 'COMPANY'];

// Module-level so the filter form keeps input focus: a component defined
// inside SearchResults' render remounts on every keystroke.
const FilterContent = ({ filters, setFilters, onApply, onClear }) => (
  <div className="flex flex-col gap-6">
    <div className="flex items-center justify-between">
      <h3 className="font-display font-semibold text-lg text-textprimary flex items-center gap-2">
        <Filter size={20} /> Filters
      </h3>
      <button onClick={onClear} className="text-sm font-medium text-textsecondary hover:text-primary transition-colors">
        Clear All
      </button>
    </div>

    <form onSubmit={onApply} className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Make</label>
        <select value={filters.make} onChange={(e) => setFilters({...filters, make: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Make</option>
          {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Model</label>
        <input type="text" placeholder="e.g. Camry" value={filters.model} onChange={(e) => setFilters({...filters, model: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Price Range (GH₵)</label>
        <div className="flex gap-2">
          <input type="number" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({...filters, minPrice: e.target.value})} className="w-1/2 h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
          <input type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: e.target.value})} className="w-1/2 h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Location</label>
        <select value={filters.location} onChange={(e) => setFilters({...filters, location: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Location</option>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Condition</label>
        <select value={filters.condition} onChange={(e) => setFilters({...filters, condition: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Condition</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-textsecondary">Transmission</label>
        <select value={filters.transmission} onChange={(e) => setFilters({...filters, transmission: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any</option>
          {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={filters.verifiedOnly === 'true'} onChange={(e) => setFilters({...filters, verifiedOnly: e.target.checked ? 'true' : ''})} className="w-4 h-4 text-primary rounded border-bordercol focus:ring-primary" />
        <span className="text-sm font-medium text-textprimary">Verified Sellers Only</span>
      </label>

      <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors mt-4">
        Apply Filters
      </button>
    </form>
  </div>
);

const SearchResults = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [compareList, setCompareList] = useState([]);

  const [filters, setFilters] = useState({
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    year: searchParams.get('year') || '',
    minMileage: searchParams.get('minMileage') || '',
    maxMileage: searchParams.get('maxMileage') || '',
    location: searchParams.get('location') || '',
    transmission: searchParams.get('transmission') || '',
    fuelType: searchParams.get('fuelType') || '',
    condition: searchParams.get('condition') || '',
    sellerType: searchParams.get('sellerType') || '',
    verifiedOnly: searchParams.get('verifiedOnly') || '',
  });

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const params = Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== '')
        );
        params.page = searchParams.get('page') || 1;
        const { data } = await api.get('/vehicles', { params });
        setVehicles(data.vehicles || []);
        setTotal(data.pagination?.total ?? data.total ?? (data.vehicles?.length || 0));
        setCurrentPage(data.pagination?.page ?? data.page ?? 1);
        setTotalPages(data.pagination?.totalPages ?? data.pages ?? 1);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [searchParams]);

  const applyFilters = (e) => {
    e.preventDefault();
    setSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')));
    setShowMobileFilters(false);
  };

  const clearFilters = () => {
    setFilters({ make: '', model: '', minPrice: '', maxPrice: '', year: '', minMileage: '', maxMileage: '', location: '', transmission: '', fuelType: '', condition: '', sellerType: '', verifiedOnly: '' });
    setSearchParams({});
    setShowMobileFilters(false);
  };

  const removeFromCompare = (carId) => {
    setCompareList(prev => prev.filter(c => c.id !== carId));
  };

  const goCompare = () => {
    if (compareList.length === 2) {
      navigate(`/compare?ids=${compareList[0].id},${compareList[1].id}`);
    }
  };

  return (
    <div className="bg-bg min-h-screen pt-20 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Mobile Filter Toggle */}
        <div className="md:hidden flex items-center justify-between bg-surface border border-bordercol rounded-md p-3 mb-6 shadow-sm sticky top-20 z-30">
          <div className="font-display font-semibold text-textprimary">
            {total} <span className="text-textsecondary font-medium">Cars Found</span>
          </div>
          <button 
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 bg-bg rounded-md text-textprimary border border-bordercol"
          >
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
          
          {/* Desktop Sidebar */}
          <aside className="hidden md:block sticky top-24 h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-surface border border-bordercol rounded-lg p-5">
              <FilterContent filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} />
            </div>
          </aside>

          {/* Main Results Area */}
          <main>
            <div className="hidden md:flex justify-between items-center mb-6">
              <h1 className="font-display font-bold text-2xl text-textprimary">
                {loading ? 'Searching...' : `${total} Cars Found`}
              </h1>
              {/* Optional: Add sort dropdown here later */}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-textmuted">
                <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
                <p>Finding the perfect cars for you...</p>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="bg-surface border border-bordercol rounded-lg p-12 text-center flex flex-col items-center">
                <Search size={48} className="text-bordercol mb-4" />
                <h3 className="font-display font-semibold text-xl text-textprimary mb-2">No cars match your search</h3>
                <p className="text-textsecondary mb-6">Try adjusting your filters or clearing them entirely.</p>
                <button onClick={clearFilters} className="px-6 py-2 bg-primary text-white font-medium rounded-md hover:bg-primarylight transition-colors">
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-10">
                  {vehicles.map(car => {
                    const imageUrl = car.images?.length > 0 ? getImageUrl(car.images[0]) : null;
                    return (
                      <VehicleCard 
                        key={car.id}
                        id={car.id}
                        title={`${car.year} ${car.make} ${car.model}`}
                        price={car.price}
                        location={car.location}
                        condition={car.condition.replace('_', ' ')}
                        specs={[car.transmission, car.fuelType, car.mileage ? `${car.mileage.toLocaleString()} km` : null].filter(Boolean)}
                        sellerName={car.seller?.user?.name || 'Private Seller'}
                        verified={Boolean(car.seller?.verified)}
                        sellerPlanBadge={getSellerPlanBadge(car)}
                        imageUrl={imageUrl}
                      />
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 bg-surface border border-bordercol rounded-lg p-4">
                    <button
                      onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: Math.max(1, currentPage - 1).toString() })}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-bordercol rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg transition-colors text-textprimary"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-textsecondary">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: Math.min(totalPages, currentPage + 1).toString() })}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-bordercol rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg transition-colors text-textprimary"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      {showMobileFilters && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-textprimary/50 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)}></div>
          <div className="relative bg-surface rounded-t-2xl p-6 h-[85vh] overflow-y-auto">
            <button 
              onClick={() => setShowMobileFilters(false)}
              className="absolute top-4 right-4 p-2 text-textsecondary hover:text-textprimary bg-bg rounded-full"
            >
              <X size={20} />
            </button>
            <FilterContent filters={filters} setFilters={setFilters} onApply={applyFilters} onClear={clearFilters} />
          </div>
        </div>
      )}

      {/* Compare Bar overlay */}
      {compareList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-primarydark text-white p-4 z-40 border-t-4 border-accent shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-display font-semibold">
              <GitCompareArrows size={20} className="text-accent" /> Compare
            </div>
            <div className="flex gap-4 w-full sm:w-auto">
              {compareList.map(car => (
                <div key={car.id} className="flex-1 sm:flex-none bg-white/10 px-3 py-2 rounded-md flex items-center justify-between gap-3 min-w-[150px]">
                  <span className="text-sm truncate">{car.year} {car.make} {car.model}</span>
                  <button onClick={() => removeFromCompare(car.id)} className="text-white/50 hover:text-white"><X size={14} /></button>
                </div>
              ))}
              {compareList.length === 1 && (
                <div className="flex-1 sm:flex-none bg-white/5 px-3 py-2 rounded-md flex items-center justify-center text-sm text-white/40 border border-white/10 border-dashed min-w-[150px]">
                  Add another car
                </div>
              )}
            </div>
            <button
              onClick={goCompare}
              disabled={compareList.length < 2}
              className="w-full sm:w-auto px-6 py-2 bg-accent text-primarydark font-bold rounded-md hover:bg-accentdark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Compare Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
