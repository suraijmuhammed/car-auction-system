import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  DollarSign, 
  Gavel, 
  Heart,
  Share2,
  Car,
  Zap,
  TrendingUp,
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageGallery from '../components/ImageGallery';

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
  bids: Bid[];
}

interface Bid {
  id: string;
  amount: number;
  timestamp: string;
  user: {
    id: string;
    username: string;
    fullName?: string;
  };
}

interface BidFormData {
  amount: number;
}

function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected, joinAuction, placeBid } = useSocket();
  
  const [bidHistory, setBidHistory] = useState<Bid[]>([]);
  const [currentHighestBid, setCurrentHighestBid] = useState<number>(0);
  const [userCount, setUserCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BidFormData>();

  // Fetch auction data
  const { data: auction, isLoading, error } = useQuery<Auction>(
    ['auction', id],
    async () => {
      const response = await axios.get(`/auctions/${id}`);
      return response.data;
    },
    {
      enabled: !!id,
      onSuccess: (data) => {
        setBidHistory(data.bids || []);
        setCurrentHighestBid(data.currentHighestBid);
      }
    }
  );

  // Socket event handlers
  useEffect(() => {
    if (socket && id && isConnected) {
      joinAuction(id);

      // Listen for real-time bid updates
      socket.on('joinedAuction', (data) => {
        console.log('✅ Joined auction:', data);
        setUserCount(data.userCount || 0);
      });

      socket.on('currentHighestBid', (data) => {
        setCurrentHighestBid(data.amount);
      });

      socket.on('newBid', (data) => {
        setCurrentHighestBid(data.amount);
        setUserCount(data.userCount || 0);
        
        // Add new bid to history
        const newBid: Bid = {
          id: data.bidId,
          amount: data.amount,
          timestamp: data.timestamp,
          user: {
            id: data.userId,
            username: data.username,
            fullName: data.fullName
          }
        };
        
        setBidHistory(prev => [newBid, ...prev]);
        
        if (data.userId !== user?.id) {
          toast.success(`New bid: ${data.amount.toLocaleString()} by ${data.username}`, {
            icon: '💰',
          });
        }
      });

      socket.on('bidHistory', (history) => {
        setBidHistory(history);
      });

      socket.on('auctionEnded', (data) => {
        toast.success(data.message, { icon: '🏆' });
      });

      return () => {
        socket.off('joinedAuction');
        socket.off('currentHighestBid');
        socket.off('newBid');
        socket.off('bidHistory');
        socket.off('auctionEnded');
      };
    }
  }, [socket, id, isConnected, user?.id, joinAuction]);

  // Time remaining calculation
  const timeRemaining = auction ? new Date(auction.endTime).getTime() - new Date().getTime() : 0;
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Handle bid submission
  const onSubmit = (data: BidFormData) => {
    if (!auction) return;
    
    const bidAmount = data.amount;
    const minimumBid = Math.max(auction.startingBid, currentHighestBid);
    
    if (bidAmount <= minimumBid) {
      toast.error(`Bid must be higher than ${formatCurrency(minimumBid)}`);
      return;
    }

    placeBid(auction.id, bidAmount);
    reset();
  };

  if (isLoading) return <LoadingSpinner />;
  if (error || !auction) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Auction Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Auctions
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Auctions</span>
        </button>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full transition-colors ${
              isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:text-red-600'
            }`}
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button className="p-2 bg-gray-100 text-gray-600 hover:text-blue-600 rounded-full transition-colors">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Images and Description */}
        <div className="lg:col-span-2 space-y-8">
          {/* Image Gallery */}
          <ImageGallery images={auction.carImages} />

          {/* Car Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-lg"
          >
            <div className="flex items-center space-x-3 mb-6">
              <Car className="h-6 w-6 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {auction.carYear} {auction.carMake} {auction.carModel}
              </h1>
            </div>

            <p className="text-gray-600 text-lg leading-relaxed mb-6">
              {auction.carDescription}
            </p>

            {/* Specifications */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Year', value: auction.carYear },
                { label: 'Make', value: auction.carMake },
                { label: 'Model', value: auction.carModel },
                { label: 'Status', value: 'Excellent' }
              ].map((spec, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 font-medium mb-1">{spec.label}</div>
                  <div className="text-lg font-semibold text-gray-900">{spec.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Bidding */}
        <div className="space-y-6">
          {/* Auction Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-green-500"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-600 font-semibold">LIVE AUCTION</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="h-4 w-4" />
                <span className="text-sm">{userCount} bidders</span>
              </div>
            </div>

            {/* Time Remaining */}
            <div className="text-center mb-6">
              <div className="text-sm text-gray-600 mb-2">Time Remaining</div>
              <div className="text-2xl font-bold text-gray-900 flex items-center justify-center space-x-4">
                <div className="text-center">
                  <div>{hoursRemaining.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">HOURS</div>
                </div>
                <div className="text-gray-400">:</div>
                <div className="text-center">
                  <div>{minutesRemaining.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">MINS</div>
                </div>
                <div className="text-gray-400">:</div>
                <div className="text-center">
                  <div>{secondsRemaining.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">SECS</div>
                </div>
              </div>
            </div>

            {/* Current Bid */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-2">Current Highest Bid</div>
                <div className="text-4xl font-bold text-gray-900 flex items-center justify-center space-x-2">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <span>{formatCurrency(currentHighestBid)}</span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  Starting bid: {formatCurrency(auction.startingBid)}
                </div>
              </div>
            </div>

            {/* Bidding Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Bid Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    step="1000"
                    min={Math.max(auction.startingBid, currentHighestBid) + 1000}
                    {...register('amount', {
                      required: 'Bid amount is required',
                      min: {
                        value: Math.max(auction.startingBid, currentHighestBid) + 1000,
                        message: `Minimum bid is ${formatCurrency(Math.max(auction.startingBid, currentHighestBid) + 1000)}`
                      }
                    })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    placeholder={`${Math.max(auction.startingBid, currentHighestBid) + 1000}`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-red-600 text-sm mt-1">{errors.amount.message}</p>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Gavel className="h-5 w-5" />
                <span>Place Bid</span>
                <Zap className="h-5 w-5" />
              </motion.button>
            </form>

            {!isConnected && (
              <p className="text-orange-600 text-sm text-center mt-2">
                Connecting to live auction...
              </p>
            )}
          </motion.div>

          {/* Bid History */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center space-x-2 mb-6">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Bid History</h3>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              <AnimatePresence>
                {bidHistory.length > 0 ? (
                  bidHistory.map((bid) => (
                    <motion.div
                      key={bid.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`flex items-center justify-between p-4 rounded-xl ${
                        bid.user.id === user?.id 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {bid.user.id === user?.id ? 'You' : bid.user.username}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(bid.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(bid.amount)}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No bids yet. Be the first to bid!</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default AuctionPage;