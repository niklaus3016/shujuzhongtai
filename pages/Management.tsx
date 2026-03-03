import React, { useState, useEffect } from 'react';
import { 
  Users, Target, ToggleLeft, ToggleRight, Wallet, ChevronRight,
  UserPlus, Settings, TrendingUp
} from 'lucide-react';
import { request } from '../services/api';
import AccountManagement from './AccountManagement';
import DailyTargetManagement from './DailyTargetManagement';
import WithdrawalManagement from './WithdrawalManagement';

interface ManagementProps {}

const Management: React.FC<ManagementProps> = () => {
  const [activePage, setActivePage] = useState<'main' | 'account' | 'target' | 'withdrawal'>('main');
  const [withdrawEnabled, setWithdrawEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchWithdrawStatus = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/withdraw-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setWithdrawEnabled(result.enabled ?? false);
      }
    } catch (error) {
      console.error('Error fetching withdraw status:', error);
    }
  };

  useEffect(() => {
    fetchWithdrawStatus();
  }, []);

  const toggleWithdraw = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const newStatus = !withdrawEnabled;
      const response = await fetch('https://xevbnmgazudl.sealoshzh.site/api/settings/withdraw-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: newStatus })
      });
      const result = await response.json();
      if (result.success) {
        setWithdrawEnabled(newStatus);
      }
    } catch (error) {
      console.error('Error toggling withdraw:', error);
    } finally {
      setLoading(false);
    }
  };

  if (activePage === 'account') {
    return <AccountManagement onBack={() => setActivePage('main')} />;
  }

  if (activePage === 'target') {
    return <DailyTargetManagement onBack={() => setActivePage('main')} />;
  }

  if (activePage === 'withdrawal') {
    return <WithdrawalManagement onBack={() => setActivePage('main')} />;
  }

  const menuItems = [
    {
      id: 'account',
      icon: Users,
      title: '账号管理',
      description: '开设团队长账号和员工账号',
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      id: 'target',
      icon: Target,
      title: '今日目标管理',
      description: '设定每日目标数据',
      color: 'text-green-500',
      bg: 'bg-green-50'
    },
    {
      id: 'withdraw-toggle',
      icon: withdrawEnabled ? ToggleRight : ToggleLeft,
      title: '提现开关',
      description: withdrawEnabled ? '当前：已开启' : '当前：已关闭',
      color: withdrawEnabled ? 'text-green-500' : 'text-gray-400',
      bg: withdrawEnabled ? 'bg-green-50' : 'bg-gray-50',
      isToggle: true
    },
    {
      id: 'withdrawal',
      icon: Wallet,
      title: '提现管理',
      description: '查看所有提现记录和数据',
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 flex items-center">
          <Settings className="text-[#1E40AF] mr-2" size={24} />
          管理中心
        </h1>
      </header>

      <div className="p-4 space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.isToggle) {
                  toggleWithdraw();
                } else if (item.id === 'account') {
                  setActivePage('account');
                } else if (item.id === 'target') {
                  setActivePage('target');
                } else if (item.id === 'withdrawal') {
                  setActivePage('withdrawal');
                }
              }}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-all ${loading && item.isToggle ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <Icon size={24} className={item.color} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>
                </div>
              </div>
              {item.isToggle ? (
                <div className={`w-12 h-7 rounded-full p-1 transition-all ${withdrawEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${withdrawEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              ) : (
                <ChevronRight size={20} className="text-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 mt-6">
        <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center space-x-3 mb-3">
            <TrendingUp size={20} />
            <span className="text-xs font-bold opacity-80 uppercase tracking-wider">系统状态</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] opacity-70">提现功能</p>
              <p className="text-sm font-bold">{withdrawEnabled ? '已开启' : '已关闭'}</p>
            </div>
            <div>
              <p className="text-[10px] opacity-70">系统运行</p>
              <p className="text-sm font-bold">正常</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Management;
