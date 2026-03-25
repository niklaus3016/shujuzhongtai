import React, { useState, useEffect } from 'react';
import { Settings, Smartphone, TrendingDown, Check, AlertTriangle, ChevronLeft } from 'lucide-react';

interface DeviceLimitManagementProps {
  onBack: () => void;
}

interface Device {
  _id: string;
  deviceId: string;
  isLimited: boolean;
  consecutiveLowValueCount: number;
  lastUpdated: string;
}

interface Config {
  consecutiveLimit: number;
  goldThreshold: number;
}

const DeviceLimitManagement: React.FC<DeviceLimitManagementProps> = ({ onBack }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [config, setConfig] = useState<Config>({
    consecutiveLimit: 10,
    goldThreshold: 50
  });
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  // 获取设备列表
  const fetchDevices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/admin/device/list?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setDevices(result.data.devices);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取配置
  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/device/config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setConfig({
          consecutiveLimit: result.data.consecutiveLimit,
          goldThreshold: result.data.goldThreshold
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      setError('获取配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // 更新配置
  const updateConfig = async () => {
    setConfigLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/device/config', {
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
      console.error('Error updating config:', error);
      setError('更新配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // 重置设备状态
  const resetDevice = async (id?: string) => {
    setResetLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/device/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(id ? { deviceId: id } : {})
      });
      const result = await response.json();
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        // 重新获取设备列表
        fetchDevices();
      } else {
        setError(result.message || '重置设备失败');
      }
    } catch (error) {
      console.error('Error resetting device:', error);
      setError('重置设备失败');
    } finally {
      setResetLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchDevices();
    fetchConfig();
    const intervalId = setInterval(() => {
      fetchDevices();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [page, limit]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Smartphone className="text-gray-500 mr-2" size={24} />
            设备限制管理
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
        {/* 配置管理 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Settings size={20} className="text-gray-500" />
            <span>配置管理</span>
          </h2>

          {configLoading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6">
              {/* 连续低价值记录限制 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">连续低价值记录限制</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.consecutiveLimit}
                    onChange={(e) => setConfig({ ...config, consecutiveLimit: parseInt(e.target.value) })}
                    placeholder="例如：10"
                    min="1"
                    step="1"
                    disabled={configLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">条</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  连续低价值记录达到此数量时，设备将被限制
                </p>
              </div>

              {/* 金币阈值 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">金币阈值</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.goldThreshold}
                    onChange={(e) => setConfig({ ...config, goldThreshold: parseInt(e.target.value) })}
                    placeholder="例如：50"
                    min="1"
                    step="1"
                    disabled={configLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-bold">金币</div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  低于此金币数的记录视为低价值记录
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={updateConfig}
                  disabled={configLoading}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${configLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-[#1E40AF] text-white hover:bg-blue-700'}`}
                >
                  {configLoading ? '保存中...' : '保存设置'}
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

        {/* 设备管理 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2">
            <Smartphone size={20} className="text-gray-500" />
            <span>设备管理</span>
            <button
              onClick={fetchDevices}
              disabled={loading}
              className="ml-auto flex items-center space-x-1 text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{animationPlayState: loading ? 'running' : 'paused'}}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>刷新</span>
            </button>
          </h2>

          {/* 重置设备 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-2">重置设备状态</h3>
            <div className="flex space-x-3">
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="输入设备ID（留空重置所有设备）"
                disabled={resetLoading}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <button
                onClick={() => resetDevice(deviceId || undefined)}
                disabled={resetLoading}
                className={`px-4 py-3 text-sm font-bold rounded-xl transition-all ${resetLoading ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-[#1E40AF] text-white hover:bg-blue-700'}`}
              >
                {resetLoading ? '重置中...' : '重置'}
              </button>
            </div>
          </div>

          {/* 设备列表 */}
          {loading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Smartphone size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无设备记录</p>
            </div>
          ) : (
            <div>
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device._id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center mb-1">
                      <span className="text-sm font-bold text-gray-900">设备ID: {device.deviceId}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <span className="text-gray-400">连续低价值记录：</span>
                      <span className="font-medium">{device.consecutiveLowValueCount}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        onClick={() => resetDevice(device.deviceId)}
                        disabled={resetLoading}
                        className="text-xs font-bold text-[#1E40AF] hover:text-blue-700 transition-colors"
                      >
                        重置此设备
                      </button>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${device.isLimited ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {device.isLimited ? '已限制' : '正常'}
                      </span>
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
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${page === 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={devices.length < limit}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${devices.length < limit ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    下一页
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
            <li>• 连续低价值记录限制：连续低价值记录达到此数量时，设备将被限制</li>
            <li>• 金币阈值：低于此金币数的记录视为低价值记录</li>
            <li>• 设备状态：正常状态的设备可以正常匹配广告，被限制的设备无法匹配广告</li>
            <li>• 重置设备：可以重置单个设备或所有设备的状态</li>
          </ul>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="fixed top-4 right-4 p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl flex items-center space-x-2 z-50">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceLimitManagement;