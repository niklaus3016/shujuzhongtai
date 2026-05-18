import React, { useState, useEffect } from 'react';
import { ChevronLeft, Gift, Settings, DollarSign, Check, X, AlertCircle, Clock, Plus, User, Coins, Sliders, Download } from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { request } from '../services/api';

interface WelfareLotteryManagementProps {
  onBack: () => void;
  initialSection?: 'lottery' | 'withdraw';
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

interface Threshold {
  adCount: number;
  giveChances: number;
}

interface WelfareSettings {
  thresholds: Threshold[];
}

interface UserWallet {
  employeeId: string;
  todayAdCount: number;
  chances: number;
  lastAwardedThresholdIndex: number;
  countDate: string;
}

interface LotteryRecord {
  id: string;
  employeeId: string;
  time: string;
  prizeName: string;
  prizeValue: number;
  prizeType: string;
}

const WelfareLotteryManagement: React.FC<WelfareLotteryManagementProps> = ({ onBack, initialSection = 'lottery' }) => {
  const swipeRef = useSwipeBack({ onBack });
  const [activeSection, setActiveSection] = useState<'lottery' | 'withdraw'>(initialSection);
  const [showOnlyWithdraw, setShowOnlyWithdraw] = useState(initialSection === 'withdraw');
  // 如果初始进入提现管理，默认选中待处理提现
  const [activeTab, setActiveTab] = useState<'prizes' | 'settings' | 'userWallet' | 'lotteryRecords' | 'withdrawals' | 'records'>(
    initialSection === 'withdraw' ? 'withdrawals' : 'prizes'
  );
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [records, setRecords] = useState<Withdrawal[]>([]);
  const [lotteryRecords, setLotteryRecords] = useState<LotteryRecord[]>([]);
  const [lotteryStats, setLotteryStats] = useState<{ totalCount: number; totalPrize: number }>({ totalCount: 0, totalPrize: 0 });
  
  // 日期筛选状态 - 简化为只选某一天
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [newProbability, setNewProbability] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // 新增状态
  const [settings, setSettings] = useState<WelfareSettings>({ thresholds: [] });
  const [editingThreshold, setEditingThreshold] = useState<number | null>(null);
  const [editingThresholdOriginalAdCount, setEditingThresholdOriginalAdCount] = useState<number | null>(null);
  const [newAdCount, setNewAdCount] = useState('');
  const [newGiveChances, setNewGiveChances] = useState('');
  const [addingThreshold, setAddingThreshold] = useState(false);
  const [userWallet, setUserWallet] = useState<UserWallet | null>(null);
  const [searchEmployeeId, setSearchEmployeeId] = useState('');
  const [addChancesEmployeeId, setAddChancesEmployeeId] = useState('');
  const [addChancesCount, setAddChancesCount] = useState('');
  const [showAddChancesModal, setShowAddChancesModal] = useState(false);
  const [showProbabilityModal, setShowProbabilityModal] = useState(false);
  const [probabilityEditList, setProbabilityEditList] = useState<string[]>([]);
  
  // 编辑奖品状态
  const [editPrizeName, setEditPrizeName] = useState('');
  const [editPrizeValue, setEditPrizeValue] = useState('');
  const [editPrizeType, setEditPrizeType] = useState('');
  const [showEditPrizeModal, setShowEditPrizeModal] = useState(false);
  
  const totalProbability = probabilityEditList.length 
    ? probabilityEditList.reduce((sum, p) => sum + parseFloat(p) || 0, 0)
    : prizes.reduce((sum, p) => sum + (p.probability || 0), 0);

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

  // 新增：获取阈值配置
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setSettings(result.data || { thresholds: [] });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增：获取抽奖记录
  const fetchLotteryRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      let url = 'https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/lottery/records';
      const params: string[] = [];
      if (selectedDate) {
        // 使用简单日期格式，与后端接口保持一致
        params.push(`startDate=${encodeURIComponent(selectedDate)}`);
        params.push(`endDate=${encodeURIComponent(selectedDate)}`);
      }
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setLotteryRecords(result.data.records || []);
        setLotteryStats(result.data.statistics || { totalCount: 0, totalPrize: 0 });
      }
    } catch (error) {
      console.error('Error fetching lottery records:', error);
      setError('获取抽奖记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置筛选条件
  const resetFilters = () => {
    setSelectedDate('');
    fetchLotteryRecords();
  };

  // 新增：更新阈值配置
  const updateSettings = async () => {
    console.log('准备保存配置，当前settings:', settings);
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      // 只发送 thresholds 字段，与后端接口保持一致
      const requestData = JSON.stringify({ thresholds: settings.thresholds });
      console.log('发送配置数据:', requestData);
      
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: requestData
      });
      
      const result = await response.json();
      console.log('保存配置响应:', result);
      
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        // 直接使用本地已更新的数据，不需要重新获取
      } else {
        setError(result.message || '更新配置失败');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('更新配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增：添加阈值
  const addThreshold = () => {
    if (!newAdCount || !newGiveChances) {
      setError('请填写完整的阈值信息');
      return;
    }
    const newThreshold: Threshold = {
      adCount: parseInt(newAdCount),
      giveChances: parseInt(newGiveChances)
    };
    setSettings(prev => ({
      thresholds: [...prev.thresholds, newThreshold].sort((a, b) => a.adCount - b.adCount)
    }));
    setNewAdCount('');
    setNewGiveChances('');
    setAddingThreshold(false);
  };

  // 新增：编辑阈值
  const updateThreshold = async (index: number) => {
    console.log('编辑阈值，索引:', index, '新值:', { newAdCount, newGiveChances });
    if (!newAdCount || !newGiveChances) {
      setError('请填写完整的阈值信息');
      return;
    }
    const updatedThresholds = [...settings.thresholds];
    const newAdCountNum = parseInt(newAdCount);
    const newGiveChancesNum = parseInt(newGiveChances);
    updatedThresholds[index] = {
      adCount: newAdCountNum,
      giveChances: newGiveChancesNum
    };
    const newSettings = { thresholds: updatedThresholds.sort((a, b) => a.adCount - b.adCount) };
    console.log('更新后的settings:', newSettings);
    setSettings(newSettings);
    setNewAdCount('');
    setNewGiveChances('');
    setEditingThresholdOriginalAdCount(null);
    // 在排序后的数组中找到刚更新的阈值
    const newIndex = newSettings.thresholds.findIndex(
      t => t.adCount === newAdCountNum && t.giveChances === newGiveChancesNum
    );
    // 无论找到与否，都退出编辑模式
    setEditingThreshold(newIndex === -1 ? null : null);
    
    // 自动保存到后端
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      console.log('=== 保存阈值配置 ===');
      console.log('当前Token:', token ? '已获取 (' + token.length + '字符)' : '未获取');
      console.log('请求URL:', '/welfare/admin/settings');
      console.log('请求数据:', JSON.stringify(newSettings));
      
      const result = await request('/welfare/admin/settings', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      
      console.log('响应数据:', result);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('=== 保存配置失败 ===');
      console.error('错误详情:', error);
      console.error('错误类型:', typeof error);
      console.error('错误消息:', error.message);
      setError(error.message || '保存配置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 新增：删除阈值
  const deleteThreshold = (index: number) => {
    const updatedThresholds = settings.thresholds.filter((_, i) => i !== index);
    setSettings({ thresholds: updatedThresholds });
  };

  // 新增：获取用户钱包信息
  const fetchUserWallet = async () => {
    if (!searchEmployeeId) {
      setError('请输入用户ID');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/user-wallet?employeeId=${searchEmployeeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setUserWallet(result.data || null);
      } else {
        setUserWallet(null);
        setError(result.message || '未找到用户钱包信息');
      }
    } catch (error) {
      console.error('Error fetching user wallet:', error);
      setError('获取用户钱包信息失败');
      setUserWallet(null);
    } finally {
      setLoading(false);
    }
  };

  // 新增：手动添加抽奖机会
  const addChances = async () => {
    if (!addChancesEmployeeId || !addChancesCount) {
      setError('请填写完整信息');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      console.log('添加抽奖机会请求:', {
        url: 'https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/add-chances',
        employeeId: addChancesEmployeeId,
        chances: parseInt(addChancesCount),
        token: token ? '已获取' : '未获取'
      });
      
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/add-chances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeId: addChancesEmployeeId,
          chances: parseInt(addChancesCount)
        })
      });
      
      console.log('添加抽奖机会响应状态:', response.status);
      const result = await response.json();
      console.log('添加抽奖机会响应:', result);
      
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setAddChancesEmployeeId('');
        setAddChancesCount('');
      } else {
        setError(result.message || '添加抽奖机会失败');
      }
    } catch (error) {
      console.error('添加抽奖机会异常:', error);
      setError('添加抽奖机会失败');
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

  // 编辑奖品信息（名称、金额、类型）
  const updatePrizeInfo = async () => {
    if (!editingPrize) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const requestData: Record<string, any> = {
        id: editingPrize.id
      };
      
      if (editPrizeName && editPrizeName !== editingPrize.name) {
        requestData.name = editPrizeName;
      }
      if (editPrizeValue && parseFloat(editPrizeValue) !== editingPrize.value) {
        requestData.value = parseFloat(editPrizeValue);
      }
      if (editPrizeType && editPrizeType !== editingPrize.type) {
        requestData.type = editPrizeType;
      }
      
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/prize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setShowEditPrizeModal(false);
        setEditingPrize(null);
        setEditPrizeName('');
        setEditPrizeValue('');
        setEditPrizeType('');
        fetchPrizes();
      } else {
        setError(result.message || '更新奖品信息失败');
      }
    } catch (error) {
      console.error('Error updating prize info:', error);
      setError('更新奖品信息失败');
    } finally {
      setLoading(false);
    }
  };

  const updateAllProbabilities = async () => {
    if (probabilityEditList.length === 0) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const prizesData = prizes.map((prize, index) => ({
        id: prize.id,
        probability: parseFloat(probabilityEditList[index]) || 0
      }));
      
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/welfare/admin/update-prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prizes: prizesData })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setShowProbabilityModal(false);
        setProbabilityEditList([]);
        fetchPrizes();
      } else {
        setError(result.message || '更新奖品概率失败');
      }
    } catch (error) {
      console.error('Error updating all prize probabilities:', error);
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
    if (activeSection === 'lottery') {
      if (activeTab === 'lotteryRecords') {
        fetchLotteryRecords();
      } else {
        fetchPrizes();
        fetchSettings();
      }
    } else {
      if (activeTab === 'withdrawals') {
        fetchWithdrawals();
      } else if (activeTab === 'records') {
        fetchRecords();
      }
    }
  }, [activeSection, activeTab]);

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

  const exportToCSV = (data: Withdrawal[], filename: string) => {
    if (data.length === 0) {
      setError('暂无数据可导出');
      return;
    }
    
    const headers = ['用户ID', '金额', '支付宝姓名', '支付宝账号', '状态', '时间'];
    const rows = data.map(item => [
      item.employeeId,
      `¥${item.amount.toFixed(2)}`,
      item.alipayName,
      item.alipayAccount,
      item.status === 'processing' ? '处理中' : item.status === 'completed' ? '已到账' : '失败',
      new Date(item.time).toLocaleString('zh-CN')
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">
            {showOnlyWithdraw ? '福利钱包提现管理' : '福利抽奖管理'}
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 福利抽奖管理入口 - 只显示抽奖管理和抽奖记录 */}
        {!showOnlyWithdraw && (
          <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveSection('lottery');
                setActiveTab('prizes');
              }}
              className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSection === 'lottery' && activeTab !== 'lotteryRecords'
                  ? 'bg-white text-[#1E40AF] shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              <Gift size={14} className="inline-block mr-1" />
              抽奖管理
            </button>
            <button
              onClick={() => {
                setActiveSection('lottery');
                setActiveTab('lotteryRecords');
              }}
              className={`flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'lotteryRecords'
                  ? 'bg-white text-[#1E40AF] shadow-sm' 
                  : 'text-gray-500'
              }`}
            >
              <Clock size={14} className="inline-block mr-1" />
              抽奖记录
            </button>
          </div>
        )}

        {/* 福利钱包提现管理入口 - 只显示提现相关内容 */}
        {showOnlyWithdraw && (
          <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
            <div className="flex space-x-1 flex-shrink-0">
              <button
                onClick={() => setActiveTab('withdrawals')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'withdrawals' 
                    ? 'bg-[#1E40AF] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                待处理提现
              </button>
              <button
                onClick={() => exportToCSV(withdrawals, '待处理提现')}
                className="px-2 py-2 text-xs font-bold rounded-xl bg-white text-blue-500 border border-blue-100 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>导出</span>
              </button>
            </div>
            <div className="flex space-x-1 flex-shrink-0">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'records' 
                    ? 'bg-[#1E40AF] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                提现记录
              </button>
              <button
                onClick={() => exportToCSV(records, '提现记录')}
                className="px-2 py-2 text-xs font-bold rounded-xl bg-white text-blue-500 border border-blue-100 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>导出</span>
              </button>
            </div>
          </div>
        )}

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

        {/* 抽奖管理 */}
        {activeSection === 'lottery' && activeTab !== 'lotteryRecords' && (
          <div className="space-y-4">
            {/* 奖品管理 */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : (
              <>
                {/* 手动添加抽奖机会 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center mb-4">
                    <User size={16} className="mr-2 text-[#1E40AF]" />
                    手动添加抽奖机会
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">员工工号</label>
                      <input
                        type="text"
                        value={addChancesEmployeeId}
                        onChange={(e) => setAddChancesEmployeeId(e.target.value)}
                        placeholder="输入员工工号"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">抽奖次数</label>
                      <input
                        type="number"
                        value={addChancesCount}
                        onChange={(e) => setAddChancesCount(e.target.value)}
                        placeholder="输入要增加的抽奖次数"
                        min="1"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                    <button
                      onClick={addChances}
                      disabled={loading || !addChancesEmployeeId || !addChancesCount}
                      className="w-full py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
                
                {/* 统一调整概率按钮 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Settings size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">概率设置</p>
                        <p className="text-[10px] text-gray-400">当前总概率: {prizes.reduce((sum, p) => sum + (p.probability || 0), 0).toFixed(1)}%</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowProbabilityModal(true)}
                      className="px-3 py-2 text-xs font-bold bg-[#1E40AF] text-white rounded-xl"
                    >
                      调整概率
                    </button>
                  </div>
                </div>
                
                {/* 奖品列表 - 双列布局 */}
                <div className="grid grid-cols-2 gap-3">
                  {[...prizes].sort((a, b) => (b.probability || 0) - (a.probability || 0)).map((prize) => (
                    <div key={prize.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 relative">
                      {/* 编辑按钮 */}
                      <button
                        onClick={() => {
                          setEditingPrize(prize);
                          setEditPrizeName(prize.name);
                          setEditPrizeValue(prize.value.toString());
                          setEditPrizeType(prize.type);
                          setShowEditPrizeModal(true);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
                      >
                        <Settings size={12} />
                      </button>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                          <Gift size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-gray-900 truncate">{prize.name}</h3>
                          <p className="text-[10px] text-gray-400">¥{prize.value}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400">中奖概率</span>
                        <span className="text-xs font-bold text-[#1E40AF]">{prize.probability}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 阈值配置 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center">
                      <Sliders size={16} className="mr-2 text-[#1E40AF]" />
                      阈值配置
                    </h3>
                    <button
                      onClick={() => setAddingThreshold(true)}
                      className="px-3 py-1.5 text-xs font-bold bg-[#1E40AF] text-white rounded-xl flex items-center space-x-1"
                    >
                      <Plus size={14} />
                      <span>添加阈值</span>
                    </button>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 mb-4">
                    用户观看广告达到指定数量后，自动获得抽奖机会
                  </p>
                  
                  {settings.thresholds.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                      <p className="text-xs">暂无阈值配置</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {settings.thresholds.map((threshold, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          {editingThreshold === index ? (
                            <div className="flex-1 flex space-x-2">
                              <input
                                type="text"
                                value={newAdCount}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9]/g, '');
                                  setNewAdCount(value);
                                }}
                                placeholder="广告数量"
                                dir="ltr"
                                inputMode="numeric"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF] text-left"
                              />
                              <span className="flex items-center text-gray-400 text-xs">次 →</span>
                              <input
                                type="number"
                                value={newGiveChances}
                                onChange={(e) => setNewGiveChances(e.target.value)}
                                placeholder="抽奖次数"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                              />
                              <span className="flex items-center text-gray-400 text-xs">次</span>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-900">
                                观看 <span className="text-[#1E40AF]">{threshold.adCount}</span> 次广告
                              </p>
                              <p className="text-xs text-gray-400">
                                获得 <span className="text-green-600">{threshold.giveChances}</span> 次抽奖机会
                              </p>
                            </div>
                          )}
                          
                          <div className="flex space-x-2 ml-4">
                            {editingThreshold === index ? (
                              <>
                                <button
                                  onClick={() => updateThreshold(index)}
                                  className="px-3 py-2 text-xs font-bold bg-green-50 text-green-600 rounded-xl"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingThreshold(null);
                                    setNewAdCount('');
                                    setNewGiveChances('');
                                  }}
                                  className="px-3 py-2 text-xs font-bold bg-gray-50 text-gray-600 rounded-xl"
                                >
                                  取消
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingThreshold(index);
                                    setEditingThresholdOriginalAdCount(threshold.adCount);
                                    setNewAdCount(threshold.adCount.toString());
                                    setNewGiveChances(threshold.giveChances.toString());
                                  }}
                                  className="px-3 py-2 text-xs font-bold bg-blue-50 text-blue-600 rounded-xl"
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => deleteThreshold(index)}
                                  className="px-3 py-2 text-xs font-bold bg-red-50 text-red-500 rounded-xl"
                                >
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {settings.thresholds.length > 0 && (
                    <button
                      onClick={updateSettings}
                      disabled={loading}
                      className="w-full mt-4 py-3 bg-[#1E40AF] text-white text-xs font-bold rounded-xl"
                    >
                      保存配置
                    </button>
                  )}
                </div>
                
              </>
            )}
            
            {/* 概率调整弹窗 */}
            {showProbabilityModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-4 w-full max-w-sm max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">调整中奖概率</h3>
                    <button
                      onClick={() => {
                        setShowProbabilityModal(false);
                        setProbabilityEditList([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-4">
                    设置每个奖品的中奖概率，总概率必须等于 100%
                  </p>
                  
                  <div className="space-y-2">
                    {[...prizes].sort((a, b) => (b.probability || 0) - (a.probability || 0)).map((prize) => {
                      const prizeIndex = prizes.findIndex(p => p.id === prize.id);
                      return (
                        <div key={prize.id} className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                            <Gift size={12} />
                          </div>
                          <span className="text-xs text-gray-700 flex-1 truncate">{prize.name}</span>
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              value={probabilityEditList[prizeIndex] || prize.probability.toString()}
                              onChange={(e) => {
                                const newList = [...(probabilityEditList.length ? probabilityEditList : prizes.map(p => p.probability.toString()))];
                                newList[prizeIndex] = e.target.value;
                                setProbabilityEditList(newList);
                              }}
                              placeholder="0"
                              min="0"
                              max="100"
                              step="0.1"
                              className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">总概率</span>
                      <span className={`font-bold ${totalProbability === 100 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalProbability.toFixed(1)}%
                      </span>
                    </div>
                    {totalProbability !== 100 && (
                      <p className="text-[10px] text-red-500 mt-1">
                        总概率必须等于 100%
                      </p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => {
                        setShowProbabilityModal(false);
                        setProbabilityEditList([]);
                      }}
                      className="flex-1 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl"
                    >
                      取消
                    </button>
                    <button
                      onClick={updateAllProbabilities}
                      disabled={loading || totalProbability !== 100}
                      className="flex-1 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 编辑奖品弹窗 */}
            {showEditPrizeModal && editingPrize && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">编辑奖品</h3>
                    <button
                      onClick={() => {
                        setShowEditPrizeModal(false);
                        setEditingPrize(null);
                        setEditPrizeName('');
                        setEditPrizeValue('');
                        setEditPrizeType('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">奖品名称</label>
                      <input
                        type="text"
                        value={editPrizeName}
                        onChange={(e) => setEditPrizeName(e.target.value)}
                        placeholder="输入奖品名称"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">奖品金额</label>
                      <input
                        type="number"
                        value={editPrizeValue}
                        onChange={(e) => setEditPrizeValue(e.target.value)}
                        placeholder="输入奖品金额"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">奖品类型</label>
                      <select
                        value={editPrizeType}
                        onChange={(e) => setEditPrizeType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      >
                        <option value="">选择类型</option>
                        <option value="cash">现金</option>
                        <option value="gold">黄金</option>
                        <option value="gift">礼品</option>
                        <option value="coupon">优惠券</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => {
                        setShowEditPrizeModal(false);
                        setEditingPrize(null);
                        setEditPrizeName('');
                        setEditPrizeValue('');
                        setEditPrizeType('');
                      }}
                      className="flex-1 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl"
                    >
                      取消
                    </button>
                    <button
                      onClick={updatePrizeInfo}
                      disabled={loading}
                      className="flex-1 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 添加阈值弹窗 */}
            {addingThreshold && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-4 w-full max-w-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">添加阈值</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">广告数量</label>
                      <input
                        type="text"
                        value={newAdCount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setNewAdCount(value);
                        }}
                        placeholder="输入广告数量"
                        dir="ltr"
                        inputMode="numeric"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF] text-left"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">抽奖次数</label>
                      <input
                        type="number"
                        value={newGiveChances}
                        onChange={(e) => setNewGiveChances(e.target.value)}
                        placeholder="输入抽奖次数"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => {
                        setAddingThreshold(false);
                        setNewAdCount('');
                        setNewGiveChances('');
                      }}
                      className="flex-1 py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl"
                    >
                      取消
                    </button>
                    <button
                      onClick={addThreshold}
                      className="flex-1 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}
            

          </div>
        )}

        {/* 抽奖记录 */}
        {activeTab === 'lotteryRecords' && (
          <div className="space-y-4">
            {/* 筛选区域 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <label className="text-xs font-medium text-gray-500">选择日期</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  {selectedDate && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      全部记录
                    </button>
                  )}
                  <button
                    onClick={fetchLotteryRecords}
                    disabled={loading}
                    className="px-4 py-1.5 bg-[#1E40AF] text-white text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    查询
                  </button>
                </div>
              </div>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">抽奖总次数</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{lotteryStats.totalCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Gift size={20} className="text-[#1E40AF]" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">累计发放奖金</p>
                    <p className="text-xl font-bold text-[#1E40AF] mt-1">¥{lotteryStats.totalPrize.toFixed(2)}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <Coins size={20} className="text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 抽奖记录列表 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">抽奖记录</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="py-20 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                    <p className="text-xs text-gray-400 font-bold">加载中...</p>
                  </div>
                ) : lotteryRecords.length === 0 ? (
                  <div className="py-20 text-center">
                    <AlertCircle size={40} className="mx-auto mb-2 text-gray-200" />
                    <p className="text-xs text-gray-400 font-medium">暂无抽奖记录</p>
                  </div>
                ) : (
                  lotteryRecords.map((record) => (
                    <div key={record.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-gray-900">{record.employeeId}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            record.prizeType === 'cash' ? 'bg-green-100 text-green-600' :
                            record.prizeType === 'gold' ? 'bg-yellow-100 text-yellow-600' :
                            record.prizeType === 'encourage' ? 'bg-gray-100 text-gray-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {record.prizeType === 'cash' ? '现金' : 
                             record.prizeType === 'gold' ? '黄金' : 
                             record.prizeType === 'encourage' ? '再接再厉' : '礼品'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(record.time).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#1E40AF]">¥{record.prizeValue.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{record.prizeName}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
