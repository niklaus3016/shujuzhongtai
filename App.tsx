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
import GroupLeader from './pages/GroupLeader';
import GroupLeaderPerformance from './pages/GroupLeaderPerformance';
import TeamLeaderPerformance from './pages/TeamLeaderPerformance';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import { authService } from './services/authService';
import { addViewGroupLeaderPerfListener, type ViewGroupLeaderTarget } from './utils/viewGroupLeaderPerformance';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [viewingGroupLeader, setViewingGroupLeader] = useState<ViewGroupLeaderTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('today');
  const mainRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check authentication on mount
    setTimeout(() => {
      try {
        setIsAuthenticated(authService.isAuthenticated());
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  // 顶层级全局跳转：所有页面的「查看组长业绩」按钮（哪怕嵌入页没收到回调 prop），
  // 都会发一个全局 CustomEvent → 这里统一打开副页栈，解决「按钮蓝但点击不跳」。
  useEffect(() => {
    const off = addViewGroupLeaderPerfListener((t) => {
      console.debug('[App:glp-event] received', t);
      setViewingGroupLeader(t);
    });
    return off;
  }, []);

  useEffect(() => {
    // Reset scroll position when navigating between pages
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
      }
    }, 10);
  }, [selectedUser, showAllUsers, viewingGroupLeader, activeTab]);

  // 切底栏 Tab 时，关闭所有"详情副页"（用户详情 / 全用户列表 / 组长业绩副页），避免 Tab 切回时停留在旧副页
  useEffect(() => {
    setSelectedUser(null);
    setShowAllUsers(false);
    setViewingGroupLeader(null);
  }, [activeTab]);

  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setActiveTab(AppTab.DASHBOARD);
    // 登录成功后立即获取用户信息，避免Dashboard组件重复获取
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 如果currentUser为null，获取一次
  if (!currentUser) {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }

  const renderContent = () => {
    // Priority 1: Individual User Detail
    if (selectedUser) {
      return <UserDetail key={`user-${selectedUser.id}`} user={selectedUser} onBack={() => setSelectedUser(null)} />;
    }

    // Priority 1.5: 团队长/超管点「业绩▸」进入的某组长/团队长业绩详情副页
    // ===================== [Bug2 修复：分发规则改变] =====================
    // 根因（2026-07-13 实测）：
    //   • /team-leader/performance 只允许"本人 JWT 本人看"，view-as-other 一律 403 → 全 0 数据
    //   • /group-leader/performance 有兼容分支：NORMAL_ADMIN(TL) → "ok（NORMAL_ADMIN兼容分支）"
    //       GROUP_LEADER(GL) → 正常返回，**view-as-other 双角色都支持**
    // 所以：只要是 viewingGroupLeader 副页（view-as-other 模式，不管目标角色 TL/GL）
    //       → 100% 统一分发到 GroupLeaderPerformance 组件，不再分发 TeamLeaderPerformance
    // （self 模式底栏业绩页，各角色仍按原分发走 TLP/GLP，不动）
    if (viewingGroupLeader) {
      const { groupLeaderRole, commission, groupLeaderId, groupLeaderName, fromGroupName, idBag } = viewingGroupLeader;
      const norm = (s: any) => typeof s === 'string' ? s.trim().toUpperCase().replace(/_/g, '') : '';
      const roleNorm = norm(groupLeaderRole);
      const superNorm = norm(UserRole.SUPER_ADMIN);
      const tlNorm = norm(UserRole.NORMAL_ADMIN);
      const glNorm = norm(UserRole.GROUP_LEADER);
      const isSuper = roleNorm === superNorm || roleNorm === 'SUPERADMIN' || roleNorm === 'SUPERADMINISTRATOR' || roleNorm === 'SA';
      const isTL =
        roleNorm === tlNorm || roleNorm === 'NORMALADMIN' || roleNorm === 'TEAMLEADER' || roleNorm === 'TL' || isSuper;
      const isGL = roleNorm === glNorm || roleNorm === 'GROUPLEADER' || roleNorm === 'GL';
      // 兜底：角色字段缺失/模糊时用 commission；命中 GL 的绝不能被 commission >= 0.08 误分
      const finalIsTL = isGL ? false : isTL || (!roleNorm && typeof commission === 'number' && commission >= 0.08);

      // [排障埋点] 显示：目标原始角色/归一化后角色/分发组件（强制=GLP view-as-other兼容分支）
      const _dbg = {
        target: `${groupLeaderName} @ ${fromGroupName}`,
        id: groupLeaderId,
        rawRole: groupLeaderRole ?? null,
        normalizedRole: roleNorm || '(empty)',
        commission: commission ?? null,
        isSuper, isTL, isGL,
        finalIsTL,
        component: 'GroupLeaderPerformance (view-as-other兼容分支: TL+GL双角色都走这里)',
        idBag: idBag ?? null,
        rootCauseFixed: '/team-leader/performance view-as-other→403，改用/group-leader/performance兼容分支',
      };
      console.log('%c[App:glp-dispatch] 点击业绩按钮分发结果', 'background:#10b981;color:#fff;padding:2px 6px;border-radius:4px;', _dbg);

      const handleBack = () => setViewingGroupLeader(null);
      const viewKey = viewingGroupLeader.groupLeaderId;

      // ===== Bug2 修复：view-as-other 副页全部走 GroupLeaderPerformance 组件 =====
      // GroupLeaderPerformance 内部会按 mode='view-as-other' + makeGLPRequestUrl 构造 /group-leader/performance
      //   → 后端 resolveTargetAdmin 命中目标后，TL 走兼容分支、GL 走正常分支，都返回数据（不再 403）
      return (
        <GroupLeaderPerformance
          key={`glp-view-${viewKey}`}
          mode="view-as-other"
          target={viewingGroupLeader}
          onBack={handleBack}
        />
      );
    }

    // Priority 2: All Users Secondary Page
    if (showAllUsers) {
      return <UserList key="user-list" timeRange={timeRange} onBack={() => setShowAllUsers(false)} onSelectUser={(user) => {
        // 不设置 setShowAllUsers(false)，保留用户列表状态，以便从用户详情返回时能回到用户列表
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
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            currentUser={currentUser}
          />
        );
      case AppTab.NEW_USERS:
        return (
          <NewUsers 
            key="new-users"
            onSelectUser={(user) => setSelectedUser(user)} 
          />
        );
      case AppTab.TEAM: {
        // 超管/高管底栏「团队」直接渲染 GroupManagement（与团队长底栏「团队」结构 100% 一致）
        // 团队长（NORMAL_ADMIN）/组长（GROUP_LEADER）保持原 Team.tsx 逻辑（账号管理 / 我的组员）一字不动
        // ⚠️ 大小写都归一化再比：枚举 SUPER_ADMIN='superadmin'(全小写)，实际接口有 'SUPER_ADMIN'/'SUPERADMIN' 多种写法
        const roleRaw = currentUser?.role ? String(currentUser.role).trim() : '';
        const roleUp = roleRaw.toUpperCase().replace(/_/g, '');
        const enumSuperUp = String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '');
        const enumAdminManagerUp = String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '');
        const isSuper =
          roleUp === enumSuperUp ||
          roleUp === 'SUPERADMIN' ||
          roleUp === 'SUPERADMINISTRATOR' ||
          roleUp === enumAdminManagerUp;
        if (isSuper) {
          return (
            <GroupManagement
              key={`group-management-sa-${Date.now()}`}
              onViewGroupLeaderPerformance={(t) => setViewingGroupLeader(t)}
            />
          );
        }
        return <Team key={`team-${Date.now()}`} />;
      }
      case AppTab.MANAGEMENT:
        return <Management key="management" />;
      case AppTab.ALERTS:
        return <Alerts key="alerts" onSelectUser={(user) => setSelectedUser(user)} />;
      case AppTab.PROFILE:
        return <Settings key="settings" onLogout={handleLogout} />;
      case AppTab.GROUP_LEADER_MANAGEMENT:
        return <GroupLeaderManagement key={`group-leader-management-${Date.now()}`} />;
      case AppTab.GROUP_MANAGEMENT:
        return currentUser?.role === UserRole.GROUP_LEADER ? (
          <GroupLeader key={`group-leader-${Date.now()}`} timeRange={timeRange} onRefresh={() => {}} />
        ) : (
          <GroupManagement
            key={`group-management-${Date.now()}`}
            onViewGroupLeaderPerformance={(t) => setViewingGroupLeader(t)}
          />
        );
      case AppTab.PERFORMANCE:
        // 业绩页：按角色分发
        if (currentUser?.role === UserRole.GROUP_LEADER) {
          return <GroupLeaderPerformance key={`group-leader-performance-${Date.now()}`} mode="self" />;
        }
        if (currentUser?.role === UserRole.NORMAL_ADMIN) {
          return <TeamLeaderPerformance key={`team-leader-performance-${Date.now()}`} />;
        }
        // 其他角色误入时回退到 Dashboard
        return (
          <Dashboard
            key="dashboard-fallback"
            onSelectUser={(user) => setSelectedUser(user)}
            onViewAllUsers={() => setShowAllUsers(true)}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            currentUser={currentUser}
          />
        );
      default:
        return (
          <Dashboard 
            key="dashboard"
            onSelectUser={(user) => setSelectedUser(user)} 
            onViewAllUsers={() => setShowAllUsers(true)}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            currentUser={currentUser}
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
      {!selectedUser && !showAllUsers && !viewingGroupLeader && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
};

export default App;