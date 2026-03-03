
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, UserX, LineChart, ShieldCheck, Clock, 
  ChevronRight, ShieldAlert, BarChart3, Zap, Globe, Smartphone, TrendingDown, Wallet, Percent
} from 'lucide-react';
import { AlertItem } from '../types';
import { request } from '../services/api';

interface LowPerformanceUser {
  id: string;
  name: string;
  avatar: string;
  yesterdayWatched: number;
  yesterdayEarnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  reason: string;
}

const mockAlerts: AlertItem[] = [
  { 
    id: 'S001', 
    type: '数据异常', 
    severity: '高', 
    title: '公司总业绩不达标', 
    description: '昨日公司全平台总收益为 ¥4,280.5，低于设定的最低预警阈值 ¥5,000.0。', 
    time: '今天 00:05',
    status: '待处理'
  },
  { 
    id: 'S002', 
    type: '数据异常', 
    severity: '中', 
    title: '平均 eCPM 异常波动', 
    description: '今日实时平均 eCPM 下滑至 92.4，跌破监控基准线 100.0，请检查广告位填充及单价。', 
    time: '2小时前',
    status: '待处理'
  },
  { 
    id: 'S003', 
    type: '数据异常', 
    severity: '高', 
    title: '平台利润率偏低', 
    description: '当前全平台综合利润率为 36.5%，低于系统安全运行标准 40.0%。建议核查用户分成及渠道成本。', 
    time: '5小时前',
    status: '待处理'
  }
];

const mockSystemAlerts = [
  { 
    id: 'S001', 
    type: '业绩预警', 
    severity: '高', 
    title: '公司总业绩不达标', 
    description: '昨日公司全平台总收益为 ¥4,280.5，低于设定的最低预警阈值 ¥5,000.0。', 
    time: '今天 00:05',
    icon: Wallet,
    color: 'text-red-600 bg-red-50'
  },
  { 
    id: 'S002', 
    type: '收益预警', 
    severity: '中', 
    title: '平均 eCPM 异常波动', 
    description: '今日实时平均 eCPM 下滑至 92.4，跌破监控基准线 100.0，请检查广告位填充及单价。', 
    time: '2小时前',
    icon: Zap,
    color: 'text-orange-600 bg-orange-50'
  },
  { 
    id: 'S003', 
    type: '利润预警', 
    severity: '高', 
    title: '平台利润率偏低', 
    description: '当前全平台综合利润率为 36.5%，低于系统安全运行标准 40.0%。建议核查用户分成及渠道成本。', 
    time: '5小时前',
    icon: Percent,
    color: 'text-indigo-600 bg-indigo-50'
  }
];

const mockLowPerfUsers: LowPerformanceUser[] = [
  { id: '8701', name: '赵*刚', avatar: 'https://picsum.photos/seed/a1/100/100', yesterdayWatched: 320, yesterdayEarnings: 42.5, ipCount: 1, deviceCount: 1, ecpm: 132.8, reason: '次数及收益双低' },
  { id: '8702', name: '马*腾', avatar: 'https://picsum.photos/seed/a2/100/100', yesterdayWatched: 480, yesterdayEarnings: 72.0, ipCount: 1, deviceCount: 1, ecpm: 150.0, reason: '次数低于500' },
  { id: '8703', name: '周*鸿', avatar: 'https://picsum.photos/seed/a3/100/100', yesterdayWatched: 1200, yesterdayEarnings: 38.5, ipCount: 2, deviceCount: 1, ecpm: 32.1, reason: '收益低于50 (eCPM偏低)' },
  { id: '8704', name: '李*宏', avatar: 'https://picsum.photos/seed/a4/100/100', yesterdayWatched: 150, yesterdayEarnings: 15.0, ipCount: 1, deviceCount: 1, ecpm: 100.0, reason: '严重不活跃' },
  { id: '8705', name: '丁*磊', avatar: 'https://picsum.photos/seed/a5/100/100', yesterdayWatched: 499, yesterdayEarnings: 49.9, ipCount: 1, deviceCount: 1, ecpm: 100.0, reason: '临界异常' },
];

