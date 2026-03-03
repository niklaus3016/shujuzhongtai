
import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Key, Shield, ShieldOff, Search, X, 
  MoreVertical, Check, AlertCircle, Loader2, User
} from 'lucide-react';
import { AdminUser, UserRole } from '../types';
import { request } from '../services/api';

interface EmployeeManagementProps {
  currentUser: AdminUser;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Employees data
  const [employees, setEmployees] = useState<AdminUser[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        // Fetch employee list from backend
        const employeeList = await request<AdminUser[]>('/account/employees', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        setEmployees(employeeList);
      } catch (error) {
        console.error('Error fetching employees:', error);
        // Fallback to mock data on error
        setEmployees([
          { id: 'E101', username: '张三', role: UserRole.EMPLOYEE, parentId: '2', coins: 5000, status: 'enabled' },
          { id: 'E102', username: '李四', role: UserRole.EMPLOYEE, parentId: '2', coins: 3200, status: 'enabled' },
          { id: 'E103', username: '王五', role: UserRole.EMPLOYEE, parentId: '2', coins: 1500, status: 'disabled' },
          { id: 'E104', username: '赵六', role: UserRole.EMPLOYEE, parentId: '3', coins: 8000, status: 'enabled' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [currentUser.id]);

  const filteredEmployees = useMemo(() => {
    let list = employees;
    // Normal admins only see their own employees
    if (currentUser.role === UserRole.NORMAL_ADMIN) {
      list = list.filter(e => e.parentId === currentUser.id);
    }
    return list.filter(e => 
      e.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm, currentUser]);

  const handleToggleStatus = (id: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, status: e.status === 'enabled' ? 'disabled' : 'enabled' };
      }
      return e;
    }));
  };

  const handleAddEmployee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    
    const newEmployee: AdminUser = {
      id: `E${Math.floor(Math.random() * 900) + 100}`,
      username,
      role: UserRole.EMPLOYEE,
      parentId: currentUser.id,
      coins: 0,
      status: 'enabled'
    };
    
    setEmployees(prev => [newEmployee, ...prev]);
    setIsAddModalOpen(false);
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In real app, call API
    setIsPasswordModalOpen(false);
    setSelectedEmployee(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-900">员工账号管理</h2>
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
          placeholder="搜索员工姓名或 ID..."
          className="w-full pl-9 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${employee.status === 'enabled' ? 'bg-blue-50 text-[#1E40AF]' : 'bg-gray-50 text-gray-400'}`}>
                <User size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900">{employee.username}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${employee.status === 'enabled' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {employee.status === 'enabled' ? '启用中' : '已禁用'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">ID: {employee.id} • 金币: {Number(employee.coins || 0).toFixed(2)}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => {
                  setSelectedEmployee(employee);
                  setIsPasswordModalOpen(true);
                }}
                className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                title="修改密码"
              >
                <Key size={18} />
              </button>
              <button 
                onClick={() => handleToggleStatus(employee.id)}
                className={`p-2 transition-colors ${employee.status === 'enabled' ? 'text-green-500' : 'text-red-500'}`}
                title={employee.status === 'enabled' ? '禁用账号' : '启用账号'}
              >
                {employee.status === 'enabled' ? <Shield size={18} /> : <ShieldOff size={18} />}
              </button>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <User size={40} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400 font-bold">暂无员工数据</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">添加新员工</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">员工姓名</label>
                <input 
                  name="username"
                  type="text" 
                  required
                  placeholder="请输入员工姓名"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">初始密码</label>
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
      {isPasswordModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">修改密码</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 font-medium">正在为员工 <span className="text-[#1E40AF] font-bold">{selectedEmployee.username}</span> 修改登录密码</p>
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

export default EmployeeManagement;
