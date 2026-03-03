
import React, { useState } from 'react';
import { Crown, ArrowUp, ArrowDown } from 'lucide-react';

const mockRanking = Array.from({ length: 20 }).map((_, i) => ({
  rank: i + 1,
  name: `Top_${i + 1}`,
  value: (100 - i) * 12,
  diff: Math.floor(Math.random() * 50),
  isImproved: i % 3 === 0,
  avatar: `https://picsum.photos/seed/rank${i}/100/100`
}));

const Ranking: React.FC = () => {
  const [metric, setMetric] = useState('累计次数');
  const top3 = mockRanking.slice(0, 3);
  const others = mockRanking.slice(3);

  return (
    <div className="pb-6">
      {/* Metric Switcher Header */}
      <header className="sticky top-0 bg-[#1E40AF] z-40 px-4 pt-4 pb-6 text-white rounded-b-[32px] shadow-lg">
        <h1 className="text-xl font-black mb-4">风云排行榜</h1>
        <div className="flex space-x-2 overflow-x-auto hide-scrollbar pb-1">
          {['累计次数', '金币总额', '分成金额', '今日活跃'].map((m) => (
            <button 
              key={m}
              onClick={() => setMetric(m)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
                metric === m ? 'bg-white text-[#1E40AF]' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 -mt-4 relative z-10 space-y-6">
        {/* Top 3 Podium Cards (Horizontal Scrollable) */}
        <div className="flex items-end justify-center space-x-3 h-52">
          {/* Silver - Rank 2 */}
          <div className="flex flex-col items-center w-[100px] mb-4">
            <div className="relative mb-2">
                <img src={top3[1].avatar} className="w-14 h-14 rounded-full border-4 border-gray-200 shadow-md" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-gray-200 text-gray-700 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">2</div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm text-center w-full border border-gray-100">
                <div className="text-[10px] font-black truncate">{top3[1].name}</div>
                <div className="text-[10px] text-[#1E40AF] font-black">{top3[1].value}</div>
            </div>
          </div>

          {/* Gold - Rank 1 */}
          <div className="flex flex-col items-center w-[120px]">
            <Crown className="text-yellow-400 mb-1 drop-shadow-sm" size={28} />
            <div className="relative mb-2">
                <img src={top3[0].avatar} className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-xl" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-4 border-white">1</div>
            </div>
            <div className="bg-white p-4 rounded-t-3xl shadow-md text-center w-full border-x border-t border-yellow-100">
                <div className="text-xs font-black truncate mb-0.5">{top3[0].name}</div>
                <div className="text-sm text-[#1E40AF] font-black">{top3[0].value}</div>
            </div>
          </div>

          {/* Bronze - Rank 3 */}
          <div className="flex flex-col items-center w-[100px] mb-2">
            <div className="relative mb-2">
                <img src={top3[2].avatar} className="w-14 h-14 rounded-full border-4 border-orange-200 shadow-md" alt="" />
                <div className="absolute -bottom-1 -right-1 bg-orange-300 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">3</div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm text-center w-full border border-gray-100">
                <div className="text-[10px] font-black truncate">{top3[2].name}</div>
                <div className="text-[10px] text-[#1E40AF] font-black">{top3[2].value}</div>
            </div>
          </div>
        </div>

        {/* The rest of the leaderboard */}
        <div className="bg-white rounded-[32px] p-4 shadow-sm border border-gray-50 min-h-[400px]">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-sm font-black text-gray-900">全部排名</h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Update 5m ago</span>
          </div>
          <div className="space-y-1">
            {others.map((u) => (
              <div key={u.rank} className="flex items-center justify-between p-3 rounded-2xl active:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-black text-gray-300 w-6">{u.rank}</span>
                  <img src={u.avatar} className="w-10 h-10 rounded-xl" alt="" />
                  <div>
                    <div className="text-sm font-bold text-gray-900">{u.name}</div>
                    <div className="text-[10px] text-gray-400 font-medium">{metric}: {u.value}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`text-[10px] font-bold flex items-center ${u.isImproved ? 'text-green-500' : 'text-red-400'}`}>
                    {u.isImproved ? <ArrowUp size={10} className="mr-0.5" /> : <ArrowDown size={10} className="mr-0.5" />}
                    {u.diff}
                  </div>
                  <span className="text-[8px] text-gray-300 uppercase tracking-tighter">比昨日</span>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full py-4 mt-2 text-sm font-bold text-[#1E40AF] bg-blue-50/50 rounded-2xl border border-blue-50 active:bg-blue-100">
             加载更多数据
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ranking;
