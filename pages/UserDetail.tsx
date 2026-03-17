import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, TrendingUp, Wallet, BarChart2 } from 'lucide-react';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface DailyStat {
  date: string;
  earnings: number;
  watched: number;
  cumulative: number;
}

interface MonthlySummary {
  month: string;
  isCurrent: boolean;
  totalEarnings: number;
  days?: DailyStat[];
}

interface UserDetailProps {
  user: {
    id: string;
    userId: string;
    name: string;
    avatar: string;
    ipCount: number;
    deviceCount: number;
    ecpm: number;
    superior?: string;
  };
  onBack: () => void;
}

const UserDetail: React.FC<UserDetailProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });

  useEffect(() => {
    const fetchEarnings = async () => {
      setLoading(true);
      try {
        const response = await request<any>(`/user/${user.userId}/earnings`, {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });

        setTotalEarnings(response.totalEarnings || 0);

        const data: MonthlySummary[] = [];

        if (response.currentMonth) {
          data.push({
            month: response.currentMonth.month,
            isCurrent: true,
            totalEarnings: response.currentMonth.totalEarnings,
            days: response.currentMonth.days || []
          });
        }

        if (response.historyMonths && response.historyMonths.length > 0) {
          response.historyMonths.forEach((month: any) => {
            data.push({
              month: month.month,
              isCurrent: false,
              totalEarnings: month.totalEarnings
            });
          });
        }

        setMonthlyData(data);
      } catch (error) {
        console.error('Error fetching earnings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, [user.id]);

  return (
    <div ref={swipeRef} className="min-h-screen bg-white animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-50 px-4 py-4 flex items-center border-b border-gray-50">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">用户收益详情</h1>
      </header>

      <div className="p-6 pb-2">
        <div className="flex items-center space-x-4 mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 leading-tight">ID: {user.id}</h2>
            <div className="mt-1 space-y-0.5">
              <p className="text-[11px] text-gray-400 font-bold flex items-center">
                <span className="bg-gray-100 px-1 rounded mr-1">上级</span>
                <span className="text-gray-600">{user.superior || '无'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-8 p-6 bg-[#1E40AF] rounded-[24px] text-white shadow-xl shadow-blue-100 flex items-center justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-xs font-bold opacity-70 mb-1 flex items-center uppercase tracking-wider">
            <Wallet size={12} className="mr-1.5" /> 累计结算收益
          </div>
          <div className="text-3xl font-black tracking-tight">¥ {totalEarnings.toFixed(2)}</div>
        </div>
        <TrendingUp size={60} className="absolute -right-4 -bottom-4 opacity-10" />
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-gray-400">加载中...</div>
      ) : (
        <div className="px-4 space-y-8 pb-10">
          {monthlyData.map((section) => (
            <div key={section.month}>
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center space-x-2">
                  <Calendar size={14} className="text-blue-500" />
                  <h3 className="text-sm font-black text-gray-900">{section.month}</h3>
                  {section.isCurrent && (
                    <span className="bg-blue-50 text-[#1E40AF] text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">本月明细</span>
                  )}
                </div>
                {!section.isCurrent && (
                  <span className="text-[10px] font-bold text-gray-400">月度汇总</span>
                )}
              </div>
              
              <div className="space-y-3">
                {section.isCurrent && section.days && section.days.length > 0 ? (
                  section.days.map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 bg-white shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex flex-col items-center justify-center border border-gray-100">
                          <span className="text-[8px] font-bold text-gray-400 uppercase">{day.date.split('-')[0]}月</span>
                          <span className="text-xs font-black text-gray-700">{day.date.split('-')[1]}</span>
                        </div>
                        <div>
                          <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">当日收益</div>
                          <div className="text-sm font-black text-gray-900">¥ {day.earnings.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">累计至此</div>
                        <div className="text-xs font-bold text-[#1E40AF]">¥ {day.cumulative.toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between p-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2.5 rounded-xl bg-white shadow-sm border border-gray-100 text-gray-400">
                        <BarChart2 size={20} />
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">全月总计收益</div>
                        <div className="text-sm font-black text-gray-700">¥ {section.totalEarnings.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserDetail;
