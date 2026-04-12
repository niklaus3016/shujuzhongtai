import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Filter, Check, X, Info, Clock, AlertCircle } from 'lucide-react';

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
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchVerificationRecords = async (page: number = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/pending?page=${page}&limit=10`, {
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

  const handleUpdateStatus = async () => {
    if (!selectedRecord) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/verification/admin/${selectedRecord.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, remark })
      });
      const result = await response.json();
      if (result.success) {
        // 刷新数据
        fetchVerificationRecords(currentPage);
        fetchVerificationStats();
        setShowModal(false);
        setSelectedRecord(null);
        setRemark('');
      } else {
        alert('更新状态失败：' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('Error updating verification status:', error);
      alert('更新状态失败：网络错误');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchVerificationRecords();
  }, []);

  useEffect(() => {
    fetchVerificationStats();
  }, [startDate, endDate]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: '待处理', className: 'text-amber-500 bg-amber-50' };
      case 'processing':
        return { text: '处理中', className: 'text-blue-500 bg-blue-50' };
      case 'approved':
        return { text: '已通过', className: 'text-green-500 bg-green-50' };
      case 'rejected':
        return { text: '已拒绝', className: 'text-red-500 bg-red-50' };
      default:
        return { text: '未知', className: 'text-gray-500 bg-gray-50' };
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchVerificationRecords(page);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <AlertCircle className="text-[#1E40AF] mr-2" size={24} />
            手机核销管理
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
        {/* 统计数据 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">核销统计</h2>
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-sm font-medium text-[#1E40AF] bg-blue-50 rounded-lg flex items-center space-x-1"
            >
              <Filter size={14} />
              <span>{showStats ? '收起筛选' : '筛选'}</span>
            </button>
          </div>
          
          {showStats && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
              </div>
            </div>
          )}
          
          {statsLoading ? (
            <div className="text-center py-6 text-gray-400">加载中...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">总金额</div>
                <div className="text-lg font-black text-blue-600">¥{stats.totalAmount.toFixed(2)}</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">待处理</div>
                <div className="text-lg font-black text-amber-600">{stats.pendingCount}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">已通过</div>
                <div className="text-lg font-black text-green-600">{stats.approvedCount}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-xl">
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">已拒绝</div>
                <div className="text-lg font-black text-red-600">{stats.rejectedCount}</div>
              </div>
            </div>
          )}
        </div>

        {/* 待处理核销申请 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">待处理核销申请</h2>
          
          {loading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <AlertCircle size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无待处理核销申请</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const statusInfo = getStatusText(record.status);
                return (
                  <div key={record.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900">{record.userName}</span>
                        <span className="text-xs text-gray-400">ID: {record.userId}</span>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-full ${statusInfo.className}`}>
                        {statusInfo.text}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-400">核销金额：</span>
                        <span className="font-medium">¥{record.amount.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">申请时间：</span>
                        <span className="font-medium">{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
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
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('processing');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        处理中
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('approved');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="px-3 py-1.5 bg-green-50 text-green-600 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRecord(record);
                          setStatus('rejected');
                          setRemark('');
                          setShowModal(true);
                        }}
                        className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {/* 分页 */}
              {total > 10 && (
                <div className="flex items-center justify-center mt-6">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-l-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => handlePageChange(Math.min(Math.ceil(total / 10), currentPage + 1))}
                    disabled={currentPage * 10 >= total}
                    className="px-3 py-1.5 border border-l-0 border-gray-200 rounded-r-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                  <span className="ml-4 text-xs text-gray-500">
                    第 {currentPage} 页，共 {Math.ceil(total / 10)} 页
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
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
                onClick={handleUpdateStatus}
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