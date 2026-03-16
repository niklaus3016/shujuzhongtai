
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
import GroupLeaderManagement from './pages/GroupLeaderManagement';
import GroupManagement from './pages/GroupManagement';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const mainRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check authentication on mount
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  useEffect(() => {
    // Reset scroll position when navigating between pages
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
    }, 10);
  }, [selectedUser, showAllUsers, activeTab]);

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
      return <UserDetail key={`user-${selectedUser.id}`} user={selectedUser} onBack={() => setSelectedUser(null)} />;
    }

    // Priority 2: All Users Secondary Page
    if (showAllUsers) {
      return <UserList key="user-list" onBack={() => setShowAllUsers(false)} onSelectUser={(user) => {
        setShowAllUsers(false);
        setSelectedUser(user);
      }} />;
    }

    // Default: Main Tabs
    switch (activeTab) {
      case AppTab.DASHBOARD:
        return (
          <Dashboard 
            key="dashboard"
            onSelectUser={(user) => setSelectedUser(user)} 
            onViewAllUsers={() => setShowAllUsers(true)}
          />
        );
      case AppTab.NEW_USERS:
        return (
          <NewUsers 
            key="new-users"
            onSelectUser={(user) => setSelectedUser(user)} 
          />
        );
      case AppTab.TEAM:
        return <Team key="team" />;
      case AppTab.MANAGEMENT:
        return <Management key="management" />;
      case AppTab.ALERTS:
        return <Alerts key="alerts" onSelectUser={(user) => setSelectedUser(user)} />;
      case AppTab.PROFILE:
        return <Settings key="settings" onLogout={handleLogout} />;
      case AppTab.GROUP_LEADER_MANAGEMENT:
        return <GroupLeaderManagement key="group-leader-management" />;
      case AppTab.GROUP_MANAGEMENT:
        return <GroupManagement key="group-management" />;
      default:
        return (
          <Dashboard 
            key="dashboard"
            onSelectUser={(user) => setSelectedUser(user)} 
            onViewAllUsers={() => setShowAllUsers(true)} 
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] max-w-md mx-auto relative overflow-hidden shadow-2xl">
      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 overflow-y-auto pt-7 pb-24 hide-scrollbar">
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
