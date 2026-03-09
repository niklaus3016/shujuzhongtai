import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Wallet, Search, Filter, CheckCircle, XCircle, Clock,
  TrendingUp, DollarSign, Download
} from 'lucide-react';
import { request } from '../services/api';

interface WithdrawalRecord {
  _id: string;
  userId: string;
  employeeId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
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

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        const list = result.list || [];
        setRecords(list);
        
        const totalAmount = list.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const approvedAmount = list.filter((r: any) => r.status === 'approved').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const pendingAmount = list.filter((r: any) => r.status === 'pending').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const rejectedAmount = list.filter((r: any) => r.status === 'rejected').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        setStats({
          total: list.length,
          pending: list.filter((r: any) => r.status === 'pending').length,
          approved: list.filter((r: any) => r.status === 'approved').length,
          rejected: list.filter((r: any) => r.status === 'rejected').length,
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
    fetchRecords();
  }, []);

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
      fetchRecords();
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
      fetchRecords();
    } catch (error) {
      console.error('Error batch processing:', error);
    }
  };

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      alert('暂无记录可导出');
      return;
    }

    // 生成CSV内容
    const headers = ['员工ID', '金额', '支付宝帐号', '支付宝姓名', '状态', '申请时间'];
    const rows = filteredRecords.map(record => [
      record.employeeId,
      record.amount.toFixed(2),
      record.alipayAccount,
      record.alipayName,
      record.status === 'pending' ? '待处理' : record.status === 'approved' ? '已打款' : '已拒绝',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg">待处理</span>;
      case 'approved':
        return <span className="px-2 py-1 text-[10px] font-bold bg-green-50 text-green-600 rounded-lg">已打款</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg">已拒绝</span>;
      default:
        return null;
    }
  };

  const filteredRecords = statusFilter === 'all' 
    ? records 
    : records.filter(r => r.status === statusFilter);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">提现管理</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已打款金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.approvedAmount.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">待处理金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.pendingAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-[10px] opacity-80">已拒绝金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.rejectedAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center space-x-2 mb-1">
              <Wallet size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">总记录数</span>
            </div>
            <p className="text-xl font-black text-gray-900">{stats.total}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-yellow-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-yellow-600">{stats.pending}</p>
            <p className="text-[10px] text-yellow-500">待处理</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-green-600">{stats.approved}</p>
            <p className="text-[10px] text-green-500">已打款</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-red-500">{stats.rejected}</p>
            <p className="text-[10px] text-red-400">已拒绝</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto hide-scrollbar mb-2">
          <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  statusFilter === status 
                    ? 'bg-[#1E40AF] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100'
                }`}
              >
                {status === 'all' ? '全部' : status === 'pending' ? '待处理' : status === 'approved' ? '已打款' : '已拒绝'}
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

        {statusFilter === 'pending' && filteredRecords.length > 0 && (
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
                
                {record.status === 'pending' && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawalManagement;
