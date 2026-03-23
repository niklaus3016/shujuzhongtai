import React, { useState, useEffect } from 'react';
import { ChevronLeft, Wallet, Settings, Plus, Check, AlertTriangle } from 'lucide-react';

interface RedPacketManagementProps {
  onBack: () => void;
}

const RedPacketManagement: React.FC<RedPacketManagementProps> = ({ onBack }) => {
  const [config, setConfig] = useState({
    enabled: false,
    triggerRate: 0.1,
    extractRate: 0.05
  });
  const [poolBalance, setPoolBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // 获取红包配置
  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/red-packet/config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setConfig(result.data);
      }
    } catch (error) {
      console.error('Error fetching red packet config:', error);
      setError('获取红包配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // 获取红包池余额
  const fetchPoolBalance = async () => {
    setPoolLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/red-packet/pool', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setPoolBalance(result.data.balance);
      }
    } catch (error) {
      console.error('Error fetching red packet pool:', error);
      setError('获取红包池余额失败');
    } finally {
      setPoolLoading(false);
    }
  };

  // 更新红包配置
  const updateConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/red-packet/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        setError(result.message || '更新配置失败');
      }
    } catch (error) {
      console.error('Error updating red packet config:', error);
      setError('更新配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加金币到红包池
  const addToPool = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('请输入有效的金币数量');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/red-packet/pool/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });
      const result = await response.json();
      if (result.success) {
        setPoolBalance(poolBalance + amount);
        setAddAmount('');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      } else {
        setError(result.message || '添加金币失败');
      }
    } catch (error) {
      console.error('Error adding to red packet pool:', error);
      setError('添加金币失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPoolBalance();
  }, []);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Wallet className="text-red-500 mr-2" size={24} />
            红包玩法管理
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
        {/* 红包配置 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Settings size={20} className="text-red-500" />
            <span>红包配置</span>
          </h2>

          {configLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 红包开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">红包玩法开关</h3>
                  <p className="text-xs text-gray-500 mt-0.5">开启后，用户观看视频时可能获得红包</p>
                </div>
                <div 
                  className={`w-12 h-7 rounded-full p-1 transition-all ${config.enabled ? 'bg-green-500' : 'bg-gray-300'} cursor-pointer`}
                  onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              {/* 触发概率 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">红包触发概率</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.triggerRate * 100}
                    onChange={(e) => setConfig({ ...config, triggerRate: parseFloat(e.target.value) / 100 })}
                    placeholder="例如：10"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">%</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  用户观看视频时触发红包的概率，范围：0-100%
                </p>
              </div>

              {/* 抽取百分比 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">红包抽取百分比</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.extractRate * 100}
                    onChange={(e) => setConfig({ ...config, extractRate: parseFloat(e.target.value) / 100 })}
                    placeholder="例如：5"
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">%</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  从视频收益中抽取作为红包的百分比，范围：0-100%
                </p>
              </div>

              {/* 保存按钮 */}
              <button
                onClick={updateConfig}
                disabled={loading}
                className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${loading ? 'bg-red-100 text-red-300 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
              >
                {loading ? '保存中...' : '保存配置'}
              </button>

              {/* 成功提示 */}
              {showSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-600 text-sm font-medium rounded-xl flex items-center space-x-2">
                  <Check size={16} />
                  <span>设置保存成功！</span>
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center space-x-2">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 红包池管理 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Wallet size={20} className="text-red-500" />
            <span>红包池管理</span>
          </h2>

          {poolLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 红包池余额 */}
              <div className="p-4 bg-red-50 rounded-xl">
                <h3 className="text-sm font-bold text-gray-900 mb-2">当前红包池余额</h3>
                <p className="text-2xl font-bold text-red-500">{poolBalance.toLocaleString()} 金币</p>
                <p className="text-xs text-gray-500 mt-2">
                  红包池余额用于发放用户红包
                </p>
              </div>

              {/* 添加金币 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">往红包池添加金币</label>
                <div className="flex space-x-3">
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="输入金币数量"
                    min="0"
                    step="1"
                    disabled={loading}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={addToPool}
                    disabled={loading}
                    className={`px-4 py-3 text-sm font-bold rounded-xl transition-all ${loading ? 'bg-red-100 text-red-300 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
                  >
                    <Plus size={16} className="inline mr-1" />
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center space-x-2">
            <Settings size={16} />
            <span>使用说明</span>
          </h3>
          <ul className="text-xs text-blue-600 space-y-2">
            <li>• 红包玩法开关：控制是否开启红包功能</li>
            <li>• 触发概率：用户观看视频时获得红包的概率</li>
            <li>• 抽取百分比：从视频收益中抽取作为红包的比例</li>
            <li>• 红包池：存放用于发放红包的金币</li>
            <li>• 当红包池余额为0时，即使触发红包也不会发放</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RedPacketManagement;