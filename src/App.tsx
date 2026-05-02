import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { DriveProvider } from './contexts/DriveContext';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  if (!googleClientId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuration Required</h1>
          <p className="text-gray-600">Please copy .env.example to .env and add your Google Client ID</p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <DriveProvider>
          <Layout />
        </DriveProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
