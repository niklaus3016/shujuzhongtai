import React, { useState } from 'react';
import { ChevronLeft, TrendingUp, DollarSign, Check, X } from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface GoldAdjustmentProps {
  onBack: () => void;
}

const GoldAdjustment: React.FC<GoldAdjustmentProps> = ({ onBack }) => {
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  
  const [employeeId, setEmployeeId] = useState('');
  const [currentMonthGold, setCurrentMonthGold] = useState('');
  const [lastMonthGold, setLastMonthGold] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [userGoldInfo, setUserGoldInfo] = useState<any>(null);
  const [fetchingUserInfo, setFetchingUserInfo] = useState(false);

  const fetchUserGoldInfo = async () => {
    if (!employeeId) {
      setError('请输入员工ID');
      return;
    }

    setFetchingUserInfo(true);
    setError('');
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/gold/admin/user/${employeeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('获取用户金币信息失败');
      }
      
      const result = await response.json();
      if (result.success) {
        setUserGoldInfo(result.data);
        setCurrentMonthGold(result.data.currentMonthGold.toString());
        setLastMonthGold(result.data.lastMonthGold.toString());
      } else {
        setError(result.message || '获取用户金币信息失败');
      }
    } catch (err) {
      setError('获取用户金币信息失败，请检查员工ID是否正确');
      console.error('Error fetching user gold info:', err);
    } finally {
      setFetchingUserInfo(false);
    }
  };

  const handleAdjustGold = async () => {
    if (!employeeId) {
      setError('请输入员工ID');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/gold/admin/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeId,
          currentMonthGold: currentMonthGold ? parseInt(currentMonthGold) : undefined,
          lastMonthGold: lastMonthGold ? parseInt(lastMonthGold) : undefined,
          reason
        })
      });
      
      if (!response.ok) {
        throw new Error('调整金币失败');
      }
      
      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        // 重新获取用户金币信息
        fetchUserGoldInfo();
        // 清空输入
        setReason('');
      } else {
        setError(result.message || '调整金币失败');
      }
    } catch (err) {
      setError('调整金币失败，请检查网络连接');
      console.error('Error adjusting gold:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">用户金币调整</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 员工ID输入 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">员工信息</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">员工ID</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="请输入员工ID"
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
                <button
                  onClick={fetchUserGoldInfo}
                  disabled={!employeeId || fetchingUserInfo}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    fetchingUserInfo 
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                      : !employeeId 
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                        : 'bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
                  }`}
                >
                  {fetchingUserInfo ? '查询中...' : '查询'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 用户金币信息 */}
        {userGoldInfo && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">金币信息</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-yellow-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 mb-1">本月累计金币</div>
                <div className="text-lg font-black text-yellow-600">{userGoldInfo.currentMonthGold}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 mb-1">上月累计金币</div>
                <div className="text-lg font-black text-blue-600">{userGoldInfo.lastMonthGold}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 mb-1">总金币</div>
                <div className="text-lg font-black text-green-600">{userGoldInfo.totalGold}</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 mb-1">广告观看次数</div>
                <div className="text-lg font-black text-purple-600">{userGoldInfo.adCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* 金币调整 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">金币调整</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">本月累计金币</label>
              <input
                type="number"
                value={currentMonthGold}
                onChange={(e) => setCurrentMonthGold(e.target.value)}
                placeholder="不填则不调整"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">上月累计金币</label>
              <input
                type="number"
                value={lastMonthGold}
                onChange={(e) => setLastMonthGold(e.target.value)}
                placeholder="不填则不调整"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">调整原因</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请输入调整原因（可选）"
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="pt-2">
          <button
            onClick={handleAdjustGold}
            disabled={loading || !employeeId}
            className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${
              loading 
                ? 'bg-blue-100 text-blue-300 cursor-not-allowed' 
                : !employeeId 
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                  : 'bg-[#1E40AF] text-white hover:bg-blue-700'
            }`}
          >
            {loading ? '调整中...' : '调整金币'}
          </button>
        </div>

        {/* 提示信息 */}
        {error && (
          <div className="bg-red-50 p-3 rounded-xl flex items-center space-x-2">
            <X size={16} className="text-red-500" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 p-3 rounded-xl flex items-center space-x-2">
            <Check size={16} className="text-green-500" />
            <span className="text-sm text-green-600">金币调整成功！</span>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center space-x-2">
            <TrendingUp size={16} />
            <span>使用说明</span>
          </h3>
          <ul className="text-xs text-blue-600 space-y-2">
            <li>• 输入员工ID后点击查询按钮获取用户金币信息</li>
            <li>• 可选择性调整本月累计金币或上月累计金币</li>
            <li>• 调整原因为可选字段，建议填写以便后续追溯</li>
            <li>• 调整后系统会自动更新用户的总金币数</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GoldAdjustment;