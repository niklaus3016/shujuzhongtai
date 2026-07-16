import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Calendar, TrendingUp, RefreshCw, Download, X } from 'lucide-react';
import { request } from '../services/api';

interface ECPMRecord {
  id: string;
  startTime: string;
  endTime: string;
  averageECPM: number;
  count: number;
  createdAt: string;
  date?: string;
}

interface ECPMChangeRecordProps {
  onBack: () => void;
}

const LineChartSimple: React.FC<{ data: { time: string; ecpm: number }[] }> = ({ data }) => {
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const width = 400;
  const height = 200;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const totalMinutes = 24 * 60;

  const { minVal, maxVal, points } = useMemo(() => {
    if (data.length === 0) {
      return { minVal: 0, maxVal: 100, points: [] };
    }
    const ecpmValues = data.map(d => d.ecpm);
    const minVal = Math.floor(Math.min(...ecpmValues) * 0.9);
    const maxVal = Math.ceil(Math.max(...ecpmValues) * 1.1);
    const range = maxVal - minVal || 1;
    
    const points = data.map(d => {
      const [hour, minute] = d.time.split(':').map(Number);
      const totalTimeMinutes = hour * 60 + minute;
      const x = padding.left + (totalTimeMinutes / totalMinutes) * chartWidth;
      const y = padding.top + ((maxVal - d.ecpm) / range) * chartHeight;
      return { x, y, time: d.time, ecpm: d.ecpm };
    });
    
    return { minVal, maxVal, points };
  }, [data, chartWidth, chartHeight]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = padding.top + chartHeight;
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = ` ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
    return line + area;
  }, [points, chartHeight]);

  const yTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
      const val = maxVal - ((maxVal - minVal) / 4) * i;
      ticks.push({
        val: parseFloat(val.toFixed(0)),
        y: padding.top + (chartHeight / 4) * i
      });
    }
    return ticks;
  }, [minVal, maxVal, chartHeight]);

  const xTicks = useMemo(() => {
    const targetHours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
    return targetHours.map(hour => {
      if (hour === '24:00') {
        return { time: hour, x: padding.left + chartWidth };
      }
      const [h] = hour.split(':').map(Number);
      const totalTimeMinutes = h * 60;
      return { time: hour, x: padding.left + (totalTimeMinutes / totalMinutes) * chartWidth };
    });
  }, [chartWidth]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="ecpmGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {yTicks.map(tick => (
        <React.Fragment key={tick.val}>
          <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} stroke="#F3F4F6" strokeDasharray="3 3" />
          <text x={padding.left - 10} y={tick.y + 4} textAnchor="end" className="text-[10px] fill-gray-400">{tick.val}</text>
        </React.Fragment>
      ))}
      
      {xTicks.map(tick => (
        <React.Fragment key={tick.time}>
          <text x={tick.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-gray-400">{tick.time}</text>
        </React.Fragment>
      ))}
      
      <path d={areaPath} fill="url(#ecpmGradient)" />
      
      <path
        d={linePath}
        fill="none"
        stroke="#1E40AF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2}
          fill="#1E40AF"
          className="opacity-60"
        />
      ))}
    </svg>
  );
};

const ECPMChangeRecord: React.FC<ECPMChangeRecordProps> = ({ onBack }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  });
  const [records, setRecords] = useState<ECPMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const fetchECPMRecords = async () => {
    setLoading(true);
    try {
      const response = await request<any>(`/admin/ecpm-records?date=${selectedDate}`, {
        method: 'GET'
      }).catch((err) => {
        console.error('ECPM request failed:', err);
        return null;
      });
      
      if (response) {
        const records = response.data?.records || response.records || [];
        setRecords(records);
        console.log('ECPM records loaded:', records.length, 'records');
      } else {
        console.error('ECPM response invalid:', response);
        setRecords([]);
      }
    } catch (error) {
      console.error('Error fetching ECPM records:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchECPMRecords();
  }, [selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('请选择导出时间范围');
      return;
    }
    if (exportStartDate > exportEndDate) {
      alert('开始日期不能大于结束日期');
      return;
    }
    setExportLoading(true);
    try {
      const startDate = new Date(exportStartDate);
      const endDate = new Date(exportEndDate);
      const allRecords: ECPMRecord[] = [];
      
      while (startDate <= endDate) {
        const dateStr = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
        const response = await request<any>(`/admin/ecpm-records?date=${dateStr}`, { method: 'GET' }).catch(() => null);
        if (response) {
          const dayRecords = response.data?.records || response.records || [];
          dayRecords.forEach((record: ECPMRecord) => {
            allRecords.push({ ...record, date: dateStr });
          });
        }
        startDate.setDate(startDate.getDate() + 1);
      }
      
      const headers = ['日期', '开始时间', '结束时间', '平均ECPM', '记录条数'];
      const rows = allRecords.map(record => [
        record.date || exportStartDate,
        record.startTime,
        record.endTime === '00:00' && record.startTime !== '00:00' ? '24:00' : record.endTime,
        record.averageECPM,
        record.count || 0
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ECPM记录_${exportStartDate}_${exportEndDate}.csv`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败，请重试');
    } finally {
      setExportLoading(false);
      setShowExportDialog(false);
      setExportStartDate('');
      setExportEndDate('');
    }
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const isToday = selectedDate === todayStr;
  
  const filteredRecords = isToday 
    ? records.filter(record => {
        const [hour, minute] = record.startTime.split(':').map(Number);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (hour < currentHour) return true;
        if (hour === currentHour && minute <= currentMinute) return true;
        return false;
      })
    : records;

  const validRecords = filteredRecords.filter(r => r.averageECPM > 0);

  const totalAverageECPM = validRecords.length > 0 
    ? parseFloat((validRecords.reduce((sum, r) => sum + r.averageECPM, 0) / validRecords.length).toFixed(2))
    : 0;

  const maxECPM = validRecords.length > 0 
    ? Math.max(...validRecords.map(r => r.averageECPM))
    : 0;

  const minECPM = validRecords.length > 0 
    ? Math.min(...validRecords.map(r => r.averageECPM))
    : 0;

  const chartData = filteredRecords.map(record => ({
    time: record.startTime,
    ecpm: record.averageECPM
  }));

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <TrendingUp className="text-[#1E40AF] mr-2" size={24} />
            ECPM变化记录
          </h1>
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl flex items-center space-x-1"
          >
            <ChevronLeft size={16} />
            <span>返回</span>
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calendar size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">选择日期</p>
              <p className="text-sm font-bold text-gray-900">{selectedDate}</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="px-4 py-2 bg-[#1E40AF] text-white text-sm font-bold rounded-xl flex items-center space-x-2"
            >
              <Calendar size={16} />
              <span>选择日期</span>
            </button>

            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50 w-64">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      const date = new Date(selectedDate);
                      date.setMonth(date.getMonth() - 1);
                      setSelectedDate(date.toISOString().split('T')[0]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    &lt;
                  </button>
                  <span className="text-sm font-bold text-gray-900">
                    {new Date(selectedDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
                  </span>
                  <button
                    onClick={() => {
                      const date = new Date(selectedDate);
                      date.setMonth(date.getMonth() + 1);
                      setSelectedDate(date.toISOString().split('T')[0]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    &gt;
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                    <span key={day} className="text-xs text-gray-400">{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const date = new Date(selectedDate);
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const days: number[] = [];
                    
                    for (let i = 0; i < firstDay.getDay(); i++) {
                      days.push(0);
                    }
                    for (let i = 1; i <= lastDay.getDate(); i++) {
                      days.push(i);
                    }
                    
                    return days.map((day, index) => {
                      if (day === 0) return <div key={index} className="h-8" />;
                      const isSelected = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` === selectedDate;
                      const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateChange(`${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`)}
                          className={`h-8 rounded-lg text-sm font-medium transition-all ${
                            isSelected 
                              ? 'bg-[#1E40AF] text-white' 
                              : isToday 
                                ? 'text-[#1E40AF] font-bold' 
                                : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">平均 ECPM</p>
            <p className="text-xl font-bold text-gray-900">{totalAverageECPM}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">最高 ECPM</p>
            <p className="text-xl font-bold text-green-500">{maxECPM}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 mb-1">最低 ECPM</p>
            <p className="text-xl font-bold text-red-500">{minECPM}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">ECPM趋势图</h2>
            <button
              onClick={fetchECPMRecords}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl flex items-center space-x-1"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? '刷新中' : '刷新'}</span>
            </button>
          </div>
          <div className="h-56">
            <LineChartSimple data={chartData} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">详细记录</h2>
            <button
              onClick={() => setShowExportDialog(true)}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-xl flex items-center space-x-1"
            >
              <Download size={16} />
              <span>导出</span>
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-10 text-gray-400">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <TrendingUp size={40} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无数据</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[...filteredRecords].reverse().map((record, index) => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-400 w-8">{index + 1}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {record.startTime} ~ {(record.endTime === '00:00' && record.startTime !== '00:00') ? '24:00' : record.endTime}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({record.count || 0}条)
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${record.averageECPM >= 100 ? 'text-green-500' : 'text-red-500'}`}>
                    {record.averageECPM}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">导出ECPM记录</h3>
              <button onClick={() => setShowExportDialog(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex space-x-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {exportLoading ? '导出中...' : '导出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ECPMChangeRecord;