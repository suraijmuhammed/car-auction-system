import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:3000';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthData = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    delete axios.defaults.headers.common['Authorization'];
  };

  // 🛡️ ENHANCED: Verify token validity
  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await axios.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.status === 200;
    } catch (error) {
      console.log('Token validation failed:', error);
      return false;
    }
  };

  
  const refreshAuth = async () => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
      // Verify token is still valid
      const isValid = await verifyToken(savedToken);
      
      if (isValid) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } else {
        // Token expired - clear everything
        clearAuthData();
        toast.error('Session expired. Please log in again.');
      }
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  // 🛡️ ENHANCED: Response interceptor for handling auth errors
  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle authentication errors globally
        if (error.response?.status === 401) {
          clearAuthData();
          toast.error('Session expired. Please log in again.');
        }
        
        // Handle foreign key constraint errors (user not found)
        if (error.response?.data?.message?.includes('User session expired') ||
            error.response?.data?.message?.includes('User not found')) {
          clearAuthData();
          toast.error('Your session has expired. Please log in again.');
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/login', { email, password });
      
      const { user: userData, access_token } = response.data;
      
      setUser(userData);
      setToken(access_token);
      
      localStorage.setItem('authToken', access_token);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('🎉 Welcome back!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      clearAuthData(); // Clear any partial auth state
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/register', userData);
      
      const { user: newUser, access_token } = response.data;
      
      setUser(newUser);
      setToken(access_token);
      
      localStorage.setItem('authToken', access_token);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      toast.success('🎉 Registration successful!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      clearAuthData(); // Clear any partial auth state
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthData();
    toast.success('👋 Logged out successfully');
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}