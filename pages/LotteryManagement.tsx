import React, { useState, useEffect } from 'react';
import { Wallet, Settings, Gift, Trophy, ChevronLeft, Check, AlertTriangle } from 'lucide-react';

interface LotteryManagementProps {
  onBack: () => void;
}

interface LotterySettings {
  poolPercentage: number;
  drawTime: string;
  adCountThreshold: number;
  enabled: boolean;
  firstPrizePercentage: number;
  secondPrizePercentage: number;
  thirdPrizePercentage: number;
  firstPrizeCount: number;
  secondPrizeCount: number;
  thirdPrizeCount: number;
}

const LotteryManagement: React.FC<LotteryManagementProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<LotterySettings>({
    poolPercentage: 0.025,
    drawTime: '20:00',
    adCountThreshold: 100,
    enabled: true,
    firstPrizePercentage: 0.5,
    secondPrizePercentage: 0.3,
    thirdPrizePercentage: 0.2,
    firstPrizeCount: 1,
    secondPrizeCount: 1,
    thirdPrizeCount: 1
  });
  const [poolBalance, setPoolBalance] = useState(0);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [firstPrizeUserId, setFirstPrizeUserId] = useState('');
  const [secondPrizeUserId, setSecondPrizeUserId] = useState('');
  const [thirdPrizeUserId, setThirdPrizeUserId] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [showDrawConfirm, setShowDrawConfirm] = useState(false);

  // 获取彩票设置
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/lottery/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('获取设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  // 获取奖金池状态
  const fetchPoolBalance = async () => {
    setPoolLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/lottery/pool', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setPoolBalance(result.data.balance || result.data.currentAmount || 0);
      }
    } catch (error) {
      console.error('Error fetching pool balance:', error);
      setError('获取奖金池状态失败');
    } finally {
      setPoolLoading(false);
    }
  };

  // 更新彩票设置
  const updateSettings = async () => {
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/lottery/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          poolPercentage: settings.poolPercentage,
          drawTime: settings.drawTime,
          adCountThreshold: settings.adCountThreshold,
          enabled: settings.enabled,
          firstPrizePercentage: settings.firstPrizePercentage,
          secondPrizePercentage: settings.secondPrizePercentage,
          thirdPrizePercentage: settings.thirdPrizePercentage,
          firstPrizeCount: settings.firstPrizeCount,
          secondPrizeCount: settings.secondPrizeCount,
          thirdPrizeCount: settings.thirdPrizeCount
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        setError(result.message || '更新设置失败');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      setError('更新设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  // 向奖金池添加金币
  const addToPool = async () => {
    if (!addAmount || addAmount.trim() === '') {
      setError('请输入添加金额');
      return;
    }

    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('请输入有效的金额');
      return;
    }

    setPoolLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/lottery/add-to-pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setAddAmount('');
        // 重新获取奖金池余额
        fetchPoolBalance();
      } else {
        setError(result.message || '添加金币失败');
      }
    } catch (error) {
      console.error('Error adding to pool:', error);
      setError('添加金币失败');
    } finally {
      setPoolLoading(false);
    }
  };

  // 设置指定中奖用户
  const setWinners = async () => {
    if (!firstPrizeUserId || firstPrizeUserId.trim() === '') {
      setError('请输入一等奖用户ID');
      return;
    }

    setDrawLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/lottery/set-winners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          firstPrizeUserId, 
          secondPrizeUserId, 
          thirdPrizeUserId 
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        setFirstPrizeUserId('');
        setSecondPrizeUserId('');
        setThirdPrizeUserId('');
      } else {
        setError(result.message || '设置中奖用户失败');
      }
    } catch (error) {
      console.error('Error setting winners:', error);
      setError('设置中奖用户失败');
    } finally {
      setDrawLoading(false);
    }
  };

  // 手动执行开奖
  const draw = async () => {
    setDrawLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/lottery/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        // 重新获取奖金池余额
        fetchPoolBalance();
        // 重新获取历史开奖记录
        fetchHistory();
      } else {
        setError(result.message || '开奖失败');
      }
    } catch (error) {
      console.error('Error drawing:', error);
      setError('开奖失败');
    } finally {
      setDrawLoading(false);
    }
  };

  // 获取历史开奖记录
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const url = `https://wfqmaepvjkdd.sealoshzh.site/api/lottery/history?page=${page}&limit=${limit}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setHistory(result.data.history);
        setTotal(result.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setError('获取历史开奖记录失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchSettings();
    fetchPoolBalance();
    fetchHistory();
    const intervalId = setInterval(() => {
      fetchPoolBalance();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [page, limit]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Gift className="text-yellow-500 mr-2" size={24} />
            幸运彩票管理
          </h1>
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl flex items-center space-x-1"
          >
            <ChevronLeft size={16} />
            <span>返回</span>
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 奖金池管理 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Wallet size={20} className="text-yellow-500" />
            <span>奖金池管理</span>
          </h2>

          {poolLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 奖金池余额 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">当前奖金池余额</label>
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-600">{poolBalance.toFixed(2).toLocaleString()} 金币</p>
                </div>
              </div>

              {/* 向奖金池添加金币 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">向奖金池添加金币</label>
                <div className="space-y-3">
                  <div className="flex space-x-3">
                    <input
                      type="number"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="输入金额"
                      min="1"
                      step="1"
                      disabled={poolLoading}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <button
                      onClick={addToPool}
                      disabled={poolLoading}
                      className={`px-4 py-3 text-sm font-bold rounded-xl transition-all ${poolLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                    >
                      {poolLoading ? '添加中...' : '添加'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 彩票设置 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Settings size={20} className="text-yellow-500" />
            <span>彩票设置</span>
          </h2>

          {settingsLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 彩票功能开关 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">彩票功能开关</label>
                <div 
                  className="relative inline-block w-12 h-7 rounded-full p-1 transition-all cursor-pointer"
                  onClick={async () => {
                    const newEnabled = !settings.enabled;
                    setSettings({ ...settings, enabled: newEnabled });
                    
                    try {
                      const token = localStorage.getItem('admin_token');
                      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/lottery/settings', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ enabled: newEnabled })
                      });
                      const result = await response.json();
                      if (!result.success) {
                        // 如果接口调用失败，恢复原来的状态
                        setSettings({ ...settings, enabled: !newEnabled });
                        setError(result.message || '更新设置失败');
                      } else {
                        setShowSuccess(true);
                        setTimeout(() => setShowSuccess(false), 2000);
                      }
                    } catch (error) {
                      console.error('Error updating lottery enabled status:', error);
                      // 如果接口调用失败，恢复原来的状态
                      setSettings({ ...settings, enabled: !newEnabled });
                      setError('更新设置失败');
                    }
                  }}
                >
                  <div className={`absolute inset-0 rounded-full transition-all ${settings.enabled ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                  <div 
                    className={`relative z-10 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${settings.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {settings.enabled ? '彩票功能已开启' : '彩票功能已关闭'}
                </p>
              </div>

              {/* 奖金池注入百分比 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">奖金池注入百分比</label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.poolPercentage * 100}
                    onChange={(e) => setSettings({ ...settings, poolPercentage: parseFloat(e.target.value) / 100 || 0 })}
                    placeholder="例如：2.5"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={settingsLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">%</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  每次用户获得金币时，按此比例计算添加到奖金池的金额
                </p>
              </div>

              {/* 广告次数阈值 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">广告次数阈值</label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.adCountThreshold}
                    onChange={(e) => setSettings({ ...settings, adCountThreshold: parseInt(e.target.value) || 100 })}
                    placeholder="例如：100"
                    min="1"
                    step="1"
                    disabled={settingsLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">次</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  用户每日广告观看次数达到此阈值时，自动生成奖券
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={updateSettings}
                  disabled={settingsLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${settingsLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                >
                  {settingsLoading ? '保存中...' : '保存设置'}
                </button>
              </div>

              {showSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-600 text-sm font-medium rounded-xl flex items-center space-x-2">
                  <Check size={16} />
                  <span>设置保存成功！</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 奖金分配设置 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Settings size={20} className="text-yellow-500" />
            <span>奖金分配设置</span>
          </h2>

          {settingsLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 一等奖设置 */}
              <div className="p-4 border border-gray-100 rounded-xl">
                <h3 className="text-sm font-bold text-gray-700 mb-3">一等奖</h3>
                <div className="flex flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">奖金比例</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.firstPrizePercentage * 100}
                        onChange={(e) => setSettings({ ...settings, firstPrizePercentage: parseFloat(e.target.value) / 100 || 0 })}
                        placeholder="例如：50"
                        min="0"
                        max="100"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-bold">%</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">占总奖金的比例</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">获奖人数</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.firstPrizeCount}
                        onChange={(e) => setSettings({ ...settings, firstPrizeCount: parseInt(e.target.value) || 1 })}
                        placeholder="例如：1"
                        min="1"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">每期获奖人数</p>
                  </div>
                </div>
              </div>

              {/* 二等奖设置 */}
              <div className="p-4 border border-gray-100 rounded-xl">
                <h3 className="text-sm font-bold text-gray-700 mb-3">二等奖</h3>
                <div className="flex flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">奖金比例</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.secondPrizePercentage * 100}
                        onChange={(e) => setSettings({ ...settings, secondPrizePercentage: parseFloat(e.target.value) / 100 || 0 })}
                        placeholder="例如：30"
                        min="0"
                        max="100"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-bold">%</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">占总奖金的比例</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">获奖人数</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.secondPrizeCount}
                        onChange={(e) => setSettings({ ...settings, secondPrizeCount: parseInt(e.target.value) || 1 })}
                        placeholder="例如：1"
                        min="1"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">每期获奖人数</p>
                  </div>
                </div>
              </div>

              {/* 三等奖设置 */}
              <div className="p-4 border border-gray-100 rounded-xl">
                <h3 className="text-sm font-bold text-gray-700 mb-3">三等奖</h3>
                <div className="flex flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">奖金比例</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.thirdPrizePercentage * 100}
                        onChange={(e) => setSettings({ ...settings, thirdPrizePercentage: parseFloat(e.target.value) / 100 || 0 })}
                        placeholder="例如：20"
                        min="0"
                        max="100"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-bold">%</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">占总奖金的比例</p>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">获奖人数</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.thirdPrizeCount}
                        onChange={(e) => setSettings({ ...settings, thirdPrizeCount: parseInt(e.target.value) || 1 })}
                        placeholder="例如：1"
                        min="1"
                        step="1"
                        disabled={settingsLoading}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">每期获奖人数</p>
                  </div>
                </div>
              </div>

              {/* 开奖时间 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">开奖时间</label>
                <input
                  type="time"
                  value={settings.drawTime}
                  onChange={(e) => setSettings({ ...settings, drawTime: e.target.value })}
                  disabled={settingsLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  每天自动开奖的时间
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={updateSettings}
                  disabled={settingsLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${settingsLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                >
                  {settingsLoading ? '保存中...' : '保存设置'}
                </button>
              </div>

              {showSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-600 text-sm font-medium rounded-xl flex items-center space-x-2">
                  <Check size={16} />
                  <span>设置保存成功！</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 开奖管理 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy size={20} className="text-yellow-500" />
              <span>开奖管理</span>
            </div>
            <button
              onClick={() => setShowDrawConfirm(true)}
              disabled={drawLoading}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${drawLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
            >
              立即开奖
            </button>
          </h2>

          <div className="space-y-6">
            {/* 设置指定中奖用户 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">设置指定中奖用户</label>
              <div className="space-y-3">
                <input
                  type="text"
                  value={firstPrizeUserId}
                  onChange={(e) => setFirstPrizeUserId(e.target.value)}
                  placeholder="输入一等奖用户ID"
                  disabled={drawLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <input
                  type="text"
                  value={secondPrizeUserId}
                  onChange={(e) => setSecondPrizeUserId(e.target.value)}
                  placeholder="输入二等奖用户ID（可选）"
                  disabled={drawLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <input
                  type="text"
                  value={thirdPrizeUserId}
                  onChange={(e) => setThirdPrizeUserId(e.target.value)}
                  placeholder="输入三等奖用户ID（可选）"
                  disabled={drawLoading}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={setWinners}
                  disabled={drawLoading}
                  className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${drawLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                >
                  {drawLoading ? '设置中...' : '设置'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                设置后，开奖时将使用指定用户作为中奖者
              </p>
            </div>
          </div>
        </div>

        {/* 历史开奖记录 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Trophy size={20} className="text-yellow-500" />
            <span>历史开奖记录</span>
          </h2>

          {historyLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Trophy size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无开奖记录</p>
            </div>
          ) : (
            <div>
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900">期号：{item.issueNumber}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-600">
                        {item.drawType === '指定' ? '指定开奖' : '随机开奖'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-400">开奖时间：</span>
                        <span className="font-medium">{new Date(item.drawTime).toLocaleString('zh-CN')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">奖金池金额：</span>
                        <span className="font-medium">{parseFloat(item.poolAmount).toFixed(2)} 金币</span>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-yellow-600">一等奖：</span>
                        <span className="text-xs text-gray-600">{parseFloat(item.firstPrize).toFixed(2)} 金币</span>
                        {item.winners && item.winners.firstPrize && item.winners.firstPrize.length > 0 && (
                          <span className="text-xs text-gray-600">
                            中奖者：{item.winners.firstPrize[0].employeeId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-yellow-600">二等奖：</span>
                        <span className="text-xs text-gray-600">{parseFloat(item.secondPrize).toFixed(2)} 金币</span>
                        {item.winners && item.winners.secondPrize && item.winners.secondPrize.length > 0 && (
                          <span className="text-xs text-gray-600">
                            中奖者：{item.winners.secondPrize[0].employeeId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-yellow-600">三等奖：</span>
                        <span className="text-xs text-gray-600">{parseFloat(item.thirdPrize).toFixed(2)} 金币</span>
                        {item.winners && item.winners.thirdPrize && item.winners.thirdPrize.length > 0 && (
                          <span className="text-xs text-gray-600">
                            中奖者：{item.winners.thirdPrize[0].employeeId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  共 {total} 条记录，当前第 {page} 页
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(page > 1 ? page - 1 : 1)}
                    disabled={page === 1}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${page === 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={history.length < limit}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${history.length < limit ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
          <h3 className="text-sm font-bold text-yellow-800 mb-2 flex items-center space-x-2">
            <Settings size={16} />
            <span>使用说明</span>
          </h3>
          <ul className="text-xs text-yellow-600 space-y-2">
            <li>• 彩票功能开关：控制彩票功能的开启和关闭</li>
            <li>• 奖券生成阈值：用户每日广告观看次数达到此阈值时，自动生成奖券</li>
            <li>• 奖金池比例：每次用户获得金币时，按此比例计算添加到奖金池的金额</li>
            <li>• 开奖时间：每天自动开奖的时间</li>
            <li>• 手动开奖：可以在任何时间手动执行开奖</li>
            <li>• 奖金分配：按照一等奖{(settings.firstPrizePercentage * 100).toFixed(0)}%（{settings.firstPrizeCount}人）、二等奖{(settings.secondPrizePercentage * 100).toFixed(0)}%（{settings.secondPrizeCount}人）、三等奖{(settings.thirdPrizePercentage * 100).toFixed(0)}%（{settings.thirdPrizeCount}人）分配奖金</li>
          </ul>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="fixed top-4 right-4 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center space-x-2 z-50">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 开奖确认弹窗 */}
        {showDrawConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">确认开奖</h3>
              <p className="text-gray-600 mb-6">
                确定要立即执行开奖吗？开奖后将无法撤销。
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDrawConfirm(false)}
                  className="flex-1 py-3 text-sm font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowDrawConfirm(false);
                    draw();
                  }}
                  disabled={drawLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${drawLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}
                >
                  {drawLoading ? '开奖中...' : '确认开奖'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LotteryManagement;