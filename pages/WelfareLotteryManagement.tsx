import React, { useState, useEffect } from 'react';
import { ChevronLeft, Gift, Settings, DollarSign, Check, X, AlertCircle, Clock } from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface WelfareLotteryManagementProps {
  onBack: () => void;
}

interface Prize {
  id: string;
  name: string;
  value: number;
  type: string;
  probability: number;
}

interface Withdrawal {
  id: string;
  userId: string;
  employeeId: string;
  amount: number;
  alipayAccount: string;
  alipayName: string;
  time: string;
  status: string;
  statusText?: string;
  statusColor?: string;
}

const WelfareLotteryManagement: React.FC<WelfareLotteryManagementProps> = ({ onBack }) => {
  const swipeRef = useSwipeBack({ onBack });
  const [activeTab, setActiveTab] = useState<'prizes' | 'withdrawals' | 'records'>('prizes');
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [records, setRecords] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [newProbability, setNewProbability] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  const fetchPrizes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/prizes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setPrizes(result.data.prizes || []);
      }
    } catch (error) {
      console.error('Error fetching prizes:', error);
      setError('获取奖品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/withdraw/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setWithdrawals(result.data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      setError('获取提现申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/withdraw/records', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setRecords(result.data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      setError('获取提现记录失败');
    } finally {
      setLoading(false);
    }
  };

  const updatePrizeProbability = async () => {
    if (!editingPrize || !newProbability) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/update-prize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingPrize.id,
          probability: parseFloat(newProbability)
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setEditingPrize(null);
        setNewProbability('');
        fetchPrizes();
      } else {
        setError(result.message || '更新奖品概率失败');
      }
    } catch (error) {
      console.error('Error updating prize probability:', error);
      setError('更新奖品概率失败');
    } finally {
      setLoading(false);
    }
  };

  const processWithdrawal = async (id: string, status: 'completed' | 'failed') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/withdraw/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, status })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        fetchWithdrawals();
      } else {
        setError(result.message || '处理提现申请失败');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      setError('处理提现申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'prizes') {
      fetchPrizes();
    } else if (activeTab === 'withdrawals') {
      fetchWithdrawals();
    } else {
      fetchRecords();
    }
  }, [activeTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <span className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg">处理中</span>;
      case 'completed':
        return <span className="px-2 py-1 text-[10px] font-bold bg-green-50 text-green-600 rounded-lg">已到账</span>;
      case 'failed':
        return <span className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg">失败</span>;
      default:
        return null;
    }
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">福利抽奖管理</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 标签页切换 */}
        <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('prizes')}
            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'prizes' 
                ? 'bg-[#1E40AF] text-white' 
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            奖品管理
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'withdrawals' 
                ? 'bg-[#1E40AF] text-white' 
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            待处理提现
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'records' 
                ? 'bg-[#1E40AF] text-white' 
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            提现记录
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center space-x-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {showSuccess && (
          <div className="p-3 bg-green-50 text-green-600 text-sm font-medium rounded-xl flex items-center space-x-2">
            <Check size={16} />
            <span>操作成功！</span>
          </div>
        )}

        {/* 奖品管理 */}
        {activeTab === 'prizes' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : prizes.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无奖品数据</p>
              </div>
            ) : (
              prizes.map((prize) => (
                <div key={prize.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs">
                        <Gift size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">{prize.name}</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          价值: ¥{prize.value} | 类型: {prize.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{prize.probability}%</p>
                      <p className="text-[10px] text-gray-400">中奖概率</p>
                    </div>
                  </div>
                  
                  {editingPrize?.id === prize.id ? (
                    <div className="flex space-x-2 pt-2 border-t border-gray-50">
                      <input
                        type="number"
                        value={newProbability}
                        onChange={(e) => setNewProbability(e.target.value)}
                        placeholder="输入新概率"
                        min="0"
                        max="100"
                        step="0.1"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                      <button
                        onClick={updatePrizeProbability}
                        disabled={loading}
                        className="px-3 py-2 text-xs font-bold bg-green-50 text-green-600 rounded-xl"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingPrize(null);
                          setNewProbability('');
                        }}
                        className="px-3 py-2 text-xs font-bold bg-gray-50 text-gray-600 rounded-xl"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPrize(prize);
                        setNewProbability(prize.probability.toString());
                      }}
                      className="w-full py-2 bg-blue-50 text-[#1E40AF] text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      <Settings size={14} />
                      <span>调整概率</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 待处理提现 */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无待处理提现申请</p>
              </div>
            ) : (
              withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600 font-bold text-xs">
                        <DollarSign size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">¥ {withdrawal.amount.toFixed(2)}</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          用户ID: {withdrawal.employeeId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(withdrawal.status)}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(withdrawal.time).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">支付宝姓名:</span> {withdrawal.alipayName}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">支付宝账号:</span> {withdrawal.alipayAccount}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => processWithdrawal(withdrawal.id, 'completed')}
                      disabled={loading}
                      className="flex-1 py-2 bg-green-50 text-green-600 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      <Check size={14} />
                      <span>已到账</span>
                    </button>
                    <button
                      onClick={() => processWithdrawal(withdrawal.id, 'failed')}
                      disabled={loading}
                      className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      <X size={14} />
                      <span>失败</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 提现记录 */}
        {activeTab === 'records' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无提现记录</p>
              </div>
            ) : (
              records.map((record) => (
                <div key={record.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                        <Clock size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">¥ {record.amount.toFixed(2)}</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          用户ID: {record.employeeId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(record.status)}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(record.time).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">支付宝姓名:</span> {record.alipayName}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">支付宝账号:</span> {record.alipayAccount}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WelfareLotteryManagement;
