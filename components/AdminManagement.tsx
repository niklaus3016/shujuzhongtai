
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Key, Shield, ShieldOff, Search, X, 
  User, Award, MoreVertical
} from 'lucide-react';
import { AdminUser, UserRole } from '../types';
import { request } from '../services/api';

interface AdminManagementProps {
  currentUser: AdminUser;
}

const AdminManagement: React.FC<AdminManagementProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Admins (Team Leaders) data
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true);
      try {
        // Fetch admin list from backend
        const adminList = await request<AdminUser[]>('/account/admins', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        setAdmins(adminList);
      } catch (error) {
        console.error('Error fetching admins:', error);
        // Fallback to mock data on error
        setAdmins([
          { id: 'A001', username: '张管理', role: UserRole.NORMAL_ADMIN, status: 'enabled', commission: 5420.5 },
          { id: 'A002', username: '李管理', role: UserRole.NORMAL_ADMIN, status: 'enabled', commission: 3150.8 },
          { id: 'A003', username: '王主管', role: UserRole.NORMAL_ADMIN, status: 'enabled', commission: 1280.0 },
          { id: 'A004', username: '陈队长', role: UserRole.NORMAL_ADMIN, status: 'enabled', commission: 450.2 },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, []);

  const filteredAdmins = useMemo(() => {
    return admins.filter(a => 
      a.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [admins, searchTerm]);

  const handleToggleStatus = (id: string) => {
    setAdmins(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, status: a.status === 'enabled' ? 'disabled' : 'enabled' };
      }
      return a;
    }));
  };

  const handleAddAdmin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    
    const newAdmin: AdminUser = {
      id: `A${Math.floor(Math.random() * 900) + 100}`,
      username,
      role: UserRole.NORMAL_ADMIN,
      status: 'enabled',
      commission: 0
    };
    
    setAdmins(prev => [newAdmin, ...prev]);
    setIsAddModalOpen(false);
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPasswordModalOpen(false);
    setSelectedAdmin(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">团队长账号管理</h2>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
        >
          <UserPlus size={20} />
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
        <input 
          type="text"
          placeholder="搜索团队长姓名或 ID..."
          className="w-full pl-9 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredAdmins.map((admin) => (
          <div key={admin.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${admin.status === 'enabled' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                <Award size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900">{admin.username}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${admin.status === 'enabled' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {admin.status === 'enabled' ? '启用中' : '已禁用'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">ID: {admin.id} • 累计提成: ¥ {Number(admin.commission || 0).toFixed(2)}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  setSelectedAdmin(admin);
                  setIsPasswordModalOpen(true);
                }}
                className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                title="修改密码"
              >
                <Key size={18} />
              </button>
              <button 
                onClick={() => handleToggleStatus(admin.id)}
                className={`p-2 transition-colors ${admin.status === 'enabled' ? 'text-green-500' : 'text-red-500'}`}
                title={admin.status === 'enabled' ? '禁用账号' : '启用账号'}
              >
                {admin.status === 'enabled' ? <Shield size={18} /> : <ShieldOff size={18} />}
              </button>
            </div>
          </div>
        ))}

        {filteredAdmins.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <User size={40} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400 font-bold">暂无团队长数据</p>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">添加新团队长</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">团队长姓名</label>
                <input 
                  name="username"
                  type="text" 
                  required
                  placeholder="请输入姓名"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">登录密码</label>
                <input 
                  name="password"
                  type="password" 
                  required
                  placeholder="设置登录密码"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-[#1E40AF] text-white font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2"
              >
                确认添加
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">修改密码</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 font-medium">正在为团队长 <span className="text-[#1E40AF] font-bold">{selectedAdmin.username}</span> 修改登录密码</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">新密码</label>
                <input 
                  type="password" 
                  required
                  placeholder="请输入新密码"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-[#1E40AF] text-white font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2"
              >
                保存修改
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
