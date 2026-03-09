import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Target, Save, X
} from 'lucide-react';
import { request } from '../services/api';

interface DailyTarget {
  date: string;
  targetCoins: number;
  bonusCoins: number;
}

interface DailyTargetManagementProps {
  onBack: () => void;
}

const DailyTargetManagement: React.FC<DailyTargetManagementProps> = ({ onBack }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [targets, setTargets] = useState<Record<string, { targetCoins: number; bonusCoins: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editBonus, setEditBonus] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const fetchMonthTargets = async () => {
    setLoading(true);
    try {
      const monthKey = getMonthKey(currentMonth);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/daily-target/month?month=${monthKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && result.data) {
        const targetMap: Record<string, { targetCoins: number; bonusCoins: number }> = {};
        result.data.forEach((item: DailyTarget) => {
          targetMap[item.date] = {
            targetCoins: item.targetCoins || 0,
            bonusCoins: item.bonusCoins || 0
          };
        });
        setTargets(targetMap);
      }
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthTargets();
  }, [currentMonth]);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setEditAmount(targets[dateStr]?.targetCoins || 0);
    setEditBonus(targets[dateStr]?.bonusCoins || 0);
    setShowEditModal(true);
  };

  const handleSaveTarget = async () => {
    if (!selectedDate) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/daily-target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: selectedDate,
          targetCoins: editAmount,
          bonusCoins: editBonus
        })
      });
      const result = await response.json();
      if (result.success) {
        setTargets(prev => ({
          ...prev,
          [selectedDate]: {
            targetCoins: editAmount,
            bonusCoins: editBonus
          }
        }));
        setShowEditModal(false);
        setSelectedDate(null);
      } else {
        throw new Error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('Error saving target:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remainingDays = totalCells - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayKey = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">今日目标管理</h1>
      </header>

      <div className="p-4">
        <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-2xl p-5 text-white mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Target size={18} />
            <span className="text-xs font-bold opacity-80 uppercase tracking-wider">每日目标设定</span>
          </div>
          <p className="text-xs opacity-70">点击日期设置当日目标金币</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <button 
              onClick={prevMonth}
              className="p-2 rounded-xl bg-gray-50 text-gray-500 active:bg-gray-100"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
              </div>
            </div>
            <button 
              onClick={nextMonth}
              className="p-2 rounded-xl bg-gray-50 text-gray-500 active:bg-gray-100"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 bg-gray-50">
            {weekDays.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-bold text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-400">加载中...</div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const dateKey = formatDateKey(day.date);
                const targetData = targets[dateKey];
                const hasTarget = targetData && targetData.targetCoins > 0;
                const today = isToday(day.date);
                
                return (
                  <div
                    key={index}
                    onClick={() => day.isCurrentMonth && handleDayClick(dateKey)}
                    className={`min-h-[70px] p-1 border-b border-r border-gray-50 ${
                      day.isCurrentMonth 
                        ? 'bg-white active:bg-gray-50 cursor-pointer' 
                        : 'bg-gray-50/50'
                    } ${today ? 'bg-blue-50' : ''}`}
                  >
                    {day.isCurrentMonth && (
                      <>
                        <div className={`text-xs font-bold mb-1 ${
                          today ? 'text-[#1E40AF]' : 'text-gray-900'
                        }`}>
                          {day.date.getDate()}
                          {today && <span className="ml-1 text-[8px]">今天</span>}
                        </div>
                        {hasTarget ? (
                          <div className="text-[10px] font-bold text-green-600 bg-green-50 rounded px-1 py-0.5 text-center">
                            {targetData.targetCoins.toLocaleString()}币
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-300 text-center">
                            未设定
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400 mb-1">今日目标</div>
              {targets[getTodayKey()]?.targetCoins > 0 ? (
                <div className="text-lg font-bold text-green-600">
                  {targets[getTodayKey()].targetCoins.toLocaleString()} 金币
                </div>
              ) : (
                <div className="text-lg font-bold text-gray-400">未设定</div>
              )}
            </div>
            <button
              onClick={() => handleDayClick(getTodayKey())}
              className="px-4 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl"
            >
              {targets[getTodayKey()]?.targetCoins > 0 ? '修改' : '设置'}
            </button>
          </div>
        </div>
      </div>

      {showEditModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm animate-in zoom-in-95 duration-200 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 px-6 pt-6 pb-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">设置目标</h2>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/60 mb-1">选择日期</div>
                <div className="text-2xl font-bold">
                  {selectedDate}
                </div>
              </div>
            </div>
            
            <div className="p-6 -mt-4">
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Target size={16} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">目标金币</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={editAmount || ''}
                    onChange={(e) => setEditAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black text-gray-900 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-100 focus:outline-none py-3"
                    placeholder="输入目标金币"
                  />
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-sm">🎁</span>
                      </div>
                      <span className="text-sm font-medium text-orange-700">完成目标奖励</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={editBonus || ''}
                    onChange={(e) => setEditBonus(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black text-orange-600 bg-white rounded-xl border-0 focus:ring-2 focus:ring-orange-100 focus:outline-none py-3"
                    placeholder="输入奖励金币"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 pb-6">
              <button
                onClick={handleSaveTarget}
                disabled={saving}
                className={`w-full py-4 bg-gradient-to-r from-[#1E40AF] to-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center space-x-2 active:scale-[0.98] transition-all shadow-lg ${saving ? 'opacity-50' : ''}`}
              >
                <Save size={18} />
                <span>{saving ? '保存中...' : '保存设置'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyTargetManagement;
