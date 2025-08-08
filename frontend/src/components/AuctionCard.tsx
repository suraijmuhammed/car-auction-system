import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Users, DollarSign, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Auction {
  id: string;
  carId: string;
  carMake: string;
  carModel: string;
  carYear: number;
  carImages: string[];
  carDescription: string;
  startTime: string;
  endTime: string;
  startingBid: number;
  currentHighestBid: number;
  status: string;
}

interface AuctionCardProps {
  auction: Auction;
}

function AuctionCard({ auction }: AuctionCardProps) {
  const { user } = useAuth();
  
  const timeRemaining = new Date(auction.endTime).getTime() - new Date().getTime();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300"
    >
      {/* Car Image */}
      <div className="relative h-64 overflow-hidden group">
        <img
          src={auction.carImages[0] || '/placeholder-car.jpg'}
          alt={`${auction.carMake} ${auction.carModel}`}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span>LIVE</span>
          </span>
        </div>

        {/* Image Count */}
        {auction.carImages.length > 1 && (
          <div className="absolute top-4 right-4">
            <span className="px-2 py-1 bg-black/70 text-white text-xs rounded-lg flex items-center space-x-1">
              <Eye className="h-3 w-3" />
              <span>{auction.carImages.length}</span>
            </span>
          </div>
        )}

        {/* Car Info Overlay */}
        <div className="absolute bottom-4 left-4 text-white">
          <h3 className="text-xl font-bold mb-1">
            {auction.carYear} {auction.carMake} {auction.carModel}
          </h3>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Price Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">Current Bid</span>
            <span className="text-sm text-gray-600">Starting at {formatCurrency(auction.startingBid)}</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <DollarSign className="h-7 w-7 text-green-600" />
            <span>{formatCurrency(auction.currentHighestBid)}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {auction.carDescription}
        </p>

        {/* Time Remaining */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {hoursRemaining > 0 
                ? `${hoursRemaining}h ${minutesRemaining}m left` 
                : `${minutesRemaining}m left`
              }
            </span>
          </div>
          <div className="flex items-center space-x-2 text-gray-600">
            <Users className="h-4 w-4" />
          </div>
        </div>

        {/* Action Button */}
        {user ? (
          <Link
            to={`/auction/${auction.id}`}
            className="block w-full"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Join Auction
            </motion.button>
          </Link>
        ) : (
          <Link
            to="/login"
            className="block w-full"
          >
            <button className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-300">
              Sign In to Bid
            </button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export default AuctionCard;