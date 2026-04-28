import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Wallet, Search, Filter, CheckCircle, XCircle, Clock,
  TrendingUp, DollarSign, Download, RefreshCw
} from 'lucide-react';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface WithdrawalRecord {
  _id: string;
  userId: string;
  employeeId: string | null;
  amount: number;
  status: number;
  createTime: string;
  processTime?: string;
  remark?: string;
  alipayAccount: string;
  alipayName: string;
  goldAmount: number;
  statusText: string;
}

interface WithdrawalManagementProps {
  onBack: () => void;
}

const WithdrawalManagement: React.FC<WithdrawalManagementProps> = ({ onBack }) => {
  const [records, setRecords] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [employeeId, setEmployeeId] = useState('');
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    approvedAmount: 0,
    pendingAmount: 0,
    rejectedAmount: 0
  });
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const [allRecords, setAllRecords] = useState<WithdrawalRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [allTimeStats, setAllTimeStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    approvedAmount: 0,
    pendingAmount: 0,
    rejectedAmount: 0
  });
  
  // 获取统计数据（单独请求）
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/admin/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      console.log('统计数据响应:', result);
      if (result.success && result.data) {
        setAllTimeStats({
          total: result.data.total || 0,
          pending: result.data.pending || 0,
          approved: result.data.approved || 0,
          rejected: result.data.rejected || 0,
          totalAmount: result.data.totalAmount || 0,
          approvedAmount: result.data.approvedAmount || 0,
          pendingAmount: result.data.pendingAmount || 0,
          rejectedAmount: result.data.rejectedAmount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching stats, will fallback to list data:', error);
    }
  };
  
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      // 构建查询参数 - 请求所有数据用于统计（不分页）
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('pageSize', '1000'); // 请求大量数据
      if (employeeId) {
        params.append('employeeId', employeeId);
      }
      
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/admin/list?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      console.log('提现记录响应:', result);
      if (result.success) {
        const list = result.data?.list || [];
        setAllRecords(list);
        // 根据筛选条件过滤显示的数据（只显示前20条用于分页）
        const displayList = list.slice(0, pageSize);
        const filteredList = statusFilter === -1 ? displayList : displayList.filter(r => r.status === statusFilter);
        setRecords(filteredList);
        
        // 更新分页信息
        const totalCount = result.data?.pagination?.total || list.length;
        setTotal(totalCount);
        setTotalPages(Math.ceil(totalCount / pageSize));
        
        // 计算全量统计数据
        const totalAmount = list.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const approvedAmount = list.filter((r: any) => r.status === 1).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const pendingAmount = list.filter((r: any) => r.status === 0).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const rejectedAmount = list.filter((r: any) => r.status === 2).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        
        // 设置全量统计数据
        setAllTimeStats({
          total: totalCount,
          pending: list.filter((r: any) => r.status === 0).length,
          approved: list.filter((r: any) => r.status === 1).length,
          rejected: list.filter((r: any) => r.status === 2).length,
          totalAmount,
          approvedAmount,
          pendingAmount,
          rejectedAmount
        });
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // 同时请求列表数据和统计数据
    fetchRecords();
    fetchStats();
  }, [page, pageSize, employeeId]);
  
  // 筛选状态变化时只在前端过滤，不重新请求
  useEffect(() => {
    // 根据当前页码计算显示的数据范围
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const displayList = allRecords.slice(startIndex, endIndex);
    const filteredList = statusFilter === -1 ? displayList : displayList.filter(r => r.status === statusFilter);
    setRecords(filteredList);
  }, [statusFilter, allRecords, page, pageSize]);

  const handleProcess = async (id: string, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      // 刷新列表和统计数据
      fetchRecords();
      fetchStats();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
    }
  };

  const handleBatchProcess = async (action: 'approve' | 'reject') => {
    if (selectedRecords.length === 0) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      for (const id of selectedRecords) {
        await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/${id}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
      setSelectedRecords([]);
      setSelectAll(false);
      // 刷新列表和统计数据
      fetchRecords();
      fetchStats();
    } catch (error) {
      console.error('Error batch processing:', error);
    }
  };

  const handleExport = () => {
    // 使用全部数据导出，而不是当前页数据
    const exportRecords = statusFilter === -1 
      ? allRecords 
      : allRecords.filter(r => r.status === statusFilter);
    
    if (exportRecords.length === 0) {
      alert('暂无记录可导出');
      return;
    }

    // 生成CSV内容
    const headers = ['员工ID', '金额', '支付宝帐号', '支付宝姓名', '状态', '申请时间'];
    const rows = exportRecords.map(record => [
      record.employeeId || '',
      record.amount.toFixed(2),
      record.alipayAccount,
      record.alipayName,
      record.status === 0 ? '待处理' : record.status === 1 ? '已打款' : '已拒绝',
      new Date(record.createTime).toLocaleString('zh-CN')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `提现记录_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg">待处理</span>;
      case 1:
        return <span className="px-2 py-1 text-[10px] font-bold bg-green-50 text-green-600 rounded-lg">已打款</span>;
      case 2:
        return <span className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg">已拒绝</span>;
      default:
        return null;
    }
  };

  const filteredRecords = statusFilter === -1 
    ? records 
    : records.filter(r => r.status === statusFilter);

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">提现管理</h1>
        <button 
          onClick={fetchRecords} 
          className="p-2 text-gray-400 active:text-gray-900" 
          title="刷新"
        >
          <RefreshCw size={20} />
        </button>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已打款金额</span>
            </div>
            <p className="text-xl font-black">¥ {allTimeStats.approvedAmount.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">待处理金额</span>
            </div>
            <p className="text-xl font-black">¥ {allTimeStats.pendingAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已拒绝金额</span>
            </div>
            <p className="text-xl font-black">¥ {allTimeStats.rejectedAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Wallet size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">总记录数</span>
            </div>
            <p className="text-xl font-black text-gray-900">{allTimeStats.total}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-yellow-600">{allTimeStats.pending}</p>
            <p className="text-[10px] text-yellow-500">待处理</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-green-600">{allTimeStats.approved}</p>
            <p className="text-[10px] text-green-500">已打款</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-red-500">{allTimeStats.rejected}</p>
            <p className="text-[10px] text-red-400">已拒绝</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar mb-2">
          <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
            {([0, 1, 2, -1] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  statusFilter === status 
                    ? 'bg-[#1E40AF] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                {status === -1 ? '全部' : status === 0 ? '待处理' : status === 1 ? '已打款' : '已拒绝'}
              </button>
            ))}
          </div>
          <div className="flex-shrink-0 ml-auto">
            <button
              onClick={handleExport}
              className="flex-shrink-0 px-4 py-2 text-xs font-bold bg-blue-50 text-[#1E40AF] rounded-xl flex items-center space-x-1"
            >
              <Download size={14} />
              <span>导出</span>
            </button>
          </div>
        </div>

        {statusFilter === 0 && filteredRecords.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    const allIds = filteredRecords.map(r => r._id);
                    setSelectAll(e.target.checked);
                    setSelectedRecords(e.target.checked ? allIds : []);
                  }}
                  className="w-4 h-4 text-[#1E40AF] rounded border-gray-300 focus:ring-[#1E40AF]"
                />
                <span className="text-xs font-bold text-gray-700">全选</span>
                <span className="text-xs text-gray-400">({selectedRecords.length}/{filteredRecords.length})</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBatchProcess('approve')}
                  disabled={selectedRecords.length === 0}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedRecords.length > 0 
                      ? 'bg-green-50 text-green-600' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  批量通过
                </button>
                <button
                  onClick={() => handleBatchProcess('reject')}
                  disabled={selectedRecords.length === 0}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedRecords.length > 0 
                      ? 'bg-red-50 text-red-500' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  批量拒绝
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <div key={record._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">

                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#1E40AF] font-bold text-xs">
                      {record.employeeId}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">¥ {record.amount.toFixed(2)}</h3>
                      <p className="text-[10px] text-gray-400 mt-1">
                        支付宝帐号: {record.alipayAccount}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        支付宝姓名: {record.alipayName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(record.status)}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(record.createTime).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                
                {record.status === 0 && (
                  <div className="flex space-x-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleProcess(record._id, 'approve')}
                      className="flex-1 py-2 bg-green-50 text-green-600 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      <CheckCircle size={14} />
                      <span>通过</span>
                    </button>
                    <button
                      onClick={() => handleProcess(record._id, 'reject')}
                      className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                    >
                      <XCircle size={14} />
                      <span>拒绝</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filteredRecords.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Wallet size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无提现记录</p>
              </div>
            )}
            
            {/* 分页导航 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    page === 1 
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                      : 'bg-white text-gray-700 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  上一页
                </button>
                <span className="text-xs text-gray-400">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    page === totalPages 
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                      : 'bg-white text-gray-700 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawalManagement;
