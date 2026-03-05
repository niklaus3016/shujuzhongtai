import React, { useState, useEffect } from 'react';
import { 
  Users, Target, ToggleLeft, ToggleRight, Wallet, ChevronRight,
  UserPlus, Settings, TrendingUp, Plus, ChevronLeft, Info
} from 'lucide-react';
import { request } from '../services/api';
import AccountManagement from './AccountManagement';
import DailyTargetManagement from './DailyTargetManagement';
import WithdrawalManagement from './WithdrawalManagement';

interface ManagementProps {}

const Management: React.FC<ManagementProps> = () => {
  const [activePage, setActivePage] = useState<'main' | 'account' | 'target' | 'withdrawal' | 'deduction-history' | 'commission'>('main');
  const [withdrawEnabled, setWithdrawEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionRate, setDeductionRate] = useState('');
  const [deductionHistory, setDeductionHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'正常' | '异常' | '检查中'>('检查中');
  const [statusLoading, setStatusLoading] = useState(true);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [commissionRate, setCommissionRate] = useState(0.5);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [tempRate, setTempRate] = useState<string>('50');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (activePage === 'deduction-history') {
      fetchDeductionHistory();
    }
  }, [activePage]);

  const fetchWithdrawStatus = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/withdraw-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setWithdrawEnabled(result.enabled ?? false);
      }
    } catch (error) {
      console.error('Error fetching withdraw status:', error);
    }
  };

  useEffect(() => {
    fetchWithdrawStatus();
    fetchSystemStatus();
    fetchPendingWithdrawals();
    fetchCommissionRate();
  }, []);

  const fetchPendingWithdrawals = async () => {
    setWithdrawalLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/withdraw/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Withdrawal API response status:', response.status);
      const result = await response.json();
      console.log('Withdrawal API response:', result);
      if (result.success && result.list) {
        const pendingCount = result.list.filter((item: any) => item.status === 'pending').length;
        console.log('Pending withdrawals count:', pendingCount);
        setPendingWithdrawals(pendingCount);
      } else {
        console.log('API response not successful:', result);
      }
    } catch (error) {
      console.error('Error fetching pending withdrawals:', error);
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    setStatusLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && result.status === 'healthy') {
        setSystemStatus('正常');
      } else {
        setSystemStatus('异常');
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
      setSystemStatus('异常');
    } finally {
      setStatusLoading(false);
    }
  };

  const toggleWithdraw = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const newStatus = !withdrawEnabled;
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/withdraw-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: newStatus })
      });
      const result = await response.json();
      if (result.success) {
        setWithdrawEnabled(newStatus);
      }
    } catch (error) {
      console.error('Error toggling withdraw:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoldDeduction = async () => {
    const rate = parseFloat(deductionRate);
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      alert('请输入有效的核减率（0-100）');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/gold/deduct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deductionRate: rate / 100 })
      });
      const result = await response.json();
      if (result.success) {
        alert('核减成功！');
        setShowDeductionModal(false);
        setDeductionRate('');
        if (activePage === 'deduction-history') {
          fetchDeductionHistory();
        }
      } else {
        alert('核减失败：' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('Error deducting gold:', error);
      alert('核减失败：网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissionRate = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/commission-rate', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setCommissionRate(result.rate);
        setTempRate((result.rate * 100).toString());
      }
    } catch (error) {
      console.error('Error fetching commission rate:', error);
    }
  };

  const updateCommissionRate = async (newRate: number) => {
    setCommissionLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/commission-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rate: newRate })
      });
      const result = await response.json();
      if (result.success) {
        setCommissionRate(newRate);
        setTempRate((newRate * 100).toString());
        return true;
      } else {
        throw new Error(result.message || '设置失败');
      }
    } catch (error) {
      console.error('Error updating commission rate:', error);
      throw error;
    } finally {
      setCommissionLoading(false);
    }
  };

  const fetchDeductionHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/gold/deduct/history', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setDeductionHistory(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching deduction history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activePage === 'commission') {
      setTempRate((commissionRate * 100).toString());
    }
  }, [activePage, commissionRate]);

  if (activePage === 'account') {
    return <AccountManagement onBack={() => setActivePage('main')} />;
  }

  if (activePage === 'target') {
    return <DailyTargetManagement onBack={() => setActivePage('main')} />;
  }

  if (activePage === 'withdrawal') {
    return <WithdrawalManagement onBack={() => setActivePage('main')} />;
  }

  if (activePage === 'deduction-history') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
        <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="text-[#1E40AF] mr-2" size={24} />
              上月金币核减
            </h1>
            <button
              onClick={() => setActivePage('main')}
              className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl flex items-center space-x-1"
            >
              <ChevronLeft size={16} />
              <span>返回</span>
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* 核减记录 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">核减操作记录</h2>
              <button
                onClick={() => setShowDeductionModal(true)}
                className="px-4 py-1.5 bg-[#1E40AF] text-white text-sm font-bold rounded-xl flex items-center space-x-1"
              >
                <Plus size={14} />
                <span>新增核减</span>
              </button>
            </div>
            
            {historyLoading ? (
              <div className="text-center py-10 text-gray-400">加载中...</div>
            ) : deductionHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <TrendingUp size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">暂无核减记录</p>
                <p className="text-xs text-gray-400 mt-2">点击右上角"新增核减"按钮发起核减操作</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deductionHistory.map((record, index) => (
                  <div key={record._id || index} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-900">核减操作</span>
                      <span className="text-xs text-gray-400">
                        {new Date(record.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-400">核减率：</span>
                        <span className="font-medium">{record.deductionRate * 100}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">影响用户数：</span>
                        <span className="font-medium">{record.affectedUsers || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">操作人：</span>
                        <span className="font-medium">{record.operator || '系统'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">状态：</span>
                        <span className={`font-medium ${
                          record.status === 'success' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {record.status === 'success' ? '成功' : '失败'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 金币核减模态框 */}
        {showDeductionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">上月金币核减</h3>
              <p className="text-sm text-gray-500 mb-4">请输入核减率（百分比），所有用户上月累计金币将更新为：上月累计金币 × 核减率</p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-700 mb-1">核减率 (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={deductionRate}
                    onChange={(e) => setDeductionRate(e.target.value)}
                    placeholder="例如：5"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">%</div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeductionModal(false);
                    setDeductionRate('');
                  }}
                  disabled={loading}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                    loading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleGoldDeduction}
                  disabled={loading}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                    loading ? 'bg-blue-100 text-blue-300 cursor-not-allowed' : 'bg-[#1E40AF] text-white hover:bg-blue-700'
                  }`}
                >
                  {loading ? '处理中...' : '确认核减'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activePage === 'commission') {
    const handleSave = async () => {
      if (!tempRate || tempRate.trim() === '') {
        alert('请输入分成比例');
        return;
      }
      
      const rate = parseFloat(tempRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        alert('请输入有效的分成比例（0-100）');
        return;
      }
      
      try {
        await updateCommissionRate(rate / 100);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } catch (error) {
        console.error('Save error:', error);
        const errorMessage = error instanceof Error ? error.message : '设置失败，请稍后重试';
        alert('设置失败：' + errorMessage);
      }
    };
    
    return (
      <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
        <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="text-[#1E40AF] mr-2" size={24} />
              用户分成设置
            </h1>
            <button
              onClick={() => setActivePage('main')}
              className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl flex items-center space-x-1"
            >
              <ChevronLeft size={16} />
              <span>返回</span>
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">分成比例设置</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">当前分成比例</label>
                <div className="relative">
                  <input
                    type="number"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    placeholder="例如：50"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={commissionLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">%</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  分成比例决定了用户观看视频获得的金币比例，计算公式：
                  <br />
                  <span className="font-medium">用户获得金币 = 视频ECPM × 观看时长 × 分成比例</span>
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setTempRate((commissionRate * 100).toString())}
                  disabled={commissionLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                    commissionLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={commissionLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                    commissionLoading ? 'bg-blue-100 text-blue-300 cursor-not-allowed' : 'bg-[#1E40AF] text-white hover:bg-blue-700'
                  }`}
                >
                  {commissionLoading ? '保存中...' : '保存设置'}
                </button>
              </div>
              
              {showSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-600 text-sm font-medium rounded-xl flex items-center space-x-2">
                  <Check size={16} />
                  <span>设置保存成功！</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center space-x-2">
              <Info size={16} />
              <span>使用说明</span>
            </h3>
            <ul className="text-xs text-blue-600 space-y-2">
              <li>• 分成比例范围：0-100%</li>
              <li>• 默认值：50%</li>
              <li>• 设置后立即生效，影响后续的金币发放</li>
              <li>• 建议根据平台运营策略合理设置</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      id: 'account',
      icon: Users,
      title: '账号管理',
      description: '开设团队长账号和员工账号',
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      id: 'target',
      icon: Target,
      title: '今日目标管理',
      description: '设定每日目标数据',
      color: 'text-green-500',
      bg: 'bg-green-50'
    },
    {
      id: 'commission',
      icon: TrendingUp,
      title: '用户分成设置',
      description: '设置用户金币分成比例',
      color: 'text-purple-500',
      bg: 'bg-purple-50'
    },
    {
      id: 'gold-deduction',
      icon: TrendingUp,
      title: '上月金币核减',
      description: '对所有用户上月累计金币进行核减',
      color: 'text-purple-500',
      bg: 'bg-purple-50'
    },
    {
      id: 'withdraw-toggle',
      icon: withdrawEnabled ? ToggleRight : ToggleLeft,
      title: '提现开关',
      description: withdrawEnabled ? '当前：已开启' : '当前：已关闭',
      color: withdrawEnabled ? 'text-green-500' : 'text-gray-400',
      bg: withdrawEnabled ? 'bg-green-50' : 'bg-gray-50',
      isToggle: true
    },
    {
      id: 'withdrawal',
      icon: Wallet,
      title: '提现管理',
      description: '查看所有提现记录和数据',
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 flex items-center">
          <Settings className="text-[#1E40AF] mr-2" size={24} />
          管理中心
        </h1>
      </header>

      <div className="p-4 space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.isToggle) {
                  toggleWithdraw();
                } else if (item.id === 'account') {
                  setActivePage('account');
                } else if (item.id === 'target') {
                  setActivePage('target');
                } else if (item.id === 'withdrawal') {
                  setActivePage('withdrawal');
                } else if (item.id === 'gold-deduction') {
                  setActivePage('deduction-history');
                } else if (item.id === 'commission') {
                  setActivePage('commission');
                }
              }}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-all ${loading && item.isToggle ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <Icon size={24} className={item.color} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>
                </div>
              </div>
              {item.isToggle ? (
                <div className={`w-12 h-7 rounded-full p-1 transition-all ${withdrawEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${withdrawEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              ) : (
                <ChevronRight size={20} className="text-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 mt-6">
        <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center space-x-3 mb-3">
            <TrendingUp size={20} />
            <span className="text-xs font-bold opacity-80 uppercase tracking-wider">系统状态</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] opacity-70">提现功能</p>
              <p className="text-sm font-bold">{withdrawEnabled ? '已开启' : '已关闭'}</p>
            </div>
            <div>
              <p className="text-[10px] opacity-70">系统运行</p>
              <p className={`text-sm font-bold ${systemStatus === '正常' ? 'text-green-300' : systemStatus === '异常' ? 'text-red-300' : 'text-yellow-300'}`}>
                {statusLoading ? '检查中...' : systemStatus}
              </p>
            </div>
            {pendingWithdrawals > 0 && (
              <div className="col-span-2">
                <p className="text-[10px] opacity-70">提现提醒</p>
                <p className="text-sm font-bold text-yellow-300">
                  {withdrawalLoading ? '检查中...' : `有 ${pendingWithdrawals} 笔提现待处理`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Management;