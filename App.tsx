
import React, { useState, useEffect } from 'react';
import { AppTab, UserRole } from './types';
import Dashboard from './pages/Dashboard';
import UserList from './pages/UserList';
import NewUsers from './pages/NewUsers';
import Team from './pages/Team';
import Alerts from './pages/Alerts';
import UserDetail from './pages/UserDetail';
import Management from './pages/Management';
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
        return (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1E40AF]">
                <span className="text-2xl font-black">{currentUser?.username.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900">{currentUser?.username}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  {currentUser?.role === UserRole.SUPER_ADMIN ? '超级管理员' : '团队长'}
                </p>
              </div>
            </div>

            {currentUser?.role === UserRole.NORMAL_ADMIN && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg shadow-blue-100">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">我的提成 (20%)</p>
                <h3 className="text-3xl font-black">¥ {currentUser.commission?.toLocaleString()}</h3>
                <p className="text-[10px] mt-2 opacity-70 font-medium">提成基于下级员工总金币自动计算</p>
              </div>
            )}

            <div className="space-y-2">
              <button 
                onClick={handleLogout}
                className="w-full py-4 bg-red-50 text-red-500 font-black rounded-2xl border border-red-100 active:scale-[0.98] transition-all"
              >
                退出登录
              </button>
            </div>
          </div>
        );
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
