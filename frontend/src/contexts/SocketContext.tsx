import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinAuction: (auctionId: string) => void;
  leaveAuction: (auctionId: string) => void;
  placeBid: (auctionId: string, amount: number) => void;
}

interface BidData {
  bidId: string;
  amount: number;
  userId: string;
  username: string;
  fullName?: string;
  timestamp: string;
  userCount?: number;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, user } = useAuth();

  useEffect(() => {
    if (token && user) {
      // Connect to WebSocket with authentication
      const socketInstance = io('http://localhost:3000/auction', {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
        console.log('🌐 Connected to auction WebSocket');
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
        console.log('🔌 Disconnected from auction WebSocket');
      });

      socketInstance.on('connected', (data) => {
        console.log('✅ Socket authenticated:', data.message);
      });

      socketInstance.on('error', (data) => {
        console.error('❌ Socket error:', data.message);
        toast.error(data.message);
      });

      // Global bid event listeners
      socketInstance.on('newBid', (data: BidData) => {
        console.log(' New bid received:', data);
      });

      socketInstance.on('bidError', (data) => {
        toast.error(data.message);
      });

      socketInstance.on('bidPlaced', (data) => {
        toast.success(data.message);
      });

      socketInstance.on('auctionEnded', (data) => {
        toast.success(data.message);
      });

      // NEW: Listen for user-specific notifications
      socketInstance.on('userNotification', (notification) => {
        console.log(' Received user notification:', notification);
        
        // Only show notification if it's for the current user
        if (notification.userId === user.id) {
          const { type, title, message } = notification;
          
          switch (type) {
            case 'success':
              toast.success(message, {
                icon: '🏆',
                duration: 8000, // 8 seconds for winner notifications
              });
              break;
              
            case 'info':
              toast.success(message, {
                icon: '📋',
                duration: 6000, // 6 seconds for info notifications
              });
              break;
              
            default:
              toast(message, {
                icon: '📧',
                duration: 5000,
              });
          }
        }
      });

      // NEW: Listen for auction-wide notifications
      socketInstance.on('auctionNotification', (notification) => {
        console.log(' Received auction notification:', notification);
        
        const { type, title, message } = notification;
        
        toast(message, {
          icon: type === 'info' ? '📋' : '📧',
          duration: 5000,
        });
      });

      setSocket(socketInstance);

      // Cleanup on unmount
      return () => {
        socketInstance.off('userNotification');
        socketInstance.off('auctionNotification');
        socketInstance.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [token, user]);

  const joinAuction = (auctionId: string) => {
    if (socket) {
      socket.emit('joinAuction', { auctionId });
      console.log(` Joining auction: ${auctionId}`);
    }
  };

  const leaveAuction = (auctionId: string) => {
    if (socket) {
      socket.emit('leaveAuction', { auctionId });
      console.log(` Leaving auction: ${auctionId}`);
    }
  };

  const placeBid = (auctionId: string, amount: number) => {
    if (socket) {
      socket.emit('placeBid', { auctionId, amount });
      console.log(` Placing bid: ${amount} on auction ${auctionId}`);
    }
  };

  const value = {
    socket,
    isConnected,
    joinAuction,
    leaveAuction,
    placeBid,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}