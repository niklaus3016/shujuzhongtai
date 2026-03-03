import React from 'react';
import { AppTab } from '../types';
import { Home, ShieldAlert, UserPlus, Users2, User, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: AppTab.DASHBOARD, icon: Home, label: '首页' },
    { id: AppTab.NEW_USERS, icon: UserPlus, label: '新人' },
    { id: AppTab.TEAM, icon: Users2, label: '团队' },
    { id: AppTab.MANAGEMENT, icon: Settings, label: '管理' },
    { id: AppTab.ALERTS, icon: ShieldAlert, label: '预警' },
    { id: AppTab.PROFILE, icon: User, label: '我的' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 px-2 pt-2 pb-5 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center space-y-0.5 py-1 transition-all ${
              isActive ? 'text-[#1E40AF]' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
