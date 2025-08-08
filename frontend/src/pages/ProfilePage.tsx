import React from 'react';
import { useQuery } from 'react-query';
import { motion } from 'framer-motion';
import axios from 'axios';
import { User, Mail, Calendar, Trophy, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface UserStats {
  totalBids: number;
  totalSpent: number;
  uniqueAuctions: number;
  averageBid: number;
}

interface BidHistory {
  id: string;
  amount: number;
  timestamp: string;
  auction: {
    id: string;
    carId: string;
    status: string;
    currentHighestBid: number;
  };
}

function ProfilePage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>(
    ['userStats', user?.id],
    async () => {
      const response = await axios.get(`/users/${user?.id}/stats`);
      return response.data.stats;
    },
    { enabled: !!user?.id }
  );

  const { data: bidHistory, isLoading: historyLoading } = useQuery<BidHistory[]>(
    ['userBidHistory', user?.id],
    async () => {
      const response = await axios.get(`/users/${user?.id}/bids`);
      return response.data;
    },
    { enabled: !!user?.id }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (statsLoading || historyLoading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 shadow-lg"
      >
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {user?.fullName || user?.username}
            </h1>
            <div className="flex items-center space-x-4 text-gray-600">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>{user?.username}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Member since 2024</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        {[
          {
            icon: Trophy,
            label: 'Total Bids',
            value: stats?.totalBids || 0,
            color: 'text-yellow-600 bg-yellow-100',
          },
          {
            icon: DollarSign,
            label: 'Total Spent',
            value: formatCurrency(stats?.totalSpent || 0),
            color: 'text-green-600 bg-green-100',
          },
          {
            icon: TrendingUp,
            label: 'Auctions Joined',
            value: stats?.uniqueAuctions || 0,
            color: 'text-blue-600 bg-blue-100',
          },
          {
            icon: TrendingUp,
            label: 'Average Bid',
            value: formatCurrency(stats?.averageBid || 0),
            color: 'text-purple-600 bg-purple-100',
          },
        ].map((stat, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.05 }}
            className="bg-white rounded-xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Bid History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl p-8 shadow-lg"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Bid History</h2>

        {bidHistory && bidHistory.length > 0 ? (
          <div className="space-y-4">
            {bidHistory.map((bid) => (
              <div
                key={bid.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{bid.auction.carId}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(bid.timestamp).toLocaleDateString()} at{' '}
                      {new Date(bid.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(bid.amount)}</div>
                  <div className={`text-sm ${
                    bid.amount === bid.auction.currentHighestBid 
                      ? 'text-green-600' 
                      : 'text-gray-600'
                  }`}>
                    {bid.amount === bid.auction.currentHighestBid ? 'Winning' : 'Outbid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No bids yet</p>
            <p>Start bidding on auctions to see your history here!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default ProfilePage;