
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users2, TrendingUp, ChevronRight, Filter, Award, 
  PlayCircle, ChevronLeft, Search, Zap, Globe, Smartphone, TrendingDown, X, UserPlus
} from 'lucide-react';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import EmployeeManagement from '../components/EmployeeManagement';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import { request } from '../services/api';

interface TeamItem {
  id: string;
  leader: string;
  memberCount: number;
  todayAds: number;
  monthlyAds: number;
  totalAds: number;
  todayRevenue: number;
  todayEarnings?: number;
  earnings?: number;
  totalRevenue: number;
  totalEarnings?: number;
  todayGrowth: number;
  monthGrowth: number;
  ecpm: number;
  todayActiveRate: string;
  monthlyActiveRate: string;
  level: '荣耀' | '王牌' | '精英' | '新锐';
}

interface MemberInfo {
  id: string;
  name: string;
  avatar: string;
  todayWatched: number;
  monthlyWatched: number;
  todayEarnings: number;
  monthlyEarnings: number;
  todayEcpm: number;
  monthlyEcpm: number;
  ipCount: number;
  deviceCount: number;
  status: '在线' | '离线';
}

const mockTeams: TeamItem[] = [
  { id: 'T001', leader: '张管理', memberCount: 1240, todayAds: 1240, monthlyAds: 45800, totalAds: 45800, todayRevenue: 3420.5, totalRevenue: 128400, todayGrowth: 12.5, monthGrowth: 8.4, ecpm: 154.2, todayActiveRate: '82%', monthlyActiveRate: '94%', level: '荣耀' },
  { id: 'T002', leader: '李管理', memberCount: 840, todayAds: 840, monthlyAds: 28400, totalAds: 28400, todayRevenue: 2150.8, totalRevenue: 94200, todayGrowth: -2.1, monthGrowth: 15.2, ecpm: 142.1, todayActiveRate: '75%', monthlyActiveRate: '88%', level: '王牌' },
  { id: 'T003', leader: '王主管', memberCount: 420, todayAds: 420, monthlyAds: 15200, totalAds: 15200, todayRevenue: 1280.0, totalRevenue: 48200, todayGrowth: 5.4, monthGrowth: -1.2, ecpm: 138.5, todayActiveRate: '68%', monthlyActiveRate: '72%', level: '精英' },
  { id: 'T004', leader: '陈队长', memberCount: 150, todayAds: 150, monthlyAds: 8900, totalAds: 8900, todayRevenue: 450.2, totalRevenue: 12500, todayGrowth: 22.1, monthGrowth: 42.5, ecpm: 162.0, todayActiveRate: '91%', monthlyActiveRate: '98%', level: '精英' },
  { id: 'T005', leader: '赵领队', memberCount: 85, todayAds: 85, monthlyAds: 2100, totalAds: 2100, todayRevenue: 120.5, totalRevenue: 3200, todayGrowth: -8.4, monthGrowth: -15.0, ecpm: 98.4, todayActiveRate: '42%', monthlyActiveRate: '55%', level: '新锐' },
];

