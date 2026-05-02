import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Handle OAuth callback from popup
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    
    const accessToken = params.get('access_token');
    const error = params.get('error');
    
    if (error) {
      console.error('OAuth error:', error);
      window.close();
      return;
    }
    
    if (accessToken) {
      // Get user info
      fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`)
        .then(response => response.json())
        .then(user => {
          // Send success message to parent window
          window.opener?.postMessage({
            type: 'google-auth-success',
            accessToken,
            user
          }, window.location.origin);
          
          window.close();
        })
        .catch(err => {
          console.error('Failed to get user info:', err);
          window.close();
        });
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
