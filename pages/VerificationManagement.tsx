import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Filter, Check, X, Info, Clock, AlertCircle, Download } from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface VerificationManagementProps {
  onBack: () => void;
}

interface VerificationRecord {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  remark?: string;
  invoiceUrl?: string;
}

interface VerificationStats {
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const VerificationManagement: React.FC<VerificationManagementProps> = ({ onBack }) => {
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'approved' | 'rejected'>('all');
  const [stats, setStats] = useState<VerificationStats>({
    totalAmount: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VerificationRecord | null>(null);
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState<'processing' | 'approved' | 'rejected'>('processing');
  const [updating, setUpdating] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const fetchVerificationRecords = async (page: number = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      let url = `https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/pending?page=${page}&limit=10`;
      if (statusFilter !== 'all' && statusFilter !== 'pending') {
        url = `https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/list?status=${statusFilter}&page=${page}&limit=10`;
      }
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setRecords(result.data.records || []);
        setTotal(result.data.total || 0);
        // 重置选择状态
        setSelectAll(false);
        setSelectedRecords([]);
      }
    } catch (error) {
      console.error('Error fetching verification records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationStats = async () => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      let url = 'https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/stats';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching verification stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'processing' | 'approved' | 'rejected', remark: string = '') => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, remark })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw error;
    }
  };

  const handleSingleUpdate = async () => {
    if (!selectedRecord) return;
    
    setUpdating(true);
    try {
      await handleUpdateStatus(selectedRecord.id, status, remark);
      // 刷新数据
      fetchVerificationRecords(currentPage);
      fetchVerificationStats();
      setShowModal(false);
      setSelectedRecord(null);
      setRemark('');
    } catch (error) {
      alert('更新状态失败：' + (error instanceof Error ? error.message : '网络错误'));
    } finally {
      setUpdating(false);
    }
  };

  const handleBatchUpdate = async (status: 'processing' | 'approved' | 'rejected') => {
    if (selectedRecords.length === 0) return;
    
    setUpdating(true);
    try {
      for (const id of selectedRecords) {
        await handleUpdateStatus(id, status);
      }
      // 刷新数据
      fetchVerificationRecords(currentPage);
      fetchVerificationStats();
      setSelectedRecords([]);
      setSelectAll(false);
    } catch (error) {
      alert('批量更新失败：' + (error instanceof Error ? error.message : '网络错误'));
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = () => {
    const exportRecords = statusFilter === 'all' ? records : records.filter(r => r.status === statusFilter);
    if (exportRecords.length === 0) {
      alert('暂无记录可导出');
      return;
    }

    // 生成CSV内容
    const headers = ['用户ID', '用户名称', '核销金额', '状态', '申请时间', '备注'];
    const rows = exportRecords.map(record => [
      record.userId,
      record.userName,
      record.amount.toFixed(2),
      record.status === 'pending' ? '待处理' : record.status === 'processing' ? '处理中' : record.status === 'approved' ? '已通过' : '已拒绝',
      new Date(record.createdAt).toLocaleString('zh-CN'),
      record.remark || ''
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
    link.setAttribute('download', `核销记录_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchVerificationRecords();
  }, [statusFilter]);

  useEffect(() => {
    fetchVerificationStats();
  }, [startDate, endDate]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg">待处理</span>;
      case 'processing':
        return <span className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-lg">处理中</span>;
      case 'approved':
        return <span className="px-2 py-1 text-[10px] font-bold bg-green-50 text-green-600 rounded-lg">已通过</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg">已拒绝</span>;
      default:
        return null;
    }
  };

  const filteredRecords = statusFilter === 'all' 
    ? records 
    : records.filter(r => r.status === statusFilter);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchVerificationRecords(page);
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">手机核销管理</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 统计数据 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已通过金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">待处理金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已拒绝金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center space-x-2 mb-1">
              <AlertCircle size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">总记录数</span>
            </div>
            <p className="text-xl font-black text-gray-900">{total}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-yellow-600">{stats.pendingCount}</p>
            <p className="text-[10px] text-yellow-500">待处理</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-blue-600">{stats.pendingCount}</p>
            <p className="text-[10px] text-blue-500">处理中</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-green-600">{stats.approvedCount}</p>
            <p className="text-[10px] text-green-500">已通过</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-red-500">{stats.rejectedCount}</p>
            <p className="text-[10px] text-red-400">已拒绝</p>
          </div>
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar mb-2">
          <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
            {(['all', 'pending', 'processing', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  statusFilter === status 
                    ? 'bg-[#1E40AF] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                {status === 'all' ? '全部' : status === 'pending' ? '待处理' : status === 'processing' ? '处理中' : status === 'approved' ? '已通过' : '已拒绝'}
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

        {/* 批量操作 */}
        {(statusFilter === 'pending' || statusFilter === 'processing') && filteredRecords.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => {
                    const allIds = filteredRecords.map(r => r.id);
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
                  onClick={() => handleBatchUpdate('processing')}
                  disabled={selectedRecords.length === 0}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    selectedRecords.length > 0 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  批量处理
                </button>
                <button
                  onClick={() => handleBatchUpdate('approved')}
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
                  onClick={() => handleBatchUpdate('rejected')}
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

        {/* 核销记录列表 */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">加载中...</div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const isSelected = selectedRecords.includes(record.id);
              return (
                <div key={record.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {(statusFilter === 'pending' || statusFilter === 'processing') && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecords([...selectedRecords, record.id]);
                            } else {
                              setSelectedRecords(selectedRecords.filter(id => id !== record.id));
                            }
                          }}
                          className="w-4 h-4 text-[#1E40AF] rounded border-gray-300 focus:ring-[#1E40AF]"
                        />
                      )}
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs">
                        {record.userId.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">¥ {record.amount.toFixed(2)}</h3>
                        <p className="text-[10px] text-gray-400 mt-1">
                          用户: {record.userName}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          ID: {record.userId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(record.status)}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(record.createdAt).toLocaleString('zh-CN', {
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
                  
                  {record.remark && (
                    <div className="text-xs text-gray-600 mb-3">
                      <span className="text-gray-400">备注：</span>
                      <span className="font-medium">{record.remark}</span>
                    </div>
                  )}
                  
                  {record.invoiceUrl && (
                    <div className="mb-3">
                      <a 
                        href={record.invoiceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#1E40AF] hover:underline flex items-center space-x-1"
                      >
                        <Info size={12} />
                        <span>查看发票</span>
                      </a>
                    </div>
                  )}
                  
                  {(record.status === 'pending' || record.status === 'processing') && (
                    <div className="flex space-x-2 pt-2 border-t border-gray-50">
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('processing');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="flex-1 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                      >
                        <Clock size={14} />
                        <span>处理中</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('approved');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="flex-1 py-2 bg-green-50 text-green-600 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                      >
                        <Check size={14} />
                        <span>通过</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('rejected');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="flex-1 py-2 bg-red-50 text-red-500 text-xs font-bold rounded-xl flex items-center justify-center space-x-1"
                      >
                        <X size={14} />
                        <span>拒绝</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredRecords.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">暂无核销记录</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 更新状态模态框 */}
      {showModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">更新核销状态</h3>
            <p className="text-sm text-gray-500 mb-4">
              用户：{selectedRecord.userName} | 金额：¥{selectedRecord.amount.toFixed(2)}
            </p>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">状态</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setStatus('processing')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === 'processing' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  处理中
                </button>
                <button
                  onClick={() => setStatus('approved')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  通过
                </button>
                <button
                  onClick={() => setStatus('rejected')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === 'rejected' ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  拒绝
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">备注</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="请输入备注信息"
                rows={3}
                disabled={updating}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedRecord(null);
                  setRemark('');
                }}
                disabled={updating}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${updating ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                取消
              </button>
              <button
                onClick={handleSingleUpdate}
                disabled={updating}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${updating ? 'bg-blue-100 text-blue-300 cursor-not-allowed' : 'bg-[#1E40AF] text-white hover:bg-blue-700'}`}
              >
                {updating ? '处理中...' : '确认更新'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationManagement;