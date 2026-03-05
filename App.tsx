
import React, { useState, useEffect } from 'react';
import { AppTab, UserRole } from './types';
import Dashboard from './pages/Dashboard';
import UserList from './pages/UserList';
import NewUsers from './pages/NewUsers';
import Team from './pages/Team';
import Alerts from './pages/Alerts';
import UserDetail from './pages/UserDetail';
import Management from './pages/Management';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);

  useEffect(() => {
    // Check authentication on mount
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveTab(AppTab.DASHBOARD);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const currentUser = authService.getCurrentUser();

  const renderContent = () => {
    // Priority 1: Individual User Detail
    if (selectedUser) {
      return <UserDetail user={selectedUser} onBack={() => setSelectedUser(null)} />;
    }

    // Priority 2: All Users Secondary Page
    if (showAllUsers) {
      return <UserList onBack={() => setShowAllUsers(false)} onSelectUser={(user) => {
        setShowAllUsers(false);
        setSelectedUser(user);
      }} />;
    }

    // Default: Main Tabs
    switch (activeTab) {
      case AppTab.DASHBOARD:
        return (
          <Dashboard 
            onSelectUser={(user) => setSelectedUser(user)} 
            onViewAllUsers={() => setShowAllUsers(true)}
          />
        );
      case AppTab.NEW_USERS:
        return (
          <NewUsers 
            onSelectUser={(user) => setSelectedUser(user)} 
          />
        );
      case AppTab.TEAM:
        return <Team />;
      case AppTab.MANAGEMENT:
        return <Management />;
      case AppTab.ALERTS:
        return <Alerts />;
      case AppTab.PROFILE:
        return <Settings onLogout={handleLogout} />;
      default:
        return (
          <Dashboard 
            onSelectUser={(user) => setSelectedUser(user)} 
            onViewAllUsers={() => setShowAllUsers(true)} 
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
        {renderContent()}
      </main>

      {/* Persistent Bottom Navigation - hidden when in detail view or secondary view */}
      {!selectedUser && !showAllUsers && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
};

export default App;
