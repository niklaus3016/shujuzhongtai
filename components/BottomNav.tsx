import React from 'react';
import { AppTab, UserRole } from '../types';
import { Home, ShieldAlert, UserPlus, Users2, User, Settings, Users, Layers, UserCircle, Building2 } from 'lucide-react';
import { authService } from '../services/authService';

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const currentUser = authService.getCurrentUser();
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  // 根据角色定义不同的菜单项
  const getTabs = () => {
    if (isSuperAdmin) {
      // 超级管理员：隐藏预警模块
      return [
        { id: AppTab.DASHBOARD, icon: Home, label: '首页' },
        { id: AppTab.NEW_USERS, icon: UserPlus, label: '新人' },
        { id: AppTab.TEAM, icon: Users, label: '团队' },
        { id: AppTab.MANAGEMENT, icon: Settings, label: '管理' },
        { id: AppTab.PROFILE, icon: User, label: '我的' },
      ];
    } else if (isTeamLeader) {
      // 团队长：隐藏管理模块和预警模块，添加组管理
      return [
        { id: AppTab.DASHBOARD, icon: Home, label: '首页' },
        { id: AppTab.NEW_USERS, icon: UserPlus, label: '新人' },
        { id: AppTab.GROUP_MANAGEMENT, icon: Building2, label: '团队' },
        { id: AppTab.TEAM, icon: UserCircle, label: '帐号' },
        { id: AppTab.PROFILE, icon: User, label: '我的' },
      ];
    } else if (isGroupLeader) {
      // 组长：简化菜单，只显示首页和我的
      return [
        { id: AppTab.DASHBOARD, icon: Home, label: '首页' },
        { id: AppTab.TEAM, icon: Users2, label: '组员' },
        { id: AppTab.PROFILE, icon: User, label: '我的' },
      ];
    }
    // 默认显示所有菜单，隐藏预警模块
    return [
      { id: AppTab.DASHBOARD, icon: Home, label: '首页' },
      { id: AppTab.NEW_USERS, icon: UserPlus, label: '新人' },
      { id: AppTab.TEAM, icon: Users, label: '团队' },
      { id: AppTab.MANAGEMENT, icon: Settings, label: '管理' },
      { id: AppTab.PROFILE, icon: User, label: '我的' },
    ];
  };

  const tabs = getTabs();

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
