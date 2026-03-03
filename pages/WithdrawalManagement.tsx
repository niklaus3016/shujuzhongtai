import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Wallet, Search, Filter, CheckCircle, XCircle, Clock,
  TrendingUp, DollarSign
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
    totalAmount: 0
  });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await request<any>('/withdraw/list', {
        method: 'GET',
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
      const list = response.list || response || [];
      setRecords(list);
      
      const totalAmount = list.reduce((sum: number, r: WithdrawalRecord) => sum + (r.amount || 0), 0);
      setStats({
        total: list.length,
        pending: list.filter((r: WithdrawalRecord) => r.status === 'pending').length,
        approved: list.filter((r: WithdrawalRecord) => r.status === 'approved').length,
        rejected: list.filter((r: WithdrawalRecord) => r.status === 'rejected').length,
        totalAmount
      });
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
      await request<any>(`/withdraw/${id}/${action}`, {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' })
      });
      fetchRecords();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-[10px] font-bold bg-yellow-50 text-yellow-600 rounded-lg">待处理</span>;
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
          <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-2xl p-4 text-white">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign size={16} />
              <span className="text-[10px] opacity-80">总提现金额</span>
            </div>
            <p className="text-xl font-black">¥ {stats.totalAmount.toFixed(2)}</p>
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
            <p className="text-[10px] text-green-500">已通过</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-red-500">{stats.rejected}</p>
            <p className="text-[10px] text-red-400">已拒绝</p>
          </div>
        </div>

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
              {status === 'all' ? '全部' : status === 'pending' ? '待处理' : status === 'approved' ? '已通过' : '已拒绝'}
            </button>
          ))}
        </div>

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
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">¥ {(record.amount / 1000).toFixed(2)}</h3>
                      <p className="text-[10px] text-gray-400">{record.createTime}</p>
                    </div>
                  </div>
                  {getStatusBadge(record.status)}
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
