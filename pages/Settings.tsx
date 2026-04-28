
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LogOut, ChevronRight, UserCircle2, Key, Loader2, RefreshCw
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { UserRole } from '../types';
import { cacheManager } from '../services/cacheManager';

interface SettingsProps {
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const currentUser = authService.getCurrentUser();
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  
  // 团队名称映射表
  const teamNameMap: Record<string, string> = {
    'cuiding': '鼎盛战队',
    'cuijie': '花好月圆战队',
    'huangzhenhui': '四季发财战队'
    // 可以根据需要添加更多映射
  };
  
  // 获取用户对应的团队名称
  const getUserTeamName = () => {
    if (currentUser?.teamName) {
      return currentUser.teamName;
    }
    if (currentUser?.username && teamNameMap[currentUser.username]) {
      return teamNameMap[currentUser.username];
    }
    // 如果都没有，直接返回用户名作为团队名称
    return currentUser?.username || '团队';
  };
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawRecordModal, setShowWithdrawRecordModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState({ lastPushTime: '', lastPushTitle: '', commitVersion: '' });
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayName, setAlipayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawRecords, setWithdrawRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [withdrawEnabled, setWithdrawEnabled] = useState(false);

  // 收益数据状态
  const [earnings, setEarnings] = useState({
    today: 0,
    month: 0,
    lastMonth: 0,
    total: 0,
    availableBalance: 0
  });

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [loadingWithdraw, setLoadingWithdraw] = useState(true);
  const [loadingWithdrawStatus, setLoadingWithdrawStatus] = useState(true);

  // 获取缓存数据
  const getCachedData = (key: string, cacheTime: number = 300000) => { // 默认5分钟缓存
    return cacheManager.get(key, cacheTime);
  };

