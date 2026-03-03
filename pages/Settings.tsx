
import React, { useState } from 'react';
import { 
  User, Settings as SettingsIcon, Bell, Moon, BookOpen, 
  HelpCircle, LogOut, ChevronRight, UserCircle2, Mail, ShieldCheck, Key, Loader2
} from 'lucide-react';
import { authService } from '../services/authService';

interface SettingsProps {
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  const currentUser = authService.getCurrentUser();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || !currentUser) return;
    setIsUpdating(true);
    await authService.updatePassword(currentUser.id, newPassword);
    setIsUpdating(false);
    setShowPasswordModal(false);
    setNewPassword('');
    alert('密码修改成功');
  };

  const sections = [
    {
      title: '系统设置',
      items: [
        { label: '修改密码', icon: Key, color: 'text-blue-500 bg-blue-50', onClick: () => setShowPasswordModal(true) },
        { label: '消息通知', icon: Bell, color: 'text-orange-500 bg-orange-50', extra: '开启' },
        { label: '深色模式', icon: Moon, color: 'text-indigo-500 bg-indigo-50', extra: '跟随系统' },
      ]
    },
    {
      title: '关于与支持',
      items: [
        { label: '操作手册', icon: BookOpen, color: 'text-green-500 bg-green-50' },
        { label: '意见反馈', icon: Mail, color: 'text-purple-500 bg-purple-50' },
        { label: '关于我们', icon: HelpCircle, color: 'text-gray-500 bg-gray-50', extra: 'v2.4.1' },
      ]
    }
  ];

  return (
    <div className="pb-6">
      <div className="bg-[#1E40AF] pt-12 pb-16 px-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        
        <div className="relative flex items-center space-x-4">
            <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl overflow-hidden">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 size={40} className="text-white" />
                )}
            </div>
            <div>
                <h2 className="text-xl font-black">{currentUser?.username || 'Admin Pro'}</h2>
                <div className="flex items-center space-x-2 mt-0.5 opacity-80">
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10 uppercase">
                      {currentUser?.role === 'SUPER_ADMIN' ? '超级管理员' : '普通管理员'}
                    </span>
                    <span className="text-[10px] opacity-60">ID: {currentUser?.id}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 text-center">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">今日处理</div>
                <div className="text-lg font-black text-[#1E40AF]">42</div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 text-center">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">导出报告</div>
                <div className="text-lg font-black text-green-600">08</div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 text-center">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">活跃时间</div>
                <div className="text-lg font-black text-orange-500">4.5h</div>
            </div>
        </div>

        {/* Menu Sections */}
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-[10px] font-black text-gray-400 px-2 uppercase tracking-widest">{section.title}</h3>
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50">
                {section.items.map((item, itemIdx) => (
                  <button 
                    key={itemIdx} 
                    onClick={item.onClick}
                    className={`w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors ${
                        itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${item.color}`}>
                            <item.icon size={18} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {item.extra && <span className="text-[10px] font-bold text-gray-400">{item.extra}</span>}
                        <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-500 rounded-3xl shadow-sm border border-gray-100 active:bg-red-50 active:border-red-100 transition-all font-black text-sm mt-4"
        >
            <LogOut size={20} className="mr-2" />
            退出当前账号
        </button>
        
        <div className="text-center py-6">
            <p className="text-[10px] text-gray-300 font-medium">Power by AdMaster Cloud Service</p>
            <p className="text-[10px] text-gray-300 font-medium">© 2024 AdMaster Data Hub</p>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">修改登录密码</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">新密码</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请输入新密码"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 rounded-2xl active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdating}
                  className="flex-1 py-3 text-xs font-black text-white bg-[#1E40AF] rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