const Alerts: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'业绩异常' | '系统预警'>('业绩异常');
  const [perfSubFilter, setPerfSubFilter] = useState<'昨日' | '本周'>('昨日');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        // Fetch alert list from backend
        const alertList = await request<AlertItem[]>('/alert/list', {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          })
        });
        setAlerts(alertList);
      } catch (error) {
        console.error('Error fetching alerts:', error);
        // Fallback to mock data on error
        setAlerts(mockAlerts);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <div className="pb-6 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
                <ShieldAlert className="text-[#1E40AF] mr-2" size={24} />
                预警中心
            </h1>
            <button className="text-[10px] font-black text-[#1E40AF] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 active:bg-blue-100 transition-colors">
                全部标记已读
            </button>
        </div>

        {/* Main Category Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button 
                onClick={() => setActiveCategory('业绩异常')}
                className={`flex-1 flex items-center justify-center py-2 text-[11px] font-bold rounded-xl transition-all ${
                    activeCategory === '业绩异常' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'
                }`}
            >
                <BarChart3 size={14} className="mr-1.5" />
                业绩异常
                <span className="ml-1.5 w-4 h-4 bg-blue-100 text-[#1E40AF] rounded-full flex items-center justify-center text-[8px]">5</span>
            </button>
            <button 
                onClick={() => setActiveCategory('系统预警')}
                className={`flex-1 flex items-center justify-center py-2 text-[11px] font-bold rounded-xl transition-all ${
                    activeCategory === '系统预警' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
                }`}
            >
                <ShieldAlert size={14} className="mr-1.5" />
                系统预警
                <span className="ml-1.5 w-4 h-4 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-[8px]">3</span>
            </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {activeCategory === '业绩异常' ? (
            <>
                {/* Performance Sub-filters */}
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setPerfSubFilter('昨日')}
                        className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all border ${
                            perfSubFilter === '昨日' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                        }`}
                    >
                        昨日业绩异常
                    </button>
                    <button 
                        onClick={() => setPerfSubFilter('本周')}
                        className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all border ${
                            perfSubFilter === '本周' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-100'
                        }`}
                    >
                        本周业绩异常
                    </button>
                </div>

                {/* Performance Section (Low Performance Users) */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-2">
                    <p className="text-[11px] text-blue-600 font-bold leading-relaxed flex items-start">
                        <AlertTriangle size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                        以下展示{perfSubFilter}广告观看次数 &lt; 500 或 收益 &lt; 50元 的活跃用户。建议关注其 eCPM 波动或进行合规检查。
                    </p>
                </div>

                <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                    {mockLowPerfUsers.map((user) => (
                        <div 
                          key={user.id} 
                          className="p-4 space-y-3 active:bg-gray-50 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className="relative flex-shrink-0">
                                        <img src={user.avatar} className="w-10 h-10 rounded-full grayscale-[0.2]" alt="" />
                                        <div className="absolute -top-1 -left-1 bg-red-500 text-white w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black">!</div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-gray-900 truncate">{user.name}</div>
                                        <div className="text-[9px] text-red-500 font-black tracking-tight uppercase px-1.5 py-0.5 bg-red-50 rounded-md inline-block mt-0.5">
                                            {user.reason}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-3 flex-shrink-0">
                                    <div className="text-right flex flex-col space-y-0.5">
                                        <div className="flex items-center justify-end space-x-1">
                                            <span className={`text-[11px] font-black ${user.yesterdayEarnings < 50 ? 'text-red-500' : 'text-gray-900'}`}>
                                                ¥{user.yesterdayEarnings.toFixed(2)}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-medium">{perfSubFilter}收益</span>
                                        </div>
                                        <div className="flex items-center justify-end space-x-1">
                                            <span className={`text-[11px] font-black ${user.yesterdayWatched < 500 ? 'text-red-500' : 'text-gray-900'}`}>
                                                {user.yesterdayWatched}
                                            </span>
                                            <span className="text-[9px] text-gray-400 font-bold">{perfSubFilter}次数</span>
                                        </div>
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
                                <div className="flex items-center space-x-1 px-2 py-1 rounded-md border border-blue-100/30 bg-blue-50/30 ml-auto">
                                    <Zap size={10} className="text-orange-500" />
                                    <span className="text-[9px] font-medium uppercase tracking-tighter text-gray-400">eCPM:</span>
                                    <span className={`text-[10px] font-black ${user.ecpm >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                                        {user.ecpm.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        ) : (
            <>
                {/* System Alerts Section */}
                <div className="space-y-3">
                    <div className="px-1 flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">全平台系统实时监控</span>
                        <div className="flex items-center text-[10px] text-green-500 font-bold">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1.5"></div>
                            监控运行中
                        </div>
                    </div>

                    {mockSystemAlerts.map((alert) => (
                        <div key={alert.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4 active:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2.5 rounded-2xl ${alert.color}`}>
                                        <alert.icon size={22} />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-black text-gray-900">{alert.title}</span>
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                                alert.severity === '高' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
                                            }`}>{alert.severity}级风险</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center">
                                            <Clock size={10} className="mr-1" />
                                            {alert.time} • 预警编号 #{alert.id}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-1 bg-gray-50 rounded-lg text-gray-300">
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                            
                            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100/50 flex flex-col space-y-2">
                                <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
                                    {alert.description}
                                </p>
                                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-gray-100/50">
                                    <button className="text-[10px] font-black text-gray-400 px-3 py-1.5 bg-white border border-gray-100 rounded-lg">忽略</button>
                                    <button className="text-[10px] font-black text-red-600 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">已知晓</button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="pt-4 text-center">
                        <p className="text-[10px] text-gray-300 font-medium">系统仅保留最近 72 小时的预警记录</p>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default Alerts;
