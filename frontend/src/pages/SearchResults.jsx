import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Search, SlidersHorizontal, GitCompareArrows } from 'lucide-react';
import api, { getImageThumbUrl } from '../utils/api';
import useSEO from '../hooks/useSEO';
import useModalA11y from '../hooks/useModalA11y';
import FilterContent from '../components/FilterContent';
import { getSellerPlanBadge } from '../utils/sellerPlan';
import VehicleCard from '../components/VehicleCard';
import VehicleGridSkeleton from '../components/VehicleGridSkeleton';

const SearchResults = () => {
  useSEO({
    title: 'Search Cars',
    description: 'Filter thousands of car listings across Ghana by make, price, location, condition and more.',
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const mobileFiltersRef = useModalA11y(showMobileFilters, () => setShowMobileFilters(false));
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
    noKnownFaults: searchParams.get('noKnownFaults') || '',
    firstOwner: searchParams.get('firstOwner') || '',
    registered: searchParams.get('registered') || '',
    exchangePossible: searchParams.get('exchangePossible') || '',
  });

  const { data } = useQuery({
    queryKey: ['vehicles', searchParams.toString()],
    queryFn: async () => {
      // searchParams are the applied filters + page (applyFilters writes them)
      const params = Object.fromEntries(searchParams.entries());
      if (!params.page) params.page = 1;
      const { data: resp } = await api.get('/vehicles', { params });
      return {
        vehicles: resp.vehicles || [],
        total: resp.pagination?.total ?? resp.total ?? (resp.vehicles?.length || 0),
        currentPage: resp.pagination?.page ?? resp.page ?? 1,
        totalPages: resp.pagination?.totalPages ?? resp.pages ?? 1,
      };
    },
    placeholderData: (prev) => prev,
  });

  const vehicles = data?.vehicles ?? [];
  const total = data?.total ?? 0;
  const currentPage = data?.currentPage ?? 1;
  const totalPages = data?.totalPages ?? 1;
  const loading = data === undefined;

  const applyFilters = (e) => {
    e.preventDefault();
    setSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')));
    setShowMobileFilters(false);
  };

  const clearFilters = () => {
    setFilters({ make: '', model: '', minPrice: '', maxPrice: '', year: '', minMileage: '', maxMileage: '', location: '', transmission: '', fuelType: '', condition: '', sellerType: '', verifiedOnly: '', noKnownFaults: '', firstOwner: '', registered: '', exchangePossible: '' });
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
              <select
                value={`${searchParams.get('sortBy') || 'createdAt'}:${searchParams.get('order') || 'desc'}`}
                onChange={(e) => {
                  const [sortBy, order] = e.target.value.split(':');
                  const next = Object.fromEntries(searchParams);
                  if (sortBy === 'createdAt' && order === 'desc') {
                    delete next.sortBy;
                    delete next.order;
                    delete next.page;
                  } else {
                    next.sortBy = sortBy;
                    next.order = order;
                    delete next.page;
                  }
                  setSearchParams(next);
                }}
                className="h-10 px-3 border border-bordercol rounded-md bg-surface text-sm text-textprimary focus:outline-none focus:border-primary"
                aria-label="Sort results"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="price:asc">Price: Low to High</option>
                <option value="price:desc">Price: High to Low</option>
                <option value="year:desc">Year: Newest</option>
                <option value="mileage:asc">Mileage: Lowest</option>
              </select>
            </div>

            {loading ? (
              <VehicleGridSkeleton count={9} className="grid-cols-2 lg:grid-cols-3" />
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
                    const imageUrl = car.images?.length > 0 ? getImageThumbUrl(car.images[0]) : null;
                    return (
                      <VehicleCard 
                        key={car.id}
                        id={car.id}
                        title={`${car.year} ${car.make} ${car.model}`}
                        price={car.price}
                        location={car.location}
                        condition={car.condition.replace('_', ' ')}
                        facts={car}
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
          <div ref={mobileFiltersRef} role="dialog" aria-modal="true" aria-label="Search filters" className="relative bg-surface rounded-t-2xl p-6 h-[85vh] overflow-y-auto">
            <button
              onClick={() => setShowMobileFilters(false)}
              aria-label="Close filters"
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
                  <button onClick={() => removeFromCompare(car.id)} aria-label={`Remove ${car.year} ${car.make} ${car.model} from comparison`} className="text-white/50 hover:text-white"><X size={14} /></button>
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