  // 设置缓存数据
  const setCachedData = (key: string, data: any, cacheTime: number = 300000) => { // 默认5分钟缓存
    cacheManager.set(key, data, cacheTime);
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 6) {
      alert('密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致，请重新输入');
      return;
    }
    setIsUpdating(true);
    try {
      await authService.updatePassword(oldPassword, newPassword);
      setIsUpdating(false);
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('密码修改成功');
    } catch (error) {
      setIsUpdating(false);
      alert('密码修改失败，请稍后重试');
      console.error('Error updating password:', error);
    }
  };

  // 获取版本信息（直接硬编码）
  const fetchVersionInfo = async () => {
    setIsLoadingVersion(true);
    try {
      // 直接设置最新一次推送的时间、标题和Commit版本号
      setVersionInfo({
        lastPushTime: '2026-03-22 18:20:00',
        lastPushTitle: '超管、团队长、组长测试通过',
        commitVersion: '8bfa2a0'
      });
    } catch (error) {
      console.error('获取版本信息失败:', error);
    } finally {
      setIsLoadingVersion(false);
    }
  };

  const handleWithdraw = async () => {
    if (!employeeId || !alipayAccount || !alipayName) {
      alert('请填写员工号、支付宝帐号和姓名');
      return;
    }
    if (!withdrawEnabled) {
      alert('提现功能已关闭');
      return;
    }
    if (earnings.lastMonth <= 0) {
      alert('提现金额必须大于0');
      return;
    }
    setIsWithdrawing(true);
    try {
      // 计算提现金额
      const amount = earnings.lastMonth; // 上月收益（元）

      // 提交提现申请
      // 团队长和组长使用管理员提现接口
      if (isTeamLeader || isGroupLeader) {
        const withdrawData = {
          amount: amount,
          alipayAccount: alipayAccount,
          alipayName: alipayName,
          employeeId: employeeId,
          lastMonthCommission: earnings.lastMonth
        };
        console.log('提交提现请求参数:', withdrawData);
        await request<any>('/withdraw/admin/submit', {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(withdrawData)
        });
      } else {
        // 普通员工使用原接口
        const goldAmount = amount * 1000; // 1元=1000金币
        await request<any>('/withdraw/submit', {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            userId: currentUser?.id || '',
            employeeId: currentUser?.id || '',
            amount: amount,
            goldAmount: goldAmount,
            alipayAccount: alipayAccount,
            alipayName: alipayName
          })
        });
      }
      
      setIsWithdrawing(false);
      setWithdrawSuccess(true);
      // 3秒后自动关闭弹窗
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawSuccess(false);
        setAlipayAccount('');
        setAlipayName('');
      }, 3000);
      // 触发强制刷新，与点击刷新按钮效果一致
      handleRefresh();
    } catch (error) {
      setIsWithdrawing(false);
      alert('网络错误，请稍后重试');
      console.error('Error submitting withdraw request:', error);
    }
  };

  // 获取收益数据
  const fetchEarnings = useCallback(async (isRefresh = false) => {
    // 检查用户是否登录
    if (!currentUser) {
      setLoadingEarnings(false);
      return;
    }
    
    if (!isRefresh) {
      // 检查缓存
      const cacheKey = `earnings_${currentUser?.id || 'unknown'}_${isTeamLeader ? 'team' : isGroupLeader ? 'group' : 'admin'}`;
      const cachedEarnings = getCachedData(cacheKey);
      if (cachedEarnings) {
        setEarnings(cachedEarnings);
        setLoadingEarnings(false);
        return;
      }
    }
    
    try {
      // 团队长获取自己团队的收益数据
      if (isTeamLeader) {
        // 使用新的团队长收益数据接口
        const revenueResponse = await request<any>('/admin/dashboard/team-leader/commission', {
          method: 'GET'
        });
        
        console.log('[Settings] 团队长收益接口返回数据:', revenueResponse);
        console.log('[Settings] 接口返回字段:', Object.keys(revenueResponse || {}));
        
        // 直接使用后端返回的数据，支持多种可能的字段名
        const earningsData = {
          today: revenueResponse.today || revenueResponse.todayCommission || revenueResponse.todayEarnings || 0,
          month: revenueResponse.month || revenueResponse.monthCommission || revenueResponse.monthEarnings || 0,
          lastMonth: revenueResponse.lastMonth || revenueResponse.lastMonthCommission || revenueResponse.lastMonthEarnings || revenueResponse.last_month || 0,
          total: revenueResponse.total || revenueResponse.totalCommission || revenueResponse.totalEarnings || 0,
          availableBalance: revenueResponse.availableBalance || revenueResponse.lastMonth || revenueResponse.lastMonthCommission || 0
        };
        
        console.log('[Settings] 团队长最终收益数据:', earningsData);
        
        setEarnings(earningsData);
        
        // 缓存数据
        const cacheKey = `earnings_${currentUser?.id || 'unknown'}_team`;
        setCachedData(cacheKey, earningsData);
      } else if (currentUser?.role === UserRole.GROUP_LEADER) {
        // 组长获取自己组的收益数据
        // 使用新的组长提成统计接口
        const response = await request<any>('/group-leader/commission-stats', {
          method: 'GET'
        });
        
        console.log('Group leader commission stats:', response);
        
        // 从API响应中提取提成数据
        const todayEarnings = Number(response.today?.totalCommission || 0);
        const monthEarnings = Number(response.month?.totalCommission || 0);
        const lastMonthEarnings = Number(response.lastMonth?.totalCommission || 0);
        const totalEarnings = Number(response.all?.totalCommission || 0);
        console.log('Calculated group earnings:', { todayEarnings, monthEarnings, lastMonthEarnings, totalEarnings });

        const earningsData = {
          today: todayEarnings,
          month: monthEarnings,
          lastMonth: lastMonthEarnings,
          total: totalEarnings,
          availableBalance: lastMonthEarnings
        };
        
        setEarnings(earningsData);
        
        // 缓存数据
        const cacheKey = `earnings_${currentUser?.id || 'unknown'}_group`;
        setCachedData(cacheKey, earningsData);
      } else {
        // 超级管理员获取全局数据
        const todayResponse = await request<any>('/admin/dashboard/kpi?range=today', {
          method: 'GET'
        });
        
        const monthResponse = await request<any>('/admin/dashboard/kpi?range=month', {
          method: 'GET'
        });
        
        // 获取上月累计金币
        const lastMonthResponse = await request<any>('/admin/dashboard/kpi?range=lastMonth', {
          method: 'GET'
        });

        // 获取累计金币
        const totalResponse = await request<any>('/admin/dashboard/kpi?range=all', {
          method: 'GET'
        });

        console.log('Admin responses:', { todayResponse, monthResponse, lastMonthResponse, totalResponse });
        const todayUserShare = Number(todayResponse?.coins || 0) / 1000;
        const monthUserShare = Number(monthResponse?.coins || 0) / 1000;
        const lastMonthUserShare = Number(lastMonthResponse?.coins || 0) / 1000;
        const totalUserShare = Number(totalResponse?.coins || 0) / 1000;
        console.log('Calculated admin coins:', { todayUserShare, monthUserShare, lastMonthUserShare, totalUserShare });

        const earningsData = {
          today: todayUserShare * 0.2,
          month: monthUserShare * 0.2,
          lastMonth: lastMonthUserShare * 0.2,
          total: totalUserShare * 0.2,
          availableBalance: lastMonthUserShare * 0.2
        };
        
        setEarnings(earningsData);
        
        // 缓存数据
        const cacheKey = `earnings_${currentUser?.id || 'unknown'}_admin`;
        setCachedData(cacheKey, earningsData);
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      // 保持当前数据，不设置为0，避免数据闪烁
    } finally {
      setLoadingEarnings(false);
    }
  }, [isTeamLeader, currentUser, isGroupLeader]);

  // 获取提现记录
  const fetchWithdrawRecords = useCallback(async (isRefresh = false) => {
    if (!currentUser?.username) {
      setLoadingWithdraw(false);
      return;
    }
    
    if (!isRefresh) {
      // 检查缓存
      const cacheKey = `withdraw_records_${currentUser.username}`;
      const cachedRecords = getCachedData(cacheKey, 60000); // 1分钟缓存
      if (cachedRecords) {
        setWithdrawRecords(cachedRecords);
        setLoadingWithdraw(false);
        return;
      }
    }
    
    setIsLoadingRecords(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/list?userId=${currentUser.username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setWithdrawRecords(result.data || []);
        
        // 缓存数据
        const cacheKey = `withdraw_records_${currentUser.username}`;
        setCachedData(cacheKey, result.data || [], 60000); // 1分钟缓存
      } else {
        setWithdrawRecords([]);
      }
    } catch (error) {
      console.error('Error fetching withdraw records:', error);
      setWithdrawRecords([]);
    } finally {
      setIsLoadingRecords(false);
      setLoadingWithdraw(false);
    }
  }, [currentUser?.username]);

  // 加载提现开关状态（使用后端实际接口）
  useEffect(() => {
    if (!currentUser) {
      setLoadingWithdrawStatus(false);
      return;
    }
    
    // 使用缓存，避免频繁请求
    const cacheKey = `withdraw_status`;
    const cached = getCachedData(cacheKey);
    if (cached !== null) {
      setWithdrawEnabled(cached);
      setLoadingWithdrawStatus(false);
      return;
    }
    
    const fetchStatus = async () => {
      try {
        const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/settings/withdraw-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        const result = JSON.parse(text);
        const enabledValue = result?.enabled?.enabled;
        const isEnabled = enabledValue === true || enabledValue === 'true' || enabledValue === 1 || enabledValue === '1';
        setWithdrawEnabled(isEnabled);
        setCachedData(cacheKey, isEnabled, 1800000); // 30分钟缓存
      } catch (err) {
        console.error('获取提现状态失败:', err);
        setWithdrawEnabled(true);
      } finally {
        setLoadingWithdrawStatus(false);
      }
    };
    
    fetchStatus();
  }, [currentUser]);
  


  useEffect(() => {
    if (currentUser) {
      // 重置加载状态
      setLoading(true);
      setLoadingEarnings(true);
      setLoadingWithdraw(true);
      setLoadingWithdrawStatus(true);
      
      // 并行执行所有数据获取操作，提高加载速度
      Promise.allSettled([
        fetchEarnings(),
        fetchWithdrawRecords()
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [currentUser]);
  


  // 刷新数据
  const handleRefresh = useCallback(async () => {
    // 重置加载状态
    setLoading(true);
    setLoadingEarnings(true);
    setLoadingWithdraw(true);
    
    // 清空缓存
    cacheManager.clear();
    
    // 重新请求所有数据
    await Promise.allSettled([
      fetchEarnings(true),
      fetchWithdrawRecords(true)
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchEarnings, fetchWithdrawRecords]);

  const sections = [
    {
      title: '账户管理',
      items: [
        { label: '修改密码', icon: Key, color: 'text-blue-500 bg-blue-50', onClick: () => setShowPasswordModal(true) },
        ...(isSuperAdmin ? [{ label: '关于版本', icon: ChevronRight, color: 'text-gray-500 bg-gray-50', onClick: async () => { await fetchVersionInfo(); setShowVersionModal(true); } }] : [])
      ]
    }
  ];

  return (
    <div className="pb-6">
      <div className="bg-[#1E40AF] pt-12 pb-16 px-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl overflow-hidden">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 size={40} className="text-white" />
                )}
            </div>
            <div>
                <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black">{currentUser?.username || 'Admin Pro'}</h2>
                    {!isGroupLeader && (
                    <span className="text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full backdrop-blur-sm border border-white/20 uppercase shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      {isSuperAdmin ? '超级管理员' : isTeamLeader ? getUserTeamName() : '普通管理员'}
                    </span>
                    )}
                </div>

            </div>
          </div>
          
          {/* 刷新按钮 - 只在非组长和非团队长角色显示 */}
          {!isGroupLeader && !isTeamLeader && (
            <button
              onClick={handleRefresh}
              className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-6">
        {/* 我的收益板块 - 仅对团队长和组长显示 */}
        {!isSuperAdmin && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
            <div className="flex items-center justify-center gap-2 mb-4">
              <h3 className="text-sm font-black text-gray-900">我的收益（元）</h3>
              <button
                onClick={() => {
                  handleRefresh();
                }}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center"
                title="刷新收益数据"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">今日预估收益</div>
                <div className="text-xl font-black text-blue-600">¥{earnings.today.toFixed(2)}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">本月预估收益</div>
                <div className="text-xl font-black text-green-600">¥{earnings.month.toFixed(2)}</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">上月收益</div>
                  <button
                    onClick={() => {
                      if (withdrawEnabled) {
                        setShowWithdrawModal(true);
                      }
                    }}
                    disabled={!withdrawEnabled}
                    className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all border flex items-center gap-1 ${
                      withdrawEnabled
                        ? 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 border-blue-500/30 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    提现
                  </button>
                </div>
                <div className="text-xl font-black text-purple-600">¥{earnings.availableBalance.toFixed(2)}</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">累计收益</div>
                <div className="text-xl font-black text-orange-600">¥{earnings.total.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 提现记录板块 - 仅对团队长和组长显示 */}
        {!isSuperAdmin && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
            <h3 className="text-sm font-black text-gray-900 mb-4">提现记录</h3>
            {isLoadingRecords ? (
              <div className="p-4 text-center">
                <Loader2 size={16} className="animate-spin inline-block text-gray-400" />
                <span className="ml-2 text-[10px] text-gray-400">加载中...</span>
              </div>
            ) : withdrawRecords.length > 0 ? (
              <div className="space-y-3">
                {withdrawRecords.map((record, index) => {
                  const statusStyle = (() => {
                    switch (record.status) {
                      case 0:
                        return { text: '待打款', className: 'text-amber-600 bg-amber-50', amountColor: 'text-amber-600' };
                      case 1:
                        return { text: '已打款', className: 'text-emerald-600 bg-emerald-50', amountColor: 'text-emerald-600' };
                      case 2:
                        return { text: '已拒绝', className: 'text-red-600 bg-red-50', amountColor: 'text-red-600' };
                      default:
                        return { text: record.statusText || '未知状态', className: 'text-gray-600 bg-gray-50', amountColor: 'text-gray-600' };
                    }
                  })();
                  return (
                    <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-500 mb-1">支付宝：{record.alipayAccount}</div>
                        <div className="text-[10px] text-gray-500 mb-1">姓名：{record.alipayName}</div>
                        <div className="text-[10px] text-gray-400">{new Date(record.createTime).toLocaleString('zh-CN')}</div>
                        {record.goldAmount > 0 && (
                          <div className="mt-1 text-[10px] text-gray-400">扣除金币：{record.goldAmount} 金币</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4">
                        <div className={`text-sm font-bold ${statusStyle.amountColor}`}>¥{record.amount.toFixed(2)}</div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.className}`}>
                          {statusStyle.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-gray-300 mb-2">暂无提现记录</div>
                <div className="text-[10px] text-gray-400">点击上月收益的提现按钮申请提现</div>
              </div>
            )}
          </div>
        )}

        {/* Menu Sections */}
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-[10px] font-black text-gray-400 px-2 uppercase tracking-widest">{section.title}</h3>
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50">
                {section.items.map((item, itemIdx) => (
                  <button 
                    key={itemIdx} 
                    onClick={item.onClick}
                    className={`w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors ${
                        itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${item.color}`}>
                            <item.icon size={18} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-500 rounded-3xl shadow-sm border border-gray-100 active:bg-red-50 active:border-red-100 transition-all font-black text-sm mt-4"
        >
            <LogOut size={20} className="mr-2" />
            退出当前账号
        </button>
        
        <div className="text-center py-6">
            <p className="text-[10px] text-gray-300 font-medium">© 2026 光年智慧中台</p>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">修改登录密码</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">旧密码</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请输入旧密码"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">新密码</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">确认新密码</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请再次输入新密码"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => {
                    setShowPasswordModal(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 rounded-2xl active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdating}
                  className="flex-1 py-3 text-xs font-black text-white bg-[#1E40AF] rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center">
              申请提现
            </h3>
            <div className="space-y-5">
              {withdrawSuccess ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">提现申请已提交</h4>
                  <p className="text-sm text-gray-500">财务将在3个工作日内处理</p>
                </div>
              ) : (
                <>
                  {/* 可提现金额 */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">可提现金额</div>
                    <div className="text-3xl font-bold text-purple-700">¥{earnings.availableBalance.toFixed(2)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">平台帐号</label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入平台帐号"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">支付宝帐号</label>
                    <input
                      type="text"
                      value={alipayAccount}
                      onChange={(e) => setAlipayAccount(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入支付宝账号"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">支付宝姓名</label>
                    <input
                      type="text"
                      value={alipayName}
                      onChange={(e) => setAlipayName(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入支付宝实名姓名"
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center">提现申请将在1～3个工作日内处理</p>
                </>
              )}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawSuccess(false);
                    setEmployeeId('');
                    setAlipayAccount('');
                    setAlipayName('');
                  }}
                  className="flex-1 py-4 text-sm font-semibold text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all duration-200"
                >
                  {withdrawSuccess ? '关闭' : '取消'}
                </button>
                {!withdrawSuccess && (
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !employeeId.trim() || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0}
                    className={`flex-1 py-4 text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center ${
                      isWithdrawing || !employeeId.trim() || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:shadow-lg'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : '提交提现申请'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Record Modal */}
      {showWithdrawRecordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              提现记录
            </h3>
            <div className="space-y-4">
              {isLoadingRecords ? (
                <div className="p-8 text-center">
                  <Loader2 size={20} className="animate-spin inline-block text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">加载中...</span>
                </div>
              ) : withdrawRecords.length > 0 ? (
                <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
                  {withdrawRecords.map((record, index) => {
                    const statusStyle = (() => {
                      switch (record.status) {
                        case 0:
                          return { text: '提现成功', className: 'text-emerald-600 bg-emerald-50' };
                        case 1:
                          return { text: '已通过', className: 'text-blue-600 bg-blue-50' };
                        case 2:
                          return { text: '已拒绝', className: 'text-red-600 bg-red-50' };
                        default:
                          return { text: record.statusText || '未知状态', className: 'text-gray-600 bg-gray-50' };
                      }
                    })();
                    return (
                      <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-bold text-gray-900">¥{record.amount.toFixed(2)}</div>
                          <div className={`text-xs font-bold px-3 py-1 rounded-full ${statusStyle.className}`}>
                            {statusStyle.text}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                          <div>扣除金币：{record.goldAmount} 金币</div>
                          <div>申请时间：{new Date(record.createTime).toLocaleString('zh-CN')}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-sm text-gray-500">
                          <div>支付宝：{record.alipayAccount}</div>
                          <div>姓名：{record.alipayName}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">暂无提现记录</h4>
                  <p className="text-sm text-gray-500">点击上月收益的提现按钮申请提现</p>
                </div>
              )}
              <div className="pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawRecordModal(false);
                  }}
                  className="w-full py-4 text-sm font-semibold text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all duration-200"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Info Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">关于版本</h3>
            <div className="space-y-4">
              {isLoadingVersion ? (
                <div className="p-8 text-center">
                  <Loader2 size={16} className="animate-spin inline-block text-gray-400" />
                  <span className="ml-2 text-[10px] text-gray-400">加载中...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">最近推送时间</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.lastPushTime}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">推送标题</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.lastPushTitle}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Commit版本号</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.commitVersion}</div>
                  </div>
                </div>
              )}
              <div className="pt-4">
                <button
                  onClick={() => {
                    setShowVersionModal(false);
                  }}
                  className="w-full py-3 text-xs font-bold text-white bg-[#1E40AF] rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
