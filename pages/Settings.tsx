
import React, { useState, useEffect } from 'react';
import { 
  LogOut, ChevronRight, UserCircle2, Mail, Key, Loader2, Copy
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { UserRole } from '../types';

interface SettingsProps {
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const currentUser = authService.getCurrentUser();
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawRecordModal, setShowWithdrawRecordModal] = useState(false);
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayName, setAlipayName] = useState('');
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
    total: 0
  });

  const handleUpdatePassword = async () => {
    if (!newPassword || !currentUser) return;
    if (newPassword.length < 6) {
      alert('密码长度不能少于6位');
      return;
    }
    setIsUpdating(true);
    try {
      await authService.updatePassword(currentUser.id, newPassword);
      setIsUpdating(false);
      setShowPasswordModal(false);
      setNewPassword('');
      alert('密码修改成功');
    } catch (error) {
      setIsUpdating(false);
      alert('密码修改失败，请稍后重试');
      console.error('Error updating password:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!alipayAccount || !alipayName) {
      alert('请填写支付宝帐号和姓名');
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
      // 计算提现金额和金币数
      const amount = earnings.lastMonth; // 上月收益（元）
      const goldAmount = amount * 1000; // 1元=1000金币

      // 提交提现申请
      const result = await request<any>('/withdraw/submit', {
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
      
      setIsWithdrawing(false);
      setWithdrawSuccess(true);
      // 3秒后自动关闭弹窗
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawSuccess(false);
        setAlipayAccount('');
        setAlipayName('');
      }, 3000);
      // 更新收益数据和提现记录
      fetchEarnings();
      fetchWithdrawRecords();
    } catch (error) {
      setIsWithdrawing(false);
      alert('网络错误，请稍后重试');
      console.error('Error submitting withdraw request:', error);
    }
  };

  // 获取收益数据
  const fetchEarnings = async () => {
    try {
      // 团队长获取自己团队的收益数据
      if (isTeamLeader) {
        // 即使 currentUser 中没有 teamName 字段，也使用默认团队名称
        const teamName = currentUser?.teamName || '鼎盛战队';
        
        // 使用request函数统一处理API请求
        // 获取团队今日数据
        const todayResponse = await request<any>(`/dashboard/kpi?range=today&team=${encodeURIComponent(teamName)}`, {
          method: 'GET'
        });
        
        // 获取团队本月数据
        const monthResponse = await request<any>(`/dashboard/kpi?range=month&team=${encodeURIComponent(teamName)}`, {
          method: 'GET'
        });
        
        // 获取团队内用户上月累计金币
        const lastMonthResponse = await request<any>(`/team/last-month-coins?team=${encodeURIComponent(teamName)}`, {
          method: 'GET'
        });

        // 获取团队累计金币
        const totalResponse = await request<any>(`/dashboard/kpi?range=all&team=${encodeURIComponent(teamName)}`, {
          method: 'GET'
        });

        // 计算收益 - 团队长收益 = 团队金币 * 20%
        console.log('Team responses:', { todayResponse, monthResponse, lastMonthResponse, totalResponse });
        const todayTeamCoins = Number(todayResponse?.coins || 0) / 1000;
        const monthTeamCoins = Number(monthResponse?.coins || 0) / 1000;
        const lastMonthTeamCoins = Number(lastMonthResponse?.coins || 0) / 1000;
        const totalTeamCoins = Number(totalResponse?.coins || 0) / 1000;
        console.log('Calculated coins:', { todayTeamCoins, monthTeamCoins, lastMonthTeamCoins, totalTeamCoins });

        setEarnings({
          today: todayTeamCoins * 0.2,
          month: monthTeamCoins * 0.2,
          lastMonth: lastMonthTeamCoins * 0.2,
          total: totalTeamCoins * 0.2
        });
      } else if (currentUser?.role === UserRole.GROUP_LEADER) {
        // 组长获取自己组的收益数据
        const teamGroupId = currentUser?.teamGroupId;
        
        // 使用request函数统一处理API请求
        // 获取组今日数据
        const todayResponse = await request<any>(`/dashboard/kpi?range=today&group=${encodeURIComponent(teamGroupId || '')}`, {
          method: 'GET'
        });
        
        // 获取组本月数据
        const monthResponse = await request<any>(`/dashboard/kpi?range=month&group=${encodeURIComponent(teamGroupId || '')}`, {
          method: 'GET'
        });
        
        // 获取组内用户上月累计金币
        const lastMonthResponse = await request<any>(`/team/last-month-coins?group=${encodeURIComponent(teamGroupId || '')}`, {
          method: 'GET'
        });

        // 获取组累计金币
        const totalResponse = await request<any>(`/dashboard/kpi?range=all&group=${encodeURIComponent(teamGroupId || '')}`, {
          method: 'GET'
        });

        // 计算收益 - 组长收益 = 组金币 * 10%
        console.log('Group responses:', { todayResponse, monthResponse, lastMonthResponse, totalResponse });
        const todayGroupCoins = Number(todayResponse?.coins || 0) / 1000;
        const monthGroupCoins = Number(monthResponse?.coins || 0) / 1000;
        const lastMonthGroupCoins = Number(lastMonthResponse?.coins || 0) / 1000;
        const totalGroupCoins = Number(totalResponse?.coins || 0) / 1000;
        console.log('Calculated group coins:', { todayGroupCoins, monthGroupCoins, lastMonthGroupCoins, totalGroupCoins });

        setEarnings({
          today: todayGroupCoins * 0.1,
          month: monthGroupCoins * 0.1,
          lastMonth: lastMonthGroupCoins * 0.1,
          total: totalGroupCoins * 0.1
        });
      } else {
        // 超级管理员获取全局数据
        const todayResponse = await request<any>('/dashboard/kpi?range=today', {
          method: 'GET'
        });
        
        const monthResponse = await request<any>('/dashboard/kpi?range=month', {
          method: 'GET'
        });
        
        // 获取上月累计金币
        const lastMonthResponse = await request<any>('/dashboard/kpi?range=lastMonth', {
          method: 'GET'
        });

        // 获取累计金币
        const totalResponse = await request<any>('/dashboard/kpi?range=all', {
          method: 'GET'
        });

        console.log('Admin responses:', { todayResponse, monthResponse, lastMonthResponse, totalResponse });
        const todayUserShare = Number(todayResponse?.coins || 0) / 1000;
        const monthUserShare = Number(monthResponse?.coins || 0) / 1000;
        const lastMonthUserShare = Number(lastMonthResponse?.coins || 0) / 1000;
        const totalUserShare = Number(totalResponse?.coins || 0) / 1000;
        console.log('Calculated admin coins:', { todayUserShare, monthUserShare, lastMonthUserShare, totalUserShare });

        setEarnings({
          today: todayUserShare * 0.2,
          month: monthUserShare * 0.2,
          lastMonth: lastMonthUserShare * 0.2,
          total: totalUserShare * 0.2
        });
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      // 保持当前数据，不设置为0，避免数据闪烁
    }
  };

  // 获取提现记录
  const fetchWithdrawRecords = async () => {
    if (!currentUser?.id) return;

    setIsLoadingRecords(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/list?userId=${currentUser.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setWithdrawRecords(result.data || []);
      } else {
        setWithdrawRecords([]);
      }
    } catch (error) {
      console.error('Error fetching withdraw records:', error);
      setWithdrawRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  // 加载提现开关状态
  const loadWithdrawStatus = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      console.log('提现状态响应:', result);
      // 处理后端返回的enabled字段，可能在data对象中或根级别
      const enabledValue = result?.enabled ?? result?.data?.enabled;
      console.log('提现开关原始值:', enabledValue, '类型:', typeof enabledValue);
      // 转换为布尔值
      const isEnabled = enabledValue === true || enabledValue === 'true' || enabledValue === 1 || enabledValue === '1';
      setWithdrawEnabled(isEnabled);
      console.log('提现开关最终状态:', isEnabled);
    } catch (err) {
      console.error('获取提现状态失败:', err);
      setWithdrawEnabled(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
    fetchWithdrawRecords();
    loadWithdrawStatus();
  }, [isTeamLeader, isGroupLeader, currentUser?.teamName, currentUser?.teamGroupId]);

  const sections = [
    {
      title: '账户管理',
      items: [
        { label: '修改密码', icon: Key, color: 'text-blue-500 bg-blue-50', onClick: () => setShowPasswordModal(true) },
      ]
    }
  ];

  return (
    <div className="pb-6">
      <div className="bg-[#1E40AF] pt-12 pb-16 px-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        
        <div className="relative flex items-center space-x-4">
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
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10 uppercase">
                      {isSuperAdmin ? '超级管理员' : isTeamLeader ? '团队长' : isGroupLeader ? '组长' : '普通管理员'}
                    </span>
                </div>
                <div className="flex items-center space-x-1 mt-0.5 opacity-80">
                  <span className="text-[10px] opacity-60">ID: {currentUser?.id}</span>
                  <button 
                    onClick={() => {
                      if (currentUser?.id) {
                        navigator.clipboard.writeText(currentUser.id);
                        setShowCopySuccess(true);
                        setTimeout(() => setShowCopySuccess(false), 2000);
                      }
                    }}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    title="复制ID"
                  >
                    <Copy size={12} className="text-white/60 hover:text-white transition-colors" />
                  </button>
                  {showCopySuccess && (
                    <span className="text-[9px] bg-white/30 px-2 py-0.5 rounded-full backdrop-blur-sm text-white animate-in fade-in duration-300">
                      ID复制成功
                    </span>
                  )}
                </div>
            </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-6">
        {/* 我的收益板块 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
          <h3 className="text-sm font-black text-gray-900 mb-4 text-center">我的收益（元）</h3>
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
                    if (withdrawEnabled && earnings.lastMonth > 0) {
                      setShowWithdrawModal(true);
                    }
                  }}
                  disabled={!withdrawEnabled || earnings.lastMonth <= 0}
                  className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all border flex items-center gap-1 ${
                    withdrawEnabled && earnings.lastMonth > 0
                      ? 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 border-blue-500/30 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  提现
                </button>
              </div>
              <div className="text-xl font-black text-purple-600">¥{earnings.lastMonth.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">累计收益</div>
              <div className="text-xl font-black text-orange-600">¥{earnings.total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* 提现记录板块 */}
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
                      return { text: '待打款', className: 'text-amber-600 bg-amber-50' };
                    case 1:
                      return { text: '已打款', className: 'text-emerald-600 bg-emerald-50' };
                    case 2:
                      return { text: '已拒绝', className: 'text-red-600 bg-red-50' };
                    default:
                      return { text: record.statusText || '未知状态', className: 'text-gray-600 bg-gray-50' };
                  }
                })();
                return (
                  <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-bold text-gray-900">¥{record.amount.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusStyle.className}`}>
                        {statusStyle.text}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div>扣除金币：{record.goldAmount} 金币</div>
                      <div>{new Date(record.createTime).toLocaleString('zh-CN')}</div>
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500">
                      <div>支付宝：{record.alipayAccount}</div>
                      <div>姓名：{record.alipayName}</div>
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
            <p className="text-[10px] text-gray-300 font-medium">Power by AdMaster Cloud Service</p>
            <p className="text-[10px] text-gray-300 font-medium">© 2026 AdMaster Data Hub</p>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">修改登录密码</h3>
            <div className="space-y-4">
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
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => setShowPasswordModal(false)}
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
              <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
                    <div className="text-3xl font-bold text-purple-700">¥{earnings.lastMonth.toFixed(2)}</div>
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
                  <p className="text-xs text-gray-400 text-center">提现申请将在3个工作日内处理</p>
                </>
              )}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawSuccess(false);
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
                    disabled={isWithdrawing || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0}
                    className={`flex-1 py-4 text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center ${
                      isWithdrawing || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0
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
    </div>
  );
};

export default Settings;
