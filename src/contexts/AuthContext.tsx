import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { googleLogout } from '@react-oauth/google';
import { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    console.log('AuthContext: Checking for OAuth token...');
    
    // Check for OAuth token in URL hash (from custom auth flow)
    const hash = window.location.hash;
    console.log('URL hash:', hash);
    
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    
    console.log('Access token from URL:', accessToken ? 'Found' : 'Not found');
    
    if (accessToken) {
      console.log('Processing OAuth token...');
      // Get user info and store token
      fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`)
        .then(response => response.json())
        .then(user => {
          console.log('User info retrieved:', user);
          localStorage.setItem('google_access_token', accessToken);
          localStorage.setItem('google_user', JSON.stringify(user));
          setAccessToken(accessToken);
          setUser(user);
          setIsAuthenticated(true);
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('OAuth flow completed successfully');
        })
        .catch(err => {
          console.error('Failed to get user info:', err);
        });
    } else {
      console.log('No OAuth token in URL, checking stored token...');
      // Check for stored token
      const storedToken = localStorage.getItem('google_access_token');
      const storedUser = localStorage.getItem('google_user');
      
      console.log('Stored token found:', storedToken ? 'Yes' : 'No');
      
      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
        console.log('Using stored authentication');
      }
    }
  }, []);

  const login = () => {
    // This will be handled by Google OAuth component
  };

  const logout = () => {
    googleLogout();
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user');
    setIsAuthenticated(false);
    setUser(null);
    setAccessToken(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    accessToken,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
