"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  UserResponse,
  LoginPayload,
  RegisterPayload,
  loginUser,
  registerUser,
  getMe,
  logoutUser
} from '@/services/auth';
import { BusinessResponse, listBusinesses } from '@/services/business';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  
  // Business extensions
  businesses: BusinessResponse[];
  activeBusiness: BusinessResponse | null;
  activeBusinessLoading: boolean;
  setActiveBusiness: (business: BusinessResponse | null) => void;
  refreshBusinesses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Business states
  const [businesses, setBusinesses] = useState<BusinessResponse[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<BusinessResponse | null>(null);
  const [activeBusinessLoading, setActiveBusinessLoading] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();

  // Load and refresh businesses list
  const refreshBusinesses = useCallback(async (activeToken?: string | null) => {
    const currentToken = activeToken || token;
    if (!currentToken) {
      setBusinesses([]);
      setActiveBusinessState(null);
      return;
    }

    setActiveBusinessLoading(true);
    try {
      const bizList = await listBusinesses(currentToken);
      setBusinesses(bizList);
      
      // Determine which business should be active
      const cachedBizId = localStorage.getItem('easybiz_active_business_id');
      if (bizList.length > 0) {
        const found = bizList.find(b => b.id === cachedBizId);
        if (found) {
          setActiveBusinessState(found);
        } else {
          // Default to the first business
          setActiveBusinessState(bizList[0]);
          localStorage.setItem('easybiz_active_business_id', bizList[0].id);
        }
      } else {
        setActiveBusinessState(null);
        localStorage.removeItem('easybiz_active_business_id');
      }
    } catch (error) {
      console.error("Error loading businesses:", error);
    } finally {
      setActiveBusinessLoading(false);
    }
  }, [token]);

  // Set selected active business
  const setActiveBusiness = (business: BusinessResponse | null) => {
    setActiveBusinessState(business);
    if (business) {
      localStorage.setItem('easybiz_active_business_id', business.id);
    } else {
      localStorage.removeItem('easybiz_active_business_id');
    }
  };

  // 1. Initialize Auth State from Local Storage
  useEffect(() => {
    async function initializeAuth() {
      const storedToken = localStorage.getItem('easybiz_token');
      if (storedToken) {
        try {
          // Verify token against backend
          const userData = await getMe(storedToken);
          setUser(userData);
          setToken(storedToken);
          
          // Load businesses with the validated token
          await refreshBusinesses(storedToken);
        } catch (error) {
          console.warn("Token verification failed (session expired or invalid token):", error instanceof Error ? error.message : error);
          // Clear invalid token
          localStorage.removeItem('easybiz_token');
          localStorage.removeItem('easybiz_active_business_id');
          setUser(null);
          setToken(null);
          setBusinesses([]);
          setActiveBusinessState(null);
        }
      }
      setLoading(false);
    }
    initializeAuth();
  }, [refreshBusinesses]);

  // 2. Client Side Protected Route Guards
  useEffect(() => {
    if (loading) return;

    const publicRoutes = ['/', '/login', '/register'];
    const isPublicRoute = publicRoutes.includes(pathname);

    if (!user && !isPublicRoute) {
      // Direct unauthorized user to login
      router.push('/login');
    } else if (user && (pathname === '/login' || pathname === '/register')) {
      // Direct authenticated user to dashboard if trying to hit auth pages
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // 3. Login helper
  const login = async (payload: LoginPayload) => {
    setLoading(true);
    try {
      const response = await loginUser(payload);
      localStorage.setItem('easybiz_token', response.access_token);
      setUser(response.user);
      setToken(response.access_token);
      
      // Load businesses immediately after logging in
      await refreshBusinesses(response.access_token);
      
      router.push('/dashboard');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // 4. Register helper with Auto-login
  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      await registerUser(payload);
      // Automatically log in the user on successful registration
      await login({ email: payload.email, password: payload.password });
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // 5. Logout helper
  const logout = async () => {
    const activeToken = token;
    // Optimistically clear local state immediately for fast UX
    setUser(null);
    setToken(null);
    setBusinesses([]);
    setActiveBusinessState(null);
    localStorage.removeItem('easybiz_token');
    localStorage.removeItem('easybiz_active_business_id');
    router.push('/login');

    // Send API call in background
    if (activeToken) {
      try {
        await logoutUser(activeToken);
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      businesses,
      activeBusiness,
      activeBusinessLoading,
      setActiveBusiness,
      refreshBusinesses
    }}>
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