const TeamMemberDetail: React.FC<{ team: TeamItem; activeRate: string; mode: 'today' | 'month'; onBack: () => void }> = ({ team, activeRate, mode, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/team/${team.id}/members`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const result = await response.json();
        if (result.success) {
          setMembers(result.members || []);
        } else {
          throw new Error(result.message || '获取成员列表失败');
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [team.id]);

  // Sort by earnings (high to low) and then filter by search term
  const sortedAndFilteredMembers = useMemo(() => {
    return members
      .filter(m => m.name.includes(searchTerm) || m.id.includes(searchTerm))
      .sort((a, b) => {
        const valA = mode === 'today' ? a.todayEarnings : a.monthlyEarnings;
        const valB = mode === 'today' ? b.todayEarnings : b.monthlyEarnings;
        return valB - valA; // High to Low
      });
  }, [members, searchTerm, mode]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-50 px-4 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold text-gray-900">{team.leader} 团队成员</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
              共 {team.memberCount} 位成员 • {mode === 'today' ? '今日' : '本月'}活跃率 {activeRate}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索成员姓名或 ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="p-4 space-y-3">
        {sortedAndFilteredMembers.map((member) => (
          <div key={member.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500`}>
                    {member.id}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.status === '在线' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{member.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-[#1E40AF]">
                  ¥ {Number(mode === 'today' ? member.todayEarnings : member.monthlyEarnings).toFixed(2)}
                </div>
                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                  {mode === 'today' ? '今日预计收益' : '本月累计收益'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  {mode === 'today' ? '观看次数' : '本月次数'}
                </div>
                <div className="text-[11px] font-black text-gray-700">
                  {(mode === 'today' ? member.todayWatched : member.monthlyWatched).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  {mode === 'today' ? '个人 eCPM' : '月均 eCPM'}
                </div>
                <div className={`text-[11px] font-black ${(mode === 'today' ? member.todayEcpm : member.monthlyEcpm) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {(mode === 'today' ? member.todayEcpm : member.monthlyEcpm).toFixed(2)}
                </div>
              </div>
              <div className="flex items-center justify-around bg-gray-50 px-2 py-1.5 rounded-xl border border-gray-100/50">
                <div className="flex flex-col items-center">
                  <Globe size={10} className="text-blue-400 mb-0.5" />
                  <span className={`text-[10px] font-black ${member.ipCount > 1 ? 'text-red-500' : 'text-gray-700'}`}>{member.ipCount}</span>
                </div>
                <div className="w-[1px] h-4 bg-gray-200"></div>
                <div className="flex flex-col items-center">
                  <Smartphone size={10} className="text-purple-400 mb-0.5" />
                  <span className="text-[10px] font-black text-gray-700">{member.deviceCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
            <p className="text-xs text-gray-400 font-bold">加载中...</p>
          </div>
        )}

        {!loading && sortedAndFilteredMembers.length === 0 && (
          <div className="py-20 text-center">
            <Search className="mx-auto text-gray-200 mb-2" size={48} />
            <p className="text-xs text-gray-400 font-bold">未找到符合条件的成员</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Team: React.FC = () => {
  const [sortBy, setSortBy] = useState<'today' | 'month'>('today');
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamItem | null>(null);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('today');
  // 使用 useMemo 缓存 currentUser，避免每次渲染都返回新对象
  const currentUser = useMemo(() => authService.getCurrentUser(), []);

  const handleRefresh = useCallback(() => {
    // 刷新团队数据
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/team/list', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        console.log('Team API Response:', result);
        const teamsData = result.data || [];
        teamsData.forEach((team: any, index: number) => {
          console.log(`Team ${index}:`, {
            id: team.id,
            leader: team.leader,
            todayRevenue: team.todayRevenue,
            todayAds: team.todayAds,
            totalRevenue: team.totalRevenue
          });
        });
        setTeams(teamsData);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams(mockTeams);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []); // 没有依赖项，因为不使用任何外部变量

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/team/list', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        console.log('Team API Response:', result);
        const teamsData = result.data || [];
        teamsData.forEach((team: any, index: number) => {
          console.log(`Team ${index}:`, {
            id: team.id,
            leader: team.leader,
            todayRevenue: team.todayRevenue,
            todayAds: team.todayAds,
            totalRevenue: team.totalRevenue
          });
        });
        setTeams(teamsData);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setTeams(mockTeams);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const totalMembers = useMemo(() => {
    return teams.reduce((sum, team) => sum + team.memberCount, 0);
  }, [teams]);

  const filteredAndSortedTeams = useMemo(() => {
    return [...teams]
      .filter(team => 
        team.leader.toLowerCase().includes(teamSearchTerm.toLowerCase()) || 
        team.id.toLowerCase().includes(teamSearchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const revenueA = sortBy === 'today' ? Number(a.todayRevenue || 0) : Number(a.totalRevenue || 0);
        const revenueB = sortBy === 'today' ? Number(b.todayRevenue || 0) : Number(b.totalRevenue || 0);
        return revenueB - revenueA;
      });
  }, [teams, teamSearchTerm, sortBy]);

  if (!currentUser) return null;

  // Normal Admin (Team Leader) view
  if (currentUser.role === UserRole.NORMAL_ADMIN) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    return (
      <div className="p-4 pb-24">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <Users2 className="text-[#1E40AF] mr-2" size={24} />
              我的团队
            </h1>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              <UserPlus size={20} />
            </button>
          </div>
        </header>
        <EmployeeManagement currentUser={currentUser} isAddModalOpen={isAddModalOpen} setIsAddModalOpen={setIsAddModalOpen} />
      </div>
    );
  }

  if (selectedTeam) {
    return (
      <TeamMemberDetail 
        team={selectedTeam} 
        mode={sortBy}
        activeRate={sortBy === 'today' ? selectedTeam.todayActiveRate : selectedTeam.monthlyActiveRate} 
        onBack={() => setSelectedTeam(null)} 
      />
    );
  }

  return (
    <div className="pb-6 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
        </div>

        <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
                <input 
                    type="text"
                    placeholder="输入团队名称或领队姓名筛选..."
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    value={teamSearchTerm}
                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                />
                {teamSearchTerm && (
                  <button 
                    onClick={() => setTeamSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">总团队数</div>
                    <div className="text-2xl font-black">{teams.length} <span className="text-xs font-normal opacity-70">个</span></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">团队总人数</div>
                    <div className="text-2xl font-black">{totalMembers.toLocaleString()} <span className="text-xs font-normal opacity-70">人</span></div>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                    onClick={() => setSortBy('today')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'today' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按今日团队总收益
                </button>
                <button 
                    onClick={() => setSortBy('month')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'month' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按本月团队总收益
                </button>
            </div>
      </header>

      <div className="px-4 mt-4">
        <div className="space-y-3">
            {loading ? (
              <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF] mx-auto mb-4"></div>
                <p className="text-xs text-gray-400 font-bold">加载中...</p>
              </div>
            ) : filteredAndSortedTeams.length > 0 ? (
              filteredAndSortedTeams.map((team) => (
            <div key={team.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ${
                          team.level === '荣耀' ? 'bg-yellow-400 text-white' : 
                          team.level === '王牌' ? 'bg-blue-500 text-white' : 
                          team.level === '精英' ? 'bg-indigo-400 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                          <Award size={24} />
                      </div>
                      <div>
                          <div className="flex items-center space-x-2">
                              <span className="text-sm font-black text-gray-900">{team.leader}</span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                            {sortBy === 'today' ? '今日成员活跃率' : '本月成员活跃率'}: {sortBy === 'today' ? team.todayActiveRate : team.monthlyActiveRate}
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-xs font-black text-gray-900">¥ {Number(sortBy === 'today' ? team.todayRevenue || 0 : team.totalRevenue || 0).toFixed(2)}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                        {sortBy === 'today' ? '今日团队总收益' : '本月团队总收益'}
                      </div>
                  </div>
              </div>

              <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">成员总数</div>
                          <div className="text-xs font-black text-gray-700">{team.memberCount}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                            {sortBy === 'today' ? '今日广告次数' : '本月广告次数'}
                          </div>
                          <div className="text-xs font-black text-gray-700">
                            {(sortBy === 'today' ? team.todayAds : team.monthlyAds).toLocaleString()}
                          </div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl border border-gray-100/50">
                          <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">平均 eCPM</div>
                          <div className={`text-xs font-black ${team.ecpm >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                              {team.ecpm.toFixed(2)}
                          </div>
                      </div>
                  </div>
                  <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/30 flex items-center justify-between">
                      <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider flex items-center">
                          <TrendingUp size={12} className="text-[#1E40AF] mr-1.5" />
                          本月团队累计总收益
                      </div>
                      <div className="text-sm font-black text-[#1E40AF]">
                          ¥ {Number(team.totalRevenue).toFixed(2)}
                      </div>
                  </div>
              </div>

              <button 
                onClick={() => setSelectedTeam(team)}
                className="w-full flex items-center justify-between pt-2 border-t border-gray-50 active:bg-gray-50 rounded-b-xl -m-1 p-1 transition-colors"
              >
                  <div className="flex items-center space-x-1 pl-2">
                      { (sortBy === 'today' ? team.todayGrowth : team.monthGrowth) >= 0 ? (
                        <PlayCircle size={10} className="text-green-500" />
                      ) : (
                        <TrendingDown size={10} className="text-red-500" />
                      )}
                      <span className="text-[9px] text-gray-400 font-bold">
                        较{sortBy === 'today' ? '昨日' : '上月'}业绩{ (sortBy === 'today' ? team.todayGrowth : team.monthGrowth) >= 0 ? '上涨' : '下降' } {Math.abs(sortBy === 'today' ? team.todayGrowth : team.monthGrowth)}%
                      </span>
                  </div>
                  <div className="flex items-center text-[9px] font-black text-[#1E40AF] pr-2">
                      {sortBy === 'today' ? '查看今日成员详情' : '查看本月成员详情'}
                      <ChevronRight size={14} className="text-[#1E40AF] ml-0.5" />
                  </div>
              </button>
            </div>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
            <Search size={48} className="opacity-10 mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">未搜索到相关团队</p>
            <button 
              onClick={() => setTeamSearchTerm('')}
              className="mt-4 text-[10px] text-[#1E40AF] font-black underline uppercase"
            >
              显示所有团队
            </button>
          </div>
        )}
        {filteredAndSortedTeams.length > 0 && (
          <div className="py-6 text-center">
              <p className="text-[10px] text-gray-300 font-medium">仅展示活跃排名前 20 的团队</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Team;
