import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Target, Save, X
} from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface WeeklyTarget {
  week: string;
  targetCount: number;
  bonusCoins: number;
}

interface WeeklyTargetManagementProps {
  onBack: () => void;
}

const WeeklyTargetManagement: React.FC<WeeklyTargetManagementProps> = ({ onBack }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [targets, setTargets] = useState<Record<string, { targetCount: number; bonusCoins: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [editCount, setEditCount] = useState(0);
  const [editBonus, setEditBonus] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });

  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // 获取周数（YYYY-WW格式）
  const getWeekNumber = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
  };

  // 获取本周的周数
  const getCurrentWeek = (): string => {
    return getWeekNumber(new Date());
  };

  const fetchMonthTargets = async () => {
    setLoading(true);
    try {
      const monthKey = getMonthKey(currentMonth);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/weeklyTarget/month?month=${monthKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && result.data) {
        const targetMap: Record<string, { targetCount: number; bonusCoins: number }> = {};
        result.data.forEach((item: WeeklyTarget) => {
          targetMap[item.week] = {
            targetCount: item.targetCount || 0,
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

  const handleWeekClick = (week: string) => {
    setSelectedWeek(week);
    setEditCount(targets[week]?.targetCount || 0);
    setEditBonus(targets[week]?.bonusCoins || 0);
    setShowEditModal(true);
  };

  const handleSaveTarget = async () => {
    if (!selectedWeek) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/weeklyTarget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          week: selectedWeek,
          targetCount: editCount,
          bonusCoins: editBonus
        })
      });
      const result = await response.json();
      if (result.success) {
        setTargets(prev => ({
          ...prev,
          [selectedWeek]: {
            targetCount: editCount,
            bonusCoins: editBonus
          }
        }));
        setShowEditModal(false);
        setSelectedWeek(null);
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

  const getWeeksInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const weeks = new Set<string>();
    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i);
      weeks.add(getWeekNumber(day));
    }
    
    return Array.from(weeks).sort();
  };

  const getWeekRange = (week: string): string => {
    const [yearStr, weekStr] = week.split('-');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekStr);
    
    const d = new Date(Date.UTC(year, 0, 1 + (weekNum - 1) * 7));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    
    const weekStart = new Date(d);
    weekStart.setUTCDate(weekStart.getUTCDate() - 3);
    
    const weekEnd = new Date(d);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 3);
    
    return `${weekStart.getUTCMonth() + 1}/${weekStart.getUTCDate()}-${weekEnd.getUTCMonth() + 1}/${weekEnd.getUTCDate()}`;
  };

  const weeks = getWeeksInMonth(currentMonth);
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">周目标管理</h1>
      </header>

      <div className="p-4">
        <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-2xl p-5 text-white mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Target size={18} />
            <span className="text-xs font-bold opacity-80 uppercase tracking-wider">周目标设定</span>
          </div>
          <p className="text-xs opacity-70">点击周数设置当周目标条数</p>
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

          {loading ? (
            <div className="text-center py-20 text-gray-400">加载中...</div>
          ) : (
            <div className="p-4 space-y-3">
              {weeks.map((week) => {
                const targetData = targets[week];
                const hasTarget = targetData && targetData.targetCount > 0;
                const currentWeek = getCurrentWeek() === week;
                
                return (
                  <div
                    key={week}
                    onClick={() => handleWeekClick(week)}
                    className={`p-4 rounded-xl border border-gray-100 cursor-pointer active:bg-gray-50 transition-all ${
                      currentWeek ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-bold ${
                        currentWeek ? 'text-[#1E40AF]' : 'text-gray-900'
                      }`}>
                        {week} 周
                        {currentWeek && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">本周</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {getWeekRange(week)}
                      </div>
                    </div>
                    {hasTarget ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="text-lg font-black text-green-600">
                            {targetData.targetCount} 条
                          </div>
                          <div className="text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                            奖励 {targetData.bonusCoins} 金币
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          已设定
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">
                        未设定目标
                      </div>
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
              <div className="text-xs text-gray-400 mb-1">本周目标</div>
              {targets[getCurrentWeek()]?.targetCount > 0 ? (
                <div className="text-lg font-bold text-green-600">
                  {targets[getCurrentWeek()].targetCount} 条
                </div>
              ) : (
                <div className="text-lg font-bold text-gray-400">未设定</div>
              )}
            </div>
            <button
              onClick={() => handleWeekClick(getCurrentWeek())}
              className="px-4 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl"
            >
              {targets[getCurrentWeek()]?.targetCount > 0 ? '修改' : '设置'}
            </button>
          </div>
        </div>
      </div>

      {showEditModal && selectedWeek && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm animate-in zoom-in-95 duration-200 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-[#1E40AF] to-indigo-600 px-6 pt-6 pb-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">设置周目标</h2>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/60 mb-1">选择周数</div>
                <div className="text-2xl font-bold">
                  {selectedWeek}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  {getWeekRange(selectedWeek)}
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
                      <span className="text-sm font-medium text-gray-600">目标条数</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={editCount || ''}
                    onChange={(e) => setEditCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black text-gray-900 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-100 focus:outline-none py-3"
                    placeholder="输入目标条数"
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

export default WeeklyTargetManagement;
