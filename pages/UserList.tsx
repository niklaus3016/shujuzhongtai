import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, ChevronLeft, Globe, Smartphone, Zap, 
  ChevronRight, Filter
} from 'lucide-react';
import { request } from '../services/api';

interface ListUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  superior?: string;
}

interface UserListProps {
  onBack?: () => void;
  onSelectUser?: (user: any) => void;
}

const UserList: React.FC<UserListProps> = ({ onBack, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'ecpm'>('earnings');
  const [users, setUsers] = useState<ListUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await request<any>('/dashboard/users?range=today', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });

        const transformedUsers: ListUser[] = response.map((user: any) => ({
          id: user.employeeId || user.userId || '',
          userId: user.userId || '',
          name: user.userId || user.employeeId || '',
          avatar: '',
          watched: user.watched || 0,
          earnings: (user.earnings || 0) / 1000,
          ipCount: user.ipCount || 1,
          deviceCount: user.deviceCount || 1,
          ecpm: user.ecpm || 0,
          superior: user.superior || '系统直属'
        }));

        setUsers(transformedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredAndSortedUsers = useMemo(() => {
    return users
      .filter(user => 
        user.id.includes(searchTerm) || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [searchTerm, sortBy, users]);

  return (
    <div className="pb-6 animate-in slide-in-from-right duration-300 min-h-screen bg-[#F9FAFB]">
      <header className="sticky top-0 bg-white z-50 border-b border-gray-100">
        <div className="px-4 py-4 flex items-center">
            {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
                <ChevronLeft size={24} />
            </button>
            )}
            <h1 className={`flex-1 font-bold text-gray-900 ${onBack ? 'text-center mr-8' : ''}`}>
                全部活跃用户
            </h1>
        </div>

        <div className="px-4 pb-3">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={18} />
                <input 
                    type="text"
                    placeholder="按用户 ID 或昵称快速查找..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        <div className="px-4 pb-4 flex items-center justify-between">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full">
                <button 
                    onClick={() => setSortBy('ecpm')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'ecpm' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按eCPM
                </button>
                <button 
                    onClick={() => setSortBy('watched')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'watched' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按次数
                </button>
                <button 
                    onClick={() => setSortBy('earnings')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'earnings' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-400'}`}
                >
                    按收益
                </button>
            </div>
        </div>
      </header>

      <div className="px-4 py-3 flex items-center justify-between text-gray-400">
          <span className="text-[10px] font-bold uppercase tracking-widest">匹配结果: {filteredAndSortedUsers.length} 位用户</span>
          <div className="flex items-center space-x-1">
             <Filter size={12} />
             <span className="text-[10px] font-bold uppercase">过滤: {searchTerm || '无'}</span>
          </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            加载中...
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {filteredAndSortedUsers.length > 0 ? (
                filteredAndSortedUsers.map((user, idx) => (
                    <div 
                      key={user.id} 
                      className="p-4 space-y-3 active:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onSelectUser?.(user)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 flex items-center justify-center text-gray-900 text-xs font-bold">
                                      {user.id}
                                    </div>
                                    {searchTerm === '' && (
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                            idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-gray-200'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-gray-900 truncate">团队: {user.superior}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right flex flex-col space-y-0.5">
                                    {sortBy === 'earnings' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-[#1E40AF]">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-900">{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-[#1E40AF]">{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-500">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.ecpm >= 150 ? 'text-green-600' : 'text-red-500'}`}>{user.ecpm.toFixed(1)}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">eCPM</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className="text-[11px] font-black text-gray-500">¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <ChevronRight size={14} className="text-gray-300" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-1">
                            <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100/50">
                                <Globe size={10} className="text-blue-500" />
                                <span className="text-[9px] text-gray-400 font-medium">IP:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.ipCount}</span>
                            </div>
                            <div className="flex items-center space-x-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100/50">
                                <Smartphone size={10} className="text-purple-500" />
                                <span className="text-[9px] text-gray-400 font-medium">设备:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.deviceCount}</span>
                            </div>
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ml-auto ${sortBy === 'ecpm' ? 'bg-blue-600 border-blue-600' : 'bg-blue-50/30 border-blue-100/30'}`}>
                                <Zap size={10} className={sortBy === 'ecpm' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'ecpm' ? 'text-white/80' : 'text-gray-400'}`}>eCPM:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'ecpm' ? 'text-white' : (user.ecpm >= 150 ? 'text-green-600' : 'text-red-500')}`}>{user.ecpm.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                    <Search size={48} className="opacity-10 mb-4" />
                    <p className="text-xs font-bold">未找到匹配 ID 的用户</p>
                    <button 
                        onClick={() => setSearchTerm('')}
                        className="mt-4 text-[10px] text-[#1E40AF] font-black uppercase underline"
                    >
                        清除所有筛选
                    </button>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;
