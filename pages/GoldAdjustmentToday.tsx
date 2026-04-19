import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, DollarSign, Check, X, Search, Filter } from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface GoldAdjustmentTodayProps {
  onBack: () => void;
}

const GoldAdjustmentToday: React.FC<GoldAdjustmentTodayProps> = ({ onBack }) => {
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  
  // 添加金币记录的状态
  const [employeeId, setEmployeeId] = useState('');
  const [count, setCount] = useState('');
  const [goldPerRecord, setGoldPerRecord] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // 查看金币记录的状态
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalGold, setTotalGold] = useState(0);

  // 加载金币记录
  const fetchGoldRecords = async () => {
    setLoadingRecords(true);
    setError('');
    try {
      const token = localStorage.getItem('admin_token');
      const url = new URL('https://wfqmaepvjkdd.sealoshzh.site/api/admin/admin-gold-records');
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', limit.toString());
      if (filterEmployeeId) {
        url.searchParams.append('employeeId', filterEmployeeId);
      }
      if (filterMonth) {
        url.searchParams.append('month', filterMonth);
      }
      
      console.log('发送请求:', url.toString());
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('获取金币记录失败');
      }
      
      const result = await response.json();
      console.log('收到响应:', result);
      if (result.success) {
        setRecords(result.data.records);
        setTotal(result.data.pagination.total);
        setTotalGold(result.data.summary?.totalGold || 0);
      } else {
        setError(result.message || '获取金币记录失败');
      }
    } catch (err) {
      setError('获取金币记录失败，请检查网络连接');
      console.error('Error fetching gold records:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // 添加金币记录
  const handleAddGoldRecords = async () => {
    if (!employeeId) {
      setError('请输入员工ID');
      return;
    }
    if (!count || parseInt(count) <= 0) {
      setError('请输入有效的记录条数');
      return;
    }
    if (!goldPerRecord || parseInt(goldPerRecord) <= 0) {
      setError('请输入有效的每条金币数量');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/admin/add-gold-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          employeeId,
          count: parseInt(count),
          goldPerRecord: parseInt(goldPerRecord)
        })
      });
      
      if (!response.ok) {
        throw new Error('添加金币记录失败');
      }
      
      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        // 清空输入
        setEmployeeId('');
        setCount('');
        setGoldPerRecord('');
        // 重新加载记录
        fetchGoldRecords();
      } else {
        setError(result.message || '添加金币记录失败');
      }
    } catch (err) {
      setError('添加金币记录失败，请检查网络连接');
      console.error('Error adding gold records:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载记录
  useEffect(() => {
    // 只有当依赖项变化时才重新获取数据
    console.log('依赖项变化，重新获取数据:', { page, limit, filterEmployeeId, filterMonth });
    fetchGoldRecords();
  }, [page, limit, filterEmployeeId, filterMonth]);

  // 处理页码变化
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // 计算总页数
  const totalPages = Math.ceil(total / limit);

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">今日金币调整</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 添加金币记录 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <DollarSign size={18} className="mr-2 text-yellow-500" />
            手动添加金币记录
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">员工ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="请输入员工ID"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">记录条数</label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  placeholder="请输入记录条数"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">每条金币数量</label>
                <input
                  type="number"
                  value={goldPerRecord}
                  onChange={(e) => setGoldPerRecord(e.target.value)}
                  placeholder="请输入每条金币数量"
                  min="1"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="pt-4">
            <button
              onClick={handleAddGoldRecords}
              disabled={loading || !employeeId || !count || !goldPerRecord}
              className={`w-full py-3 text-sm font-bold rounded-xl transition-all ${
                loading 
                  ? 'bg-blue-100 text-blue-300 cursor-not-allowed' 
                  : !employeeId || !count || !goldPerRecord 
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                    : 'bg-[#1E40AF] text-white hover:bg-blue-700'
              }`}
            >
              {loading ? '添加中...' : '添加金币记录'}
            </button>
          </div>
        </div>

        {/* 查看金币记录 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <TrendingUp size={18} className="mr-2 text-green-500" />
            手动金币记录
          </h2>
          
          {/* 筛选条件 */}
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">员工ID</label>
                <input
                  type="text"
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  placeholder="输入员工ID筛选"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">月份</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>
            <div>
              <button
                onClick={() => {
                  setPage(1);
                  fetchGoldRecords();
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 text-[#1E40AF] hover:bg-blue-100"
              >
                <Search size={16} />
                筛选
              </button>
            </div>
          </div>
          
          {/* 统计信息 */}
          <div className="bg-yellow-50 p-3 rounded-xl mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1">总记录数</div>
                <div className="text-lg font-black text-yellow-600">{total}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1">总金币数</div>
                <div className="text-lg font-black text-green-600">{totalGold}</div>
              </div>
            </div>
          </div>
          
          {/* 记录列表 */}
          <div className="space-y-3">
            {loadingRecords ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : records.length > 0 ? (
              records.map((record, index) => (
                <div key={record.id || index} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs font-bold text-gray-400">员工ID</div>
                      <div className="text-sm font-semibold text-gray-900">{record.employeeId}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400">金币数量</div>
                      <div className="text-sm font-semibold text-yellow-600">{record.gold}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs font-bold text-gray-400">创建时间</div>
                      <div className="text-sm text-gray-600">
                        {new Date(record.createTime).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs font-bold text-gray-400">备注</div>
                      <div className="text-sm text-gray-600">{record.remark}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">暂无手动添加的金币记录</p>
              </div>
            )}
          </div>
          
          {/* 分页 */}
          {total > 0 && (
            <div className="mt-4 flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
                  }`}
                >
                  上一页
                </button>
                <span className="text-xs text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
                  }`}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
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
            <span className="text-sm text-green-600">金币记录添加成功！</span>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center space-x-2">
            <TrendingUp size={16} />
            <span>使用说明</span>
          </h3>
          <ul className="text-xs text-blue-600 space-y-2">
            <li>• 输入员工ID、记录条数和每条金币数量</li>
            <li>• 点击"添加金币记录"按钮为用户批量添加金币</li>
            <li>• 系统会自动为每条记录添加类型和备注</li>
            <li>• 下方可查看所有手动添加的金币记录</li>
            <li>• 可通过员工ID筛选特定用户的记录</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GoldAdjustmentToday;