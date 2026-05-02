import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import ChatInterface from './ChatInterface';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {isAuthenticated && <Sidebar />}
        <ChatInterface />
      </div>
    </div>
  );
};

export default Layout;
