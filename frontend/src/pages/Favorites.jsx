import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import api, { getImageThumbUrl } from '../utils/api';
import { Heart, Search, Lock } from 'lucide-react';
import VehicleCard from '../components/VehicleCard';

const Favorites = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading: loading } = useQuery({
    queryKey: ['favorites', user?.id ?? null],
    queryFn: async () => {
      const { data } = await api.get('/favorites');
      return data;
    },
    enabled: Boolean(user),
  });

  const removeFavorite = async (vehicleId) => {
    try {
      await api.delete(`/favorites/${vehicleId}`);
      queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
    } catch (err) {
      console.error('Error removing favorite:', err);
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
            <Lock size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Login Required</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            Please log in to your account to view and manage your saved cars.
          </p>
          <Link 
            to="/login" 
            className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-textprimary mb-2">Saved Cars</h1>
          <p className="text-textsecondary">Vehicles you've favorited for later.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-textmuted">
            <div className="animate-spin w-8 h-8 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
            <p>Loading your saved cars...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-surface border border-bordercol rounded-lg p-16 text-center flex flex-col items-center">
            <Heart size={48} className="text-bordercol mb-4" />
            <h3 className="font-display font-semibold text-xl text-textprimary mb-2">No saved cars yet</h3>
            <p className="text-textsecondary mb-8">When you see a car you like, click the heart icon to save it here.</p>
            <Link 
              to="/search" 
              className="px-6 py-3 bg-primary text-white font-medium rounded-md hover:bg-primarylight transition-colors flex items-center gap-2"
            >
              <Search size={18} /> Browse Cars
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {favorites.map(car => {
               const imageUrl = car.images?.length > 0 ? getImageThumbUrl(car.images[0]) : null;
               return (
                 <div key={car.id} className="relative group">
                   <VehicleCard 
                     id={car.id}
                     title={`${car.year} ${car.make} ${car.model}`}
                     price={car.price}
                     location={car.location}
                     condition={car.condition?.replace('_', ' ')}
                     specs={[car.transmission, car.fuelType, car.mileage ? `${car.mileage.toLocaleString()} km` : null].filter(Boolean)}
                     sellerName={car.seller?.name || 'Private Seller'}
                     verified={car.seller?.role === 'ADMIN' || car.seller?.role === 'SELLER'}
                     imageUrl={imageUrl}
                   />
                   <button 
                     onClick={(e) => {
                       e.preventDefault();
                       removeFavorite(car.id);
                     }}
                     className="absolute top-3 right-3 p-2 bg-surface rounded-full shadow-sm border border-bordercol text-err hover:bg-err/10 transition-colors z-10"
                     title="Remove from favorites"
                   >
                     <Heart size={18} fill="currentColor" />
                   </button>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
