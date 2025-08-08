import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Clock, Users, TrendingUp, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AuctionCard from '../components/AuctionCard';

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

function HomePage() {
  const { user } = useAuth();

  const { data: auctions, isLoading, error } = useQuery<Auction[]>(
    'auctions',
    async () => {
      const response = await axios.get('/auctions');
      return response.data;
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="text-center text-red-600">Failed to load auctions</div>;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent mb-6">
          Elite Car Auctions
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Experience the thrill of real-time bidding on the world's most exclusive supercars. 
          Join thousands of collectors in our premium auction platform.
        </p>
        
        {!user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              to="/register"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Join Elite Auctions
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
            >
              Sign In
            </Link>
          </motion.div>
        )}
      </motion.div>

      {/* Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
      >
        {[
          { icon: Clock, label: 'Live Auctions', value: auctions?.length || 0, color: 'text-blue-600' },
          
        ].map((stat, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.05 }}
            className="bg-white rounded-xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Auctions Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-12"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Live Auctions</h2>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600 font-medium">Live Bidding</span>
          </div>
        </div>

        {auctions && auctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {auctions.map((auction) => (
              <motion.div key={auction.id} variants={item}>
                <AuctionCard auction={auction} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Clock className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Auctions</h3>
            <p className="text-gray-500">Check back soon for new luxury car auctions!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default HomePage;