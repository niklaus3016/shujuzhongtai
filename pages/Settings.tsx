
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
  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayName, setAlipayName] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawRecords, setWithdrawRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  
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
    setIsWithdrawing(true);
    try {
      // 1. 检查提现开关状态
      const statusResponse = await fetch('/api/withdraw/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const statusResult = await statusResponse.json();
      if (!statusResult.success || !statusResult.data.enabled) {
        setIsWithdrawing(false);
        alert(statusResult.data.message || '提现功能已关闭');
        return;
      }
      
      // 2. 计算提现金额和金币数
      const amount = earnings.lastMonth; // 上月收益（元）
      const goldAmount = amount * 1000; // 1元=1000金币
      
      // 3. 提交提现申请
      const withdrawResponse = await fetch('/api/withdraw/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser?.id || '',
          employeeId: currentUser?.id || '',
          amount: amount,
          goldAmount: goldAmount,
          alipayAccount: alipayAccount,
          alipayName: alipayName
        })
      });
      
      const withdrawResult = await withdrawResponse.json();
      if (withdrawResult.success) {
        setIsWithdrawing(false);
        setShowWithdrawModal(false);
        setAlipayAccount('');
        setAlipayName('');
        alert(`提现成功！剩余金币：${withdrawResult.data.remainingGold}`);
        // 更新收益数据和提现记录
        fetchEarnings();
        fetchWithdrawRecords();
      } else {
        setIsWithdrawing(false);
        alert(withdrawResult.message || '提现失败，请稍后重试');
      }
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
      if (isTeamLeader && currentUser?.teamName) {
        // 获取团队今日数据
        const todayResponse = await request<any>(`/dashboard/kpi?range=today&team=${encodeURIComponent(currentUser.teamName)}`, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        // 获取团队本月数据
        const monthResponse = await request<any>(`/dashboard/kpi?range=month&team=${encodeURIComponent(currentUser.teamName)}`, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        // 获取团队内用户上月累计金币
        const lastMonthResponse = await request<any>(`/team/last-month-coins?team=${encodeURIComponent(currentUser.teamName)}`, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        // 计算收益 - 团队长收益 = 团队金币 * 20%
        const todayTeamCoins = Number(todayResponse.coins || 0) / 1000;
        const monthTeamCoins = Number(monthResponse.coins || 0) / 1000;
        const lastMonthTeamCoins = Number(lastMonthResponse.coins || 0) / 1000;
        const totalTeamCoins = 15600; // 累计数据暂时使用模拟值
        
        setEarnings({
          today: todayTeamCoins * 0.2,
          month: monthTeamCoins * 0.2,
          lastMonth: lastMonthTeamCoins * 0.2,
          total: totalTeamCoins * 0.2
        });
      } else {
        // 超级管理员获取全局数据
        const todayResponse = await request<any>('/dashboard/kpi?range=today', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        const monthResponse = await request<any>('/dashboard/kpi?range=month', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        
        const todayUserShare = Number(todayResponse.coins || 0) / 1000;
        const monthUserShare = Number(monthResponse.coins || 0) / 1000;
        const lastMonthUserShare = 160; // 上月数据
        const totalUserShare = 15600;
        
        setEarnings({
          today: todayUserShare * 0.2,
          month: monthUserShare * 0.2,
          lastMonth: lastMonthUserShare * 0.2,
          total: totalUserShare * 0.2
        });
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setEarnings({
        today: 0.13,
        month: 77.00,
        lastMonth: 32.00,
        total: 3120.00
      });
    }
  };

  // 获取提现记录
  const fetchWithdrawRecords = async () => {
    if (!currentUser?.id) return;
    
    setIsLoadingRecords(true);
    try {
      const response = await fetch(`/api/withdraw/list?userId=${currentUser.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
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

  useEffect(() => {
    fetchEarnings();
    fetchWithdrawRecords();
  }, [isTeamLeader, currentUser?.teamName]);

  const sections = [
    {
      title: '账户管理',
      items: [
        { label: '修改密码', icon: Key, color: 'text-blue-500 bg-blue-50', onClick: () => setShowPasswordModal(true) },
        { label: '意见反馈', icon: Mail, color: 'text-purple-500 bg-purple-50' },
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
                      {isSuperAdmin ? '超级管理员' : '普通管理员'}
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
          <h3 className="text-sm font-black text-gray-900 mb-4 text-center">我的收益（金币）</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-4 rounded-2xl shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">今日预估收益</div>
              <div className="text-xl font-black text-blue-600">{(earnings.today * 1000).toFixed(0)}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">本月预估收益</div>
              <div className="text-xl font-black text-green-600">{(earnings.month * 1000).toFixed(0)}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase">上月收益</div>
                <button 
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-2 py-1 text-[9px] font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                >
                  提现
                </button>
              </div>
              <div className="text-xl font-black text-purple-600">{(earnings.lastMonth * 1000).toFixed(0)}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl shadow-sm">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">累计收益</div>
              <div className="text-xl font-black text-orange-600">{(earnings.total * 1000).toFixed(0)}</div>
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
              {withdrawRecords.map((record, index) => (
                <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-gray-900">¥{record.amount.toFixed(2)}</div>
                    <div className="text-[10px] font-bold text-green-600">{record.statusText}</div>
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
              ))}
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
            <p className="text-[10px] text-gray-300 font-medium">© 2024 AdMaster Data Hub</p>
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
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">申请提现</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">支付宝帐号</label>
                <input 
                  type="text" 
                  value={alipayAccount}
                  onChange={(e) => setAlipayAccount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="请输入支付宝帐号"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">支付宝姓名</label>
                <input 
                  type="text" 
                  value={alipayName}
                  onChange={(e) => setAlipayName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
                  placeholder="请输入支付宝姓名"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 rounded-2xl active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                  className="flex-1 py-3 text-xs font-black text-white bg-purple-600 rounded-2xl shadow-lg shadow-purple-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isWithdrawing ? <Loader2 size={16} className="animate-spin" /> : '确认提现'}
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
