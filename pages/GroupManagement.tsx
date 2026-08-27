import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Search, X, Edit2, Trash2, Loader2, 
  ChevronRight, ChevronLeft, AlertCircle, Users2, Award, ChevronUp, ChevronDown, RefreshCw, BarChart3
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { AdminUser, UserRole } from '../types';
import {
  shouldShowViewGroupLeaderButton,
  normalizeViewGroupLeaderTarget,
  dispatchViewGroupLeaderPerformanceEvent,
  type ViewGroupLeaderTarget,
} from '../utils/viewGroupLeaderPerformance';

/* [调试专用] 按钮可见性拆分判断
 * 产品明确要求：
 *   - show：只看 role + 组基本信息（只要是团队长/超管且有组，一定显示）
 *   - disabled：只拦 show=false。onViewGroupLeaderPerformance 是**可选 prop**（某些嵌入场景没传），
 *     此时 click 内部静默 return 即可，**视觉上绝不灰化**（避免用户误解"功能不可用"）
 */
function debugDecideViewGroupLeaderButton(
  currentUserRole: UserRole | string | null | undefined,
  group: Group | null | undefined,
  _cbExists: boolean,
) {
  const show = shouldShowViewGroupLeaderButton(currentUserRole, group as any);
  // 注意：disabled 不再看 _cbExists —— 永远只看 show；_cbExists 仅作为 debug 日志字段
  const disabled = !show;
  return { show, disabled };
}

interface Group {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  createdAt: string;
  memberCount?: number;
  todayActive?: number;
  monthlyActive?: number;
  todayRevenue?: number;
  monthlyRevenue?: number;
  todayAdCount?: number;
  yesterdayAdCount?: number;
  avgEcpm?: number;
  yesterdayRevenue?: number;
  commission?: number;
  groupLeaderId?: string;
  groupLeaderName?: string;
  /** 组长角色：NORMAL_ADMIN = 团队长(P2+)、GROUP_LEADER = 组长(P1)、SUPER_ADMIN；供 App.tsx 分发业绩页面，保证 view-as-other 与本人底栏业绩 100% 一致 */
  groupLeaderRole?: string;
  /** 组长职级码（P1/P2/P3/P4），后端在 groups 接口里返回带了就显示徽章，没带就不显示 */
  groupLeaderLevel?: string;
  /** 手动档（true=琥珀色扳手徽章，false/不传=正常彩色渐变徽章） */
  groupLeaderLevelManual?: boolean;
  growthRate?: number;
  /** [超管端] 组类型标识：'leader_team' = 团队长本人战队总卡(整支战队)，'leader_group' = 组长小组/直推成员等子组卡；缺省时按真实组兜底 */
  kind?: 'leader_team' | 'leader_group' | 'direct_members';
  // ===== [ID Bag 透传] 以下字段仅用于 normalizeViewGroupLeaderTarget 组装多参数 query，
  //       后端 resolveTargetAdmin 支持 ObjectId / Admin.userId / Employee.employeeId 三任一命中
  /** 组长本人 Admin._id / Mongo ObjectId */
  _id?: string | null;
  objectId?: string | null;
  adminId?: string | null;
  /** 组长本人 Admin.userId（数字工号 / 登录账号） */
  userId?: string | null;
  /** 组长 Admin.userId（数字工号，同义：带 groupLeader 前缀） */
  groupLeaderUserId?: string | null;
  adminUserId?: string | null;
  /** 组长 Employee.employeeId（员工工号，同义） */
  employeeId?: string | null;
  groupLeaderEmployeeId?: string | null;
  /** [超管专属] 仅用于在两支战队之间插入"战队分组标题栏"（合成假卡，不渲染卡片内容）。TL/GL 分支不会出现该字段 */
  _teamHeader?: {
    teamIndex: number;
    teamName: string;
    teamLeaderName?: string;
    teamLeaderLevel?: string;
    teamLeaderLevelManual?: boolean;
    teamTodayRevenue: number;
    teamMemberCount: number;
  };
}

interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  todayWatched: number;
  todayEarnings: number;
  status: '在线' | '离线';
}

/**
 * 团队卡片「组长：XX」后面的职级小徽章。
 * 纯 P 码显示（P1/P2/P3/P4），不追加中文职级名，与业绩页大字显示口径一致。
 * 只要 group.groupLeaderLevel 有值就显示；后端还没加字段的过渡期完全不渲染，不占位不阻塞。
 */
function GroupLeaderLevelBadge({ level, isManual }: { level?: string; isManual?: boolean }) {
  if (!level) return null;
  const lv = String(level).trim().toUpperCase();
  if (!lv) return null;
  const base =
    'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-tight leading-none border shrink-0 select-none ml-1.5 align-middle';
  if (isManual) {
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
        <span className="mr-0.5">🔧</span>
        {lv}
      </span>
    );
  }
  const themes: Record<string, string> = {
    P1: 'bg-gradient-to-br from-sky-100 to-sky-200 border-sky-300 text-sky-800',
    P2: 'bg-gradient-to-br from-emerald-100 to-teal-200 border-emerald-300 text-emerald-800',
    P3: 'bg-gradient-to-br from-amber-100 to-yellow-200 border-amber-300 text-amber-900',
    P4: 'bg-gradient-to-br from-fuchsia-100 to-purple-200 border-fuchsia-300 text-fuchsia-800',
    P5: 'bg-gradient-to-br from-rose-100 to-red-200 border-rose-300 text-rose-800',
  };
  const theme = themes[lv] ?? 'bg-gray-100 border-gray-300 text-gray-700';
  return <span className={`${base} ${theme}`}>{lv}</span>;
}

export interface GroupManagementProps {
  /** 团队长/超管点组卡上的『业绩▸』按钮时回传：目标组长 + 来源组名 */
  onViewGroupLeaderPerformance?: (target: ViewGroupLeaderTarget) => void;
}

const GroupMemberDetail: React.FC<{ 
  group: Group; 
  timeRange: 'today' | 'month'; 
  membersCache: { [groupId: string]: { [timeRange: string]: GroupMember[] } };
  setMembersCache: React.Dispatch<React.SetStateAction<{ [groupId: string]: { [timeRange: string]: GroupMember[] } }>>;
  onBack: () => void;
  // 通过 props 注入：团队全量用户加载 + 按组过滤的共享逻辑
  fetchTeamUsers: (timeRange: 'today' | 'month') => Promise<any[]>;
  filterMembersForGroup: (teamUsers: any[], group: Group) => any[];
}> = ({ group, timeRange, membersCache, setMembersCache, onBack, fetchTeamUsers, filterMembersForGroup }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings'>('earnings');
  const [memberRefreshTrigger, setMemberRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchMembers = async () => {
      // 如果是刷新请求，先清空缓存
      if (memberRefreshTrigger > 0) {
        setMembersCache(prev => ({
          ...prev,
          [group.id]: {
            ...prev[group.id],
            [timeRange]: undefined
          }
        }));
      }
      
      // 检查缓存中是否已有数据
      if (membersCache[group.id]?.[timeRange] && memberRefreshTrigger === 0) {
        console.log('Using cached data for group:', group.id, 'timeRange:', timeRange);
        setMembers(membersCache[group.id][timeRange]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log('Group ID:', group.id);
        console.log('Group name:', group.name);

        // 共享团队全量用户缓存：所有组拉一次，再按组过滤
        const teamUsers = await fetchTeamUsers(timeRange);
        console.log('[GroupMemberDetail] teamUsers total:', teamUsers.length);
        const groupMembers = filterMembersForGroup(teamUsers, group);
        console.log('[GroupMemberDetail] groupMembers filtered:', groupMembers.length, group.name);

        // 转换用户数据为GroupMember格式
        const formattedMembers: GroupMember[] = groupMembers.map((user: any): GroupMember => ({
          id: user.employeeId || user.id || user.userId || '',
          name: user.realName || user.realname || user.name || user.username || user.userName || user.userId || user.employeeId || '',
          avatar: user.avatar || '',
          todayWatched: user.watched || 0,
          todayEarnings: (user.earnings || 0) / 1000,
          status: (user.watched || 0) > 0 ? '在线' : '离线'
        }));

        // 保存到缓存
        setMembersCache(prev => ({
          ...prev,
          [group.id]: {
            ...prev[group.id],
            [timeRange]: formattedMembers
          }
        }));

        setMembers(formattedMembers);
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [group.id, group.name, group, timeRange, membersCache, setMembersCache, memberRefreshTrigger, fetchTeamUsers, filterMembersForGroup]);

  // Sort by selected criteria and filter by search term
  const sortedAndFilteredMembers = useMemo(() => {
    return members
      .filter(m => m.name.includes(searchTerm) || m.id.includes(searchTerm))
      .sort((a, b) => {
        if (sortBy === 'watched') {
          return b.todayWatched - a.todayWatched; // High to Low
        } else { // earnings
          return b.todayEarnings - a.todayEarnings; // High to Low
        }
      });
  }, [members, searchTerm, sortBy]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      <header className="sticky top-0 bg-white z-50 px-4 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 ml-2">
            <h1 className="text-lg font-bold text-gray-900">{group.name} 小组成员</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">
              共 {group.memberCount} 位成员
            </p>
          </div>
          <button
            onClick={() => setMemberRefreshTrigger(prev => prev + 1)}
            className="p-2 text-gray-500 hover:text-[#1E40AF] hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
          </button>
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
        
        <div className="flex bg-gray-100 p-1 rounded-xl mt-3">
          <button
            onClick={() => setSortBy('earnings')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'earnings' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
          >
            按收益
          </button>
          <button
            onClick={() => setSortBy('watched')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sortBy === 'watched' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
          >
            按次数
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {sortedAndFilteredMembers.map((member, index) => (
          <div key={`${group.id}-${member.id}-${index}`} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600`}>
                    {member.id}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${member.status === '在线' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{member.name}</div>
                </div>
              </div>
              <div className="text-right">
                {sortBy === 'earnings' ? (
                  <>
                    <div className="text-xs font-black text-[#1E40AF]">
                      ¥ {Number(member.todayEarnings).toFixed(2)}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {timeRange === 'today' ? '今日' : '本月'}预计收益
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-black text-[#1E40AF]">
                      {member.todayWatched.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                      {timeRange === 'today' ? '今日' : '本月'}观看次数
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  观看次数
                </div>
                <div className="text-[11px] font-black text-gray-700">
                  {member.todayWatched.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100/50">
                <div className="text-[8px] text-gray-400 font-bold uppercase mb-0.5">
                  个人平均金币
                </div>
                <div className={`text-[11px] font-black ${(member.todayEarnings * 1000 / (member.todayWatched || 1)) >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                  {(member.todayEarnings * 1000 / (member.todayWatched || 1)).toFixed(2)}
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

const GroupManagement: React.FC<GroupManagementProps> = ({ onViewGroupLeaderPerformance }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'today' | 'month'>('today');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  // 成员详情缓存
  const [membersCache, setMembersCache] = useState<{ [groupId: string]: { [timeRange: string]: GroupMember[] } }>({});
  
  // 刷新计数器
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  // 顶部总卡：直接复用首页同款 /admin/dashboard/kpi，口径与首页一致（避免前端加总与后端聚合不一致）
  const [kpiSummary, setKpiSummary] = useState<{ todayRevenue?: number; monthRevenue?: number; teamCommission?: number } | null>(null);

  // 团队全量用户缓存（teamName=当前团队），key: timeRange；避免每个组都去发一次请求
  const [teamUsersCache, setTeamUsersCache] = useState<{ [timeRange: string]: any[] }>({});

  // 工具：从 response 里把 users 数组解出来（统一处理多种后端返回结构）
  const extractUserArray = (resp: any): any[] => {
    if (!resp) return [];
    if (Array.isArray(resp)) return resp;
    if (typeof resp === 'object') {
      for (const k of ['data', 'users', 'list', 'result', 'items', 'records']) {
        if (Array.isArray((resp as any)[k])) return (resp as any)[k];
      }
    }
    return [];
  };

  // 工具：拉一次「全团队 + 时间范围」的全量 dashboard users，所有组共享
  //  - TL（NORMAL_ADMIN）/ GL（GROUP_LEADER）本人视角：按自己的 teamName 过滤
  //  - SUPER_ADMIN 视角：不传 team 限制，直接拉 5000 上限的全量用户（所有战队+小组都能在此过滤）
  const fetchTeamUsers = useCallback(
    async (timeRange: 'today' | 'month'): Promise<any[]> => {
      const exist = teamUsersCache[timeRange];
      if (exist && Array.isArray(exist)) return exist;
      const user = currentUser || authService.getCurrentUser();
      // ⚠️ 枚举值是 superadmin(全小写无下划线)，实际 token 解出多种写法；统一去下划线+全大写再判
      const roleRaw = (user?.role ? String(user.role).trim() : '');
      const roleUp = roleRaw.toUpperCase().replace(/_/g, '');
      const enumSuperUp = String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '');
      const enumAdminManagerUp = String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '');
      const isSuper =
        roleUp === enumSuperUp ||
        roleUp === 'SUPERADMIN' ||
        roleUp === 'SUPERADMINISTRATOR' ||
        roleUp === enumAdminManagerUp;
      const teamName = user?.teamName || '';
      // 超管：不传 team 查询参数，直接拉全平台用户（5000 limit 够覆盖所有战队）
      const teamQuery = (!isSuper && teamName) ? `&team=${encodeURIComponent(teamName)}` : '';
      const url = `/admin/dashboard/users?range=${timeRange}&limit=5000${teamQuery}`;
      console.log('[GM] fetchTeamUsers:', url, 'isSuper:', isSuper, 'roleRaw:', roleRaw);
      const resp = await request<any>(url, { method: 'GET' }).catch(() => null);
      const arr = extractUserArray(resp);
      setTeamUsersCache(prev => ({ ...prev, [timeRange]: arr }));
      return arr;
    },
    [currentUser, teamUsersCache]
  );

  // 工具：从团队全量 users 里过滤出属于某个 group 的成员（覆盖脏 ID 的各种情况）
  const filterMembersForGroup = useCallback(
    (teamUsers: any[], group: Group): any[] => {
      const gid = (group.id || '').toString().trim();
      const gName = (group.name || '').toString().trim();
      const gTeamId = (group.teamId || '').toString().trim();
      const gTeamName = (group.teamName || '').toString().trim();
      const gLeaderId = (group.groupLeaderId || '').toString().trim();
      const gLeaderName = (group.groupLeaderName || '').toString().trim();
      const user = currentUser || authService.getCurrentUser();
      // cuiding 登录时 user.realName=崔鼎，组 leaderName=崔鼎；用户用 currentUser 兜底直推成员判断
      const tlRealName = user?.realName ? String(user.realName).trim() : '';

      // ===== [超管专用] kind='leader_team'：整支战队的所有成员（战队卡的"查看成员详情"）=====
      if (group.kind === 'leader_team') {
        return teamUsers.filter((u: any) => {
          // 按 teamId / teamName 双维度匹配（任一命中就算这支战队）
          const uTeamName = u.teamName ? String(u.teamName).trim() : '';
          if (gTeamName && uTeamName === gTeamName) return true;
          const uTeamId = [u.teamId, u.teamLeaderId, u.parentTeamId]
            .map(x => x ? String(x).trim() : '')
            .filter(Boolean);
          if (gTeamId && uTeamId.includes(gTeamId)) return true;
          // 如果上面都不命中（字段没带 team 信息），再兜底按 supervisor 链判断：
          // supervisorRealName / supervisorName / groupLeaderName 命中任一"该战队长姓名"也视为同战队
          if (gLeaderName) {
            const sn = u.supervisorRealName ? String(u.supervisorRealName).trim() : '';
            const sn2 = u.supervisorName ? String(u.supervisorName).trim() : '';
            const gl = u.groupLeaderName ? String(u.groupLeaderName).trim() : '';
            if (sn === gLeaderName || sn2 === gLeaderName || gl === gLeaderName) return true;
          }
          return false;
        });
      }

      // 特殊虚拟组「直推成员」：1) user.isDirect=true  2) supervisorRealName === 团队长真实姓名（兜底）
      if (group.kind === 'direct_members' || !gName || gName === '直推成员' || gName.includes('直属') || gName.includes('未分组')) {
        // 团队长真实姓名的多个来源：currentUser.realName → 组自身带的 groupLeaderName（虚拟组里这个通常就填的团队长姓名）
        const anyGroup = group as any;
        const tlNameFallback =
          tlRealName ||
          (group.groupLeaderName ? String(group.groupLeaderName).trim() : '') ||
          (anyGroup.leaderName ? String(anyGroup.leaderName).trim() : '');
        return teamUsers.filter((u: any) => {
          if (u.isDirect === true || u.isDirect === 1) return true;
          if (typeof u.isDirect === 'string') {
            const s = u.isDirect.toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
          }
          const sn = u.supervisorRealName ? String(u.supervisorRealName).trim() : '';
          if (tlNameFallback && sn === tlNameFallback) return true;
          const sName = u.supervisorName ? String(u.supervisorName).trim() : '';
          if (tlNameFallback && sName === tlNameFallback) return true;
          return false;
        });
      }

      // 真实组（kind='leader_group' 或 默认缺省）：多条件 OR 匹配
      return teamUsers.filter((u: any) => {
        const u_groupIds = [u.teamGroupId, u.groupId, u.group]
          .map(x => (x ? String(x).trim() : ''))
          .filter(Boolean);
        const u_groupName = u.groupName ? String(u.groupName).trim() : '';
        const u_employeeId = u.employeeId ? String(u.employeeId).trim() : '';
        const u_parentId = u.parentId ? String(u.parentId).trim() : '';
        const u_supervisorRealName = u.supervisorRealName ? String(u.supervisorRealName).trim() : '';

        // 1) teamGroupId/groupId/group 等于 组自己的 id（TeamGroup._id 正确路径 / 虚拟组 id）
        if (gid && u_groupIds.includes(gid)) return true;
        // 2) groupName 精确 = 组名
        if (gName && u_groupName === gName) return true;
        // 3) teamGroupId/groupId 等于 组长本人的 Admin._id（之前脏数据路径：teamGroupId 填了组长 Admin._id）
        if (gLeaderId && u_groupIds.includes(gLeaderId)) return true;
        // 4) 组长本人的账号兜底（employeeId / parentId === 组长ID 且没归到其他组）
        if (gLeaderId && (u_employeeId === gLeaderId || u_parentId === gLeaderId)) {
          if (!u_groupName && u_groupIds.length === 0) return true;
        }
        // 5) 上级真实姓名 === 组长姓名（"洁然如初代理" 是 subTeam，其下 51 人 teamGroupId/groupName 未填组信息，唯一关联键是 supervisorRealName == 范洁）
        if (gLeaderName && u_supervisorRealName === gLeaderName) return true;
        return false;
      });
    },
    [currentUser]
  );

  const fetchGroupData = useCallback(async () => {
    setLoading(true);
    try {
      const user = authService.getCurrentUser();
      setCurrentUser(user);

      // ⚠️ 角色判断统一归一化：枚举值格式不统一（SUPER_ADMIN='superadmin'全小写无下划线，NORMAL_ADMIN='NORMAL_ADMIN'有下划线且全大写），实际 token 解出可能也不一致
      const roleRaw = (user?.role ? String(user.role).trim() : '');
      const roleUp = roleRaw.toUpperCase().replace(/_/g, '');
      const isTL =
        roleUp === String(UserRole.NORMAL_ADMIN).toUpperCase().replace(/_/g, '') ||
        roleUp === 'NORMALADMIN' ||
        roleUp === 'TEAMLEADER' ||
        roleUp === 'TL';
      const isSuper =
        roleUp === String(UserRole.SUPER_ADMIN).toUpperCase().replace(/_/g, '') ||
        roleUp === 'SUPERADMIN' ||
        roleUp === 'SUPERADMINISTRATOR' ||
        roleUp === String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '');
      const isGL =
        roleUp === String(UserRole.GROUP_LEADER).toUpperCase().replace(/_/g, '') ||
        roleUp === 'GROUPLEADER' ||
        roleUp === 'GL' ||
        roleUp === 'GROUPHEAD' ||
        roleUp === 'LEADER';

      let groupsResponse: Group[] = [];
      let kpi: any = null;

      if (isTL) {
        // 并发起两个请求：小组列表（卡片用）+ KPI（顶部总卡，和首页口径一致）
        const rangeParam = sortBy; // today | month
        const [groupLeadersData, kpiResp] = await Promise.all([
          request<any>(`/admin/employee/team-leader/groups?teamId=${user.id}&range=${rangeParam}`, {
            method: 'GET'
          }),
          request<any>(`/admin/dashboard/kpi?range=${rangeParam}`, {
            method: 'GET'
          }).catch(() => null),
        ]);
        console.log('Raw groupLeadersData:', groupLeadersData);
        console.log('Raw kpiResp:', kpiResp);
        
        kpi = kpiResp && typeof kpiResp === 'object' ? kpiResp : null;
        
        // 直接使用groupLeadersData，因为api.ts的request函数已经返回了result.data
        let dataArray: any[] = [];
        if (Array.isArray(groupLeadersData)) {
          dataArray = groupLeadersData;
        } else {
          console.warn('Unexpected data format:', groupLeadersData);
          dataArray = [];
        }
        console.log('dataArray:', dataArray);
        
        const n = (v: any, fb = 0) => {
          const x = Number(v);
          return Number.isFinite(x) ? x : fb;
        };
        groupsResponse = dataArray.map((g: any) => {
          const _todayRevenue = n(g.todayRevenue, n(g.totalRevenue, 0));
          const _monthlyRevenue = n(g.monthlyRevenue, n(g.totalRevenue, 0));
          const _yesterdayRevenue = n(g.yesterdayRevenue, 0);
          let _growthRate: number;
          if (typeof g.growthRate === 'number' && Number.isFinite(g.growthRate)) {
            _growthRate = g.growthRate;
          } else {
            _growthRate = _yesterdayRevenue > 0
              ? ((_todayRevenue - _yesterdayRevenue) / _yesterdayRevenue) * 100
              : _todayRevenue > 0 ? 9999 : 0;
          }
          // TL 端 group kind 判断（和前端历史口径对齐）：直推虚拟组 / 真实组长组
          const rawName = String(g.groupName || g.name || '').trim();
          const rawKind =
            (typeof g.kind === 'string' && g.kind.trim() ? g.kind.trim() : '') ||
            (typeof g.type === 'string' && g.type.trim() ? g.type.trim() : '');
          let _kind: Group['kind'];
          if (rawKind === 'direct_members' || rawName === '直推成员' || rawName.includes('直属') || rawName.includes('未分组')) {
            _kind = 'direct_members';
          } else {
            _kind = 'leader_group';
          }
          return {
            id: g.groupId || g._id || g.id || '',
            name: rawName || '未命名组',
            teamId: user.id,
            teamName: user.teamName,
            kind: _kind,
            createdAt: g.createdAt || new Date().toISOString(),
            memberCount: n(g.memberCount, 0),
            todayActive: n(g.todayActive, n(g.memberCount, 0)),
            todayRevenue: _todayRevenue,
            monthlyRevenue: _monthlyRevenue,
            todayAdCount: n(g.todayAdCount, n(g.totalAds, 0)),
            avgEcpm: n(g.avgEcpm, n(g.avgGold, 0)),
            yesterdayRevenue: _yesterdayRevenue,
            commission: n(g.commission, 0.05),
            // 组长角色：NORMAL_ADMIN(团队长P2+) / GROUP_LEADER(组长P1)，供 App.tsx 分发业绩页面用
            // ⚠️ 识别优先级（后端 groupLeaderRole 为空时用这些强信号字段推导，避免 commission=0.1 把组长误判为 TL）：
            //   ① 直接字段 groupLeaderRole/role/leaderRole/...  → 用原值
            //   ② kind=direct_members（直推虚拟组）→ 真实身份是当前 TL 本人 → NORMAL_ADMIN
            //   ③ teamLevel=sub（子战队，范洁=子战队长 P2）→ NORMAL_ADMIN
            //   ④ teamLevel=own（自己名下小组，周欢/李想等 P1）→ GROUP_LEADER
            //   ⑤ groupLeaderLevel（职级码） P1 → GROUP_LEADER；P2~P8 → NORMAL_ADMIN
            //   ⑥ 最后才用 commission 兜底（但注意：groups接口的 commission 是组总佣金率=0.1 普遍偏高，不能唯一依赖）
            groupLeaderRole: (() => {
              const raw = [
                g.groupLeaderRole, g.role, g.leaderRole, g.adminRole,
                g.groupRole, g.glRole, g.groupLeaderType, g.leaderType,
                g.leaderRoleName, g.groupLeaderRoleName, g.glRoleName,
              ].find(v => typeof v === 'string' && v.trim());
              if (typeof raw === 'string') return raw.trim();
              // ② kind 直推虚拟组：真实身份=当前 TL 本人（崔鼎）
              if (_kind === 'direct_members') return UserRole.NORMAL_ADMIN;
              // ③/④ teamLevel：sub → 子战队长(TL)；own → 组长小组(GL)
              const tLv = (typeof g.teamLevel === 'string' ? g.teamLevel.trim().toLowerCase() : '');
              if (tLv === 'sub') return UserRole.NORMAL_ADMIN;
              if (tLv === 'own') return UserRole.GROUP_LEADER;
              // ⑤ groupLeaderLevel / level：P1=GL, P2~P8=TL
              const lv = ([
                g.groupLeaderLevel, g.level, g.levelCode, g.glLevel,
                g.leaderLevel, g.groupLevel, g.currentLevel, g.adminLevel,
              ].find(v => typeof v === 'string' && v.trim()) || '').trim().toUpperCase();
              if (lv === 'P1') return UserRole.GROUP_LEADER;
              if (lv && /^P[2-8]$/.test(lv)) return UserRole.NORMAL_ADMIN;
              // ⑥ 最后 commission 兜底（groups接口返回的 commission 常常=0.1，会把 GL 误判成 TL，仅作弱兜底）
              //    不直接 return undefined，避免后续 App.tsx 再次落到 commission 分支
              return undefined;
            })(),
            // 组长标识：后端 resolveTargetAdmin 三任中其一即可，这里把所有可能字段都兜底取
            groupLeaderId:
              (g.groupLeaderId && String(g.groupLeaderId).trim()) ||
              (g.leaderId && String(g.leaderId).trim()) ||
              (g.groupLeaderUserId && String(g.groupLeaderUserId).trim()) ||
              (g.adminUserId && String(g.adminUserId).trim()) ||
              (g.groupLeaderEmployeeId && String(g.groupLeaderEmployeeId).trim()) ||
              (g.employeeId && String(g.employeeId).trim()) ||
              '',
            groupLeaderName:
              (g.groupLeaderName && String(g.groupLeaderName).trim()) ||
              (g.leaderName && String(g.leaderName).trim()) ||
              (g.groupLeader && String(g.groupLeader).trim()) ||
              '',
            // [ID Bag 透传] 把原始 g 的所有候选 ID 都透传到 Group，normalizeViewGroupLeaderTarget 会收齐，
            //   组装多参数 query：?userId=...&adminId=...&employeeId=...&objectId=...
            //   杜绝"前端只传 employeeId 而后端按 ObjectId 查 → 全 0 数据"
            _id: (g._id != null ? String(g._id) : null) || (g.objectId != null ? String(g.objectId) : null) || (g.adminId != null ? String(g.adminId) : null) || null,
            objectId: (g.objectId != null ? String(g.objectId) : null) || (g._id != null ? String(g._id) : null) || null,
            adminId: (g.adminId != null ? String(g.adminId) : null) || (g._id != null ? String(g._id) : null) || null,
            userId: (g.userId != null ? String(g.userId) : null) || (g.groupLeaderUserId != null ? String(g.groupLeaderUserId) : null) || (g.adminUserId != null ? String(g.adminUserId) : null) || null,
            groupLeaderUserId: (g.groupLeaderUserId != null ? String(g.groupLeaderUserId) : null) || (g.adminUserId != null ? String(g.adminUserId) : null) || null,
            adminUserId: (g.adminUserId != null ? String(g.adminUserId) : null) || null,
            employeeId: (g.employeeId != null ? String(g.employeeId) : null) || (g.groupLeaderEmployeeId != null ? String(g.groupLeaderEmployeeId) : null) || null,
            groupLeaderEmployeeId: (g.groupLeaderEmployeeId != null ? String(g.groupLeaderEmployeeId) : null) || (g.employeeId != null ? String(g.employeeId) : null) || null,
            // 职级：后端 groups 接口带了就透传；兼容多个可能的字段命名（level/glLevel/groupLevel 等），避免后端改了个名字前端又丢
            groupLeaderLevel: (() => {
              const raw = [
                g.groupLeaderLevel, g.level, g.levelCode, g.glLevel,
                g.leaderLevel, g.groupLevel, g.currentLevel, g.adminLevel,
              ].find(v => typeof v === 'string' && v.trim());
              return typeof raw === 'string' ? raw.trim().toUpperCase() : undefined;
            })(),
            groupLeaderLevelManual: (() => {
              const v = [g.groupLeaderLevelManual, g.isManual, g.manual, g.levelManual, g.glManual]
                .find(x => typeof x === 'boolean' || x === 'true' || x === 'false' || x === 1 || x === 0);
              if (v === undefined || v === null) return undefined;
              return v === true || v === 'true' || v === 1;
            })(),
            growthRate: _growthRate,
          };
        });
        console.log('groupsResponse:', groupsResponse);
      } else if (isSuper) {
        // ============================================================
        // [超管专属] Feature Flag：后端新接口已上线时，把下面 false 改成 true
        //   新接口：GET /admin/dashboard/super/manager-direct-cards
        //   契约文档：_backend_contract_manager_direct_cards.txt（发给后端）
        //   TDD 脚本  ：_tdd_sa_manager_direct_cards_RED_GREEN.mjs
        // ============================================================
        // 默认(false)：沿用旧管线（4接口并行 + 战队header桶排序 + 嵌套三层）
        // 切换(true)：每位管理者一张「直属成员业绩卡」的扁平列表，
        //             杜绝重复统计 + 嵌套聚合bug，加载速度更快
        // ============================================================
        const USE_NEW_MANAGER_DIRECT_API: boolean = true;
        const rangeParam = sortBy; // today | month
        const n = (v: any, fb = 0) => {
          const x = Number(v);
          return Number.isFinite(x) ? x : fb;
        };
        const __USE_NEW__ = USE_NEW_MANAGER_DIRECT_API;
        let __NEW_FAILED__ = false;
        if (__USE_NEW__) {
          try {
            // ===== [新接口分支] 单次请求拉扁平直属卡列表 =====
            const q = new URLSearchParams();
            q.set('range', rangeParam);
            q.set('limit', '2000');
            const resp = await request<any>(
              `/admin/dashboard/super/manager-direct-cards?${q.toString()}`,
              { method: 'GET' },
            ).catch((e) => { console.warn('[GM-SA-NEW] 新接口请求失败，fallback 旧管线：', e); return null; });
            const cards: any[] = Array.isArray(resp) ? resp : (Array.isArray((resp as any)?.data) ? (resp as any).data : []);
            if (cards.length > 0) {
              // 映射：新接口 JSON → Group interface（复用下方卡面渲染，完全不动 TL/GL 渲染逻辑）
              groupsResponse = cards.map((c: any): Group => {
                const realName = String(c.realName || c.name || '').trim();
                const username = String(c.username || c.userId || '').trim();
                const dispName = realName || username || '未命名管理者';
                // ===== [Bug2 修复 2026-07-13] groupLeaderId 主参数优先级：Admin.userId(username字符串)优先！ =====
                // 后端 resolveTargetAdmin 先拿 URL 第一个 userId 参数做匹配：如果是 ObjectId(69af...)当 userId 传→查不到→404 全 0
                // 必须把字符串 username(cuiding/huangzhenhui) 放最前面，才能命中 NORMAL_ADMIN 兼容分支正确返回。
                // 优先级：1.username → 2.employeeId → 3.adminUserId → 4.leader关联ID → 5.ObjectId/adminId → 6.id
                const lid =
                  (username && username.trim()) ||
                  String(c.employeeId || '').trim() ||
                  String(c.adminUserId || c.userId || '').trim() ||
                  String(c.groupLeaderId || c.leaderId || '').trim() ||
                  String(c._id || c.objectId || c.adminId || '').trim() ||
                  String(c.id || '').trim();
                return {
                  id: lid || `mgc_${Math.random().toString(36).slice(2, 10)}`,
                  name: dispName,
                  teamId: lid || '',
                  teamName: String(c.teamName || c.team || '').trim(),
                  createdAt: String(c.createdAt || new Date().toISOString()),
                  memberCount: n(c.memberCount, 0),
                  todayActive: n(c.todayActive, n(c.memberCount, 0)),
                  todayRevenue: n(c.todayRevenue, 0),
                  monthlyRevenue: n(c.monthlyRevenue, n(c.todayRevenue, 0)),
                  todayAdCount: n(c.todayAdCount, n(c.impressions || c.totalAds, 0)),
                  avgEcpm: n(c.avgEcpm, n(c.ecpm || c.avgGold, 0)),
                  yesterdayRevenue: n(c.yesterdayRevenue, 0),
                  commission: n(c.commissionRate, n(c.rate, n(c.commission, 0.05))),
                  // 角色：[前端二次加固归一化] trim+toUpperCase+去下划线，彻底杜绝 "NORMAL_ADMIN" vs "group_leader" 写法差异导致分发错页面
                  //   （注意：如果原始字符串是空，按职级兜底；兜底后再归一化，保证返回值永远是 NORMALADMIN / GROUPLEADER 无下划线的标准常量）
                  groupLeaderRole: (() => {
                    const normR = (s: any): string => typeof s === 'string' ? s.trim().toUpperCase().replace(/_/g, '') : '';
                    const r0 = String(c.role || c.adminRole || c.userRole || '').trim();
                    if (r0) {
                      const nr = normR(r0);
                      if (nr === 'NORMALADMIN' || nr === 'TEAMLEADER' || nr === 'TL') return 'NORMALADMIN';
                      if (nr === 'GROUPLEADER' || nr === 'GL') return 'GROUPLEADER';
                      if (nr) return nr; // 其它奇怪值（如SUPERADMIN）直接返回（不会走到业绩分发）
                    }
                    const lv = String(c.level || '').trim().toUpperCase();
                    return (lv === 'P1') ? 'GROUPLEADER' : 'NORMALADMIN';
                  })(),
                  groupLeaderId: lid,
                  groupLeaderName: dispName,
                  // [ID Bag 透传]
                  _id: c._id != null ? String(c._id) : null,
                  objectId: c.objectId != null ? String(c.objectId) : (c._id != null ? String(c._id) : null),
                  adminId: c.adminId != null ? String(c.adminId) : (c._id != null ? String(c._id) : null),
                  userId: c.userId != null ? String(c.userId) : (username || null),
                  groupLeaderUserId: c.userId != null ? String(c.userId) : (username || null),
                  adminUserId: c.adminUserId != null ? String(c.adminUserId) : (username || null),
                  employeeId: c.employeeId != null ? String(c.employeeId) : null,
                  groupLeaderEmployeeId: c.employeeId != null ? String(c.employeeId)
                    : (c.groupLeaderEmployeeId != null ? String(c.groupLeaderEmployeeId) : null),
                  // 职级
                  groupLeaderLevel: (() => {
                    const lv = String(c.level || c.groupLeaderLevel || '').trim();
                    return lv ? lv.toUpperCase() : undefined;
                  })(),
                  groupLeaderLevelManual: (() => {
                    const v = [c.levelManual, c.isManual, c.manual, c.glManual]
                      .find(x => typeof x === 'boolean' || x === 'true' || x === 'false' || x === 1 || x === 0);
                    if (v === undefined || v === null) return undefined;
                    return v === true || v === 'true' || v === 1;
                  })(),
                  growthRate: (() => {
                    const g = c.growthRate;
                    if (typeof g === 'number' && Number.isFinite(g)) return g;
                    const y = n(c.yesterdayRevenue, 0);
                    const t = n(c.todayRevenue, 0);
                    return y > 0 ? ((t - y) / y) * 100 : (t > 0 ? 9999 : 0);
                  })(),
                  // 新接口下每张卡都是「直属成员」性质（不再嵌套），标记 kind 为 direct_members 语义即可
                  kind: 'direct_members',
                };
              });
              // ===== [前端二次加固排序] 100% 保证 UI 永远正确，不再依赖后端排好
              // 排序规则（三层主键）：
              //  1) role 优先：团队长(NORMALADMIN/TL) 永远在前(0)，组长(GROUPLEADER/GL) 在后(1)，其它 2
              //  2) 同 role：按 sortBy 对应业绩（today→todayRevenue / month→monthlyRevenue）倒序(高→低)
              //  3) 兜底：业绩相同时，成员多的在前
              {
                const normRSort = (s: any): string => typeof s === 'string' ? s.trim().toUpperCase().replace(/_/g, '') : '';
                const rolePrio = (g: Group): number => {
                  const nr = normRSort(g.groupLeaderRole);
                  if (nr === 'NORMALADMIN' || nr === 'TEAMLEADER' || nr === 'TL') return 0;
                  if (nr === 'GROUPLEADER' || nr === 'GL') return 1;
                  return 2;
                };
                groupsResponse = [...groupsResponse].sort((a, b) => {
                  const pa = rolePrio(a), pb = rolePrio(b);
                  if (pa !== pb) return pa - pb;
                  const ra = sortBy === 'today' ? n(a.todayRevenue, 0) : n(a.monthlyRevenue, 0);
                  const rb = sortBy === 'today' ? n(b.todayRevenue, 0) : n(b.monthlyRevenue, 0);
                  if (rb !== ra) return rb - ra;
                  return n(b.memberCount, 0) - n(a.memberCount, 0);
                });
                const top3 = groupsResponse.slice(0, 3).map((g) => ({
                  name: g.groupLeaderName || g.name,
                  role: normRSort(g.groupLeaderRole),
                  rev: (sortBy === 'today' ? g.todayRevenue : g.monthlyRevenue)?.toFixed?.(2) ?? '0.00',
                }));
                console.log(`[GM-SA-NEW] 前端二次强制排序后前3：${top3.map(x=>`${x.name}(${x.role})¥${x.rev}`).join(' → ')}；共${groupsResponse.length}张`);
              }
              // ===== 顶部总卡：直属口径汇总（所有管理者直属业绩之和） =====
              const gSumToday = groupsResponse.reduce((s, g) => s + n(g.todayRevenue, 0), 0);
              const gSumMonth = groupsResponse.reduce((s, g) => s + n(g.monthlyRevenue, 0), 0);
              setKpiSummary({
                todayRevenue: gSumToday || undefined,
                monthRevenue: gSumMonth || undefined,
                teamCommission: undefined,
              });
              // KPI 对象也回填一次，确保下方通用写回分支（1136+ 行）不会把正确的 setKpiSummary 再覆盖掉
              kpi = { __newAPISum: true, todayRevenue: gSumToday, monthRevenue: gSumMonth };
              console.log(`[GM-SA-NEW] 新接口成功：${groupsResponse.length} 位管理者直属卡，今日总业绩 ¥${gSumToday.toFixed(2)}`);
            } else {
              // 新接口返回空数组 → fallback 到旧管线（避免用户看到空页面）
              console.warn('[GM-SA-NEW] 新接口返回空数组，fallback 旧管线');
              __NEW_FAILED__ = true;
            }
          } catch (e: any) {
            console.warn('[GM-SA-NEW] 新接口异常，fallback 旧管线：', e?.message || e);
            __NEW_FAILED__ = true;
          }
        }
        if (!__USE_NEW__ || __NEW_FAILED__) {
        // ========== [旧管线 / Fallback] 所有团队长团队页卡片的大集合（不动 TL/GL 分支任何一行）==========
        // 数据管线（全部用 SA RED 脚本 TDD GREEN 验证过的现有接口，不用后端新接口）：
        //  ① 主枚举 = GET /admin/account/list?role=NORMAL_ADMIN&limit=1000  → 拿所有 TL 的 Admin._id = groups?teamId= 正确参数（10/10 全 200）
        //  ② 通道 2 = /admin/team-performance?range= → 用 leaderId 匹配，拿现成的 memberCount/totalRevenue/avgGold/growthRate 当 KPI 兜底
        //  ③ 通道 3 = GET /team/list → 兜底补战队名和 TL 名
        //  ④ 顶部总卡 = GET /admin/dashboard/kpi?range=（不带 team/teamId）TL_GLOBAL 汇总（/super/kpi 是公司利润口径不对）
        //  ⑤ 每支战队并行：
        //       A. GET /admin/employee/team-leader/groups?teamId=<admin._id>&range= → 与该 TL 自己底栏团队 Tab 打开看到的子组卡 list 100% 一致
        //       B. GET /admin/dashboard/kpi?range=&team=<teamName> → 构造战队级卡（kind=leader_team，TL 本人那张）
        // 渲染层（SA 专属 header 合成卡）：每支战队按 [_teamHeader 战队标题栏] + [leader_team 战队卡] + [subCards 子组] 顺序，
        //   完全复制该 TL 自己团队 Tab 的 UI（排序/职级徽章/业绩按钮/环比箭头 100% 同款），用 filteredGroups 桶排序保证战队聚合不被打散
        const normRole = (s: any): string => typeof s === 'string' ? s.trim().toUpperCase().replace(/_/g, '') : '';
        const TL_ROLE = 'NORMALADMIN';

        // ===== Step 1. 并行拉 4 个基础接口 =====
        const accQ = new URLSearchParams();
        accQ.set('role', 'NORMAL_ADMIN');
        accQ.set('limit', '1000');
        accQ.set('pageSize', '1000');
        accQ.set('perPage', '1000');
        accQ.set('page', '1');
        const [
          accountsResp,
          globalKpiResp,
          teamPerfResp,
          teamListResp,
        ] = await Promise.all([
          request<any>(`/admin/account/list?${accQ.toString()}`, { method: 'GET' })
            .catch((e) => { console.warn('[GM-SA] accounts fail:', e); return null; }),
          request<any>(`/admin/dashboard/kpi?range=${rangeParam}`, { method: 'GET' })
            .catch((e) => { console.warn('[GM-SA] global kpi fail:', e); return null; }),
          request<any>(`/admin/team-performance?range=${rangeParam}`, { method: 'GET' })
            .catch((e) => { console.warn('[GM-SA] teamPerf fail:', e); return null; }),
          request<any>('/team/list', { method: 'GET' })
            .catch((e) => { console.warn('[GM-SA] team/list fail:', e); return null; }),
        ]);

        // ===== Step 2. 主枚举 = accounts 里的 NORMAL_ADMIN 全量 Admin._id =====
        const adminsRaw: any[] = Array.isArray((accountsResp as any)?.admins)
          ? (accountsResp as any).admins
          : Array.isArray((accountsResp as any)?.data?.admins)
            ? (accountsResp as any).data.admins
            : [];
        const TL_ADMINS = adminsRaw.filter(a => normRole(a?.role) === TL_ROLE);
        console.log('[GM-SA] TL accounts=', TL_ADMINS.length, '(all admins=', adminsRaw.length, ')');

        // team-performance 按 leaderId 建索引（供每支战队拿 KPI 兜底）
        const teamPerfRaw: any[] = (() => {
          if (Array.isArray(teamPerfResp)) return teamPerfResp;
          if (teamPerfResp && Array.isArray((teamPerfResp as any).teams)) return (teamPerfResp as any).teams;
          if (teamPerfResp && Array.isArray((teamPerfResp as any).data)) return (teamPerfResp as any).data;
          if (teamPerfResp && (teamPerfResp as any).result && Array.isArray((teamPerfResp as any).result.teams)) return (teamPerfResp as any).result.teams;
          return [];
        })();
        const tpByLeaderId = new Map<string, any>();
        const tpByTeamName = new Map<string, any>();
        for (const t of teamPerfRaw) {
          const lid = String(t.leaderId || t.teamLeaderId || t.ownerId || t.adminId || '').trim();
          const tn = String(t.teamName || t.name || t.leader || '').trim();
          if (lid) tpByLeaderId.set(lid, t);
          if (tn) tpByTeamName.set(tn, t);
        }
        // team/list 按 id 建索引（补战队名兜底）
        const teamListRaw: any[] = Array.isArray((teamListResp as any)?.data)
          ? (teamListResp as any).data
          : Array.isArray(teamListResp) ? teamListResp : [];
        const tlById = new Map<string, any>();
        for (const t of teamListRaw) {
          const id = String(t.id || t.teamId || t._id || '').trim();
          if (id) tlById.set(id, t);
        }

        // ===== Step 3. 顶部总卡口径（TL_GLOBAL 汇总，与首页口径对齐）=====
        const gK = (globalKpiResp && typeof globalKpiResp === 'object')
          ? ((globalKpiResp as any).data ?? (globalKpiResp as any).success !== false ? globalKpiResp : null)
          : null;
        if (gK && typeof gK === 'object') {
          const todayRevenue = n(gK.todayRevenue, n(gK.teamRevenue));
          const monthRevenue = n(gK.monthRevenue, n(gK.monthlyRevenue, n(gK.teamRevenue)));
          setKpiSummary({
            todayRevenue: todayRevenue || undefined,
            monthRevenue: monthRevenue || undefined,
            teamCommission: n(gK.teamCommission) || undefined,
          });
          kpi = gK;
        }

        // ===== Step 4. 把 TL_ADMINS 映射成「待查询战队列表」=====
        //   teamId(=teamId 参数) = admin._id（groups 接口的 teamId=TL Admin._id，RED 验证 10/10 全通）；
        //   teamName 优先拿 admin.teamName，再拿 team-performance 里 leaderId 匹配到的 teamName，最后拿 team/list 匹配到的 name
        type TeamBag = {
          teamIndex: number;
          teamId: string;            // groups?teamId=（TL Admin._id）
          teamName: string;          // 战队名（kpi?team= 的参数）
          leaderName: string;        // TL 真实姓名
          leaderLevel?: string;      // TL 职级（P2~P8），admin.level 有就用，没有就后面 commission 兜底
          leaderLevelManual?: boolean;
          adminRaw: any;             // 原始 admin（后续 ID Bag 透传用）
          tpMatch?: any;             // team-performance 匹配项（KPI 兜底）
          tlMatch?: any;             // team/list 匹配项（兜底）
        };
        const TEAMS: TeamBag[] = TL_ADMINS
          .map((a, i): TeamBag => {
            const adminId = String(a._id || a.id || a.adminId || '').trim();
            const name = String(a.realName || a.name || a.nickname || a.username || '').trim();
            const aTeam = String(a.teamName || a.team || '').trim();
            const tp = tpByLeaderId.get(adminId) || (aTeam ? tpByTeamName.get(aTeam) : undefined);
            const tl = tlById.get(adminId) || undefined;
            const teamName =
              (tp && String(tp.teamName || tp.name || '').trim()) ||
              aTeam ||
              (tl && String(tl.name || tl.teamName || tl.leader || '').trim()) ||
              name ? `${name}的战队` : `战队${i + 1}`;
            const level = (() => {
              const rawLv =
                a.level || a.currentLevel || a.groupLeaderLevel || a.adminLevel ||
                tp?.level || tp?.teamLeaderLevel || tl?.level;
              return typeof rawLv === 'string' && rawLv.trim() ? rawLv.trim().toUpperCase() : undefined;
            })();
            const levelManual =
              typeof a.levelManual === 'boolean' ? a.levelManual :
              typeof a.isManual === 'boolean' ? a.isManual :
              typeof tp?.levelManual === 'boolean' ? tp.levelManual :
              typeof tp?.isManual === 'boolean' ? tp.isManual : undefined;
            return {
              teamIndex: i + 1,
              teamId: adminId,
              teamName,
              leaderName: name,
              leaderLevel: level,
              leaderLevelManual: levelManual,
              adminRaw: a,
              tpMatch: tp,
              tlMatch: tl,
            };
          })
          .filter(t => t.teamId);
        console.log('[GM-SA] TL 战队主枚举数 =', TEAMS.length, TEAMS.map(t => ({
          i: t.teamIndex, teamId: t.teamId.slice(0, 6), name: t.teamName, leader: t.leaderName, hasTP: !!t.tpMatch
        })));

        setTeams(TEAMS.map(t => ({ id: t.teamId, name: t.teamName })));

        // ===== Step 5. 对每支战队并行拉 groups + kpi?team= =====
        const teamPromises = TEAMS.map(async (team): Promise<Group[]> => {
          const teamId = team.teamId;
          const teamName = team.teamName;
          try {
            // A. groups?teamId=TL Admin._id（每支战队 TL 视角下的子组列表）
            // B. kpi?team=战队名（战队级卡 TL 本人的 KPI）
            const [groupRespA, tlKpiB] = await Promise.all([
              request<any>(`/admin/employee/team-leader/groups?teamId=${encodeURIComponent(teamId)}&range=${rangeParam}`, { method: 'GET' })
                .then(res => Array.isArray(res) ? res : (Array.isArray((res as any)?.data) ? (res as any).data : []))
                .catch(err => { console.warn('[GM-SA] groups fail team=', teamName, err); return []; }),
              request<any>(`/admin/dashboard/kpi?range=${rangeParam}&team=${encodeURIComponent(teamName)}`, { method: 'GET' })
                .catch(() => null),
            ]);
            const arrA: any[] = Array.isArray(groupRespA) ? groupRespA : [];

            // ===== 子组卡映射（与 TL 端完全同款逻辑，kind/角色推导/职级/ID Bag 口径相同）=====
            const subCards: Group[] = arrA.map((g: any) => {
              const _todayRevenue = n(g.todayRevenue, n(g.totalRevenue, 0));
              const _monthlyRevenue = n(g.monthlyRevenue, n(g.totalRevenue, 0));
              const _yesterdayRevenue = n(g.yesterdayRevenue, 0);
              let _growthRate: number;
              if (typeof g.growthRate === 'number' && Number.isFinite(g.growthRate)) {
                _growthRate = g.growthRate;
              } else {
                _growthRate = _yesterdayRevenue > 0
                  ? ((_todayRevenue - _yesterdayRevenue) / _yesterdayRevenue) * 100
                  : _todayRevenue > 0 ? 9999 : 0;
              }
              const rawName = String(g.groupName || g.name || '').trim();
              const rawKind = (typeof g.kind === 'string' && g.kind.trim() ? g.kind.trim() : '')
                || (typeof g.type === 'string' && g.type.trim() ? g.type.trim() : '');
              let _kind: Group['kind'];
              if (rawKind === 'direct_members' || rawName === '直推成员' || rawName.includes('直属') || rawName.includes('未分组')) {
                _kind = 'direct_members';
              } else {
                _kind = 'leader_group';
              }
              return {
                id: g.groupId || g._id || g.id || '',
                name: rawName || '未命名组',
                teamId,
                teamName,
                kind: _kind,
                createdAt: g.createdAt || new Date().toISOString(),
                memberCount: n(g.memberCount, 0),
                todayActive: n(g.todayActive, n(g.memberCount, 0)),
                todayRevenue: _todayRevenue,
                monthlyRevenue: _monthlyRevenue,
                todayAdCount: n(g.todayAdCount, n(g.totalAds, 0)),
                avgEcpm: n(g.avgEcpm, n(g.avgGold, 0)),
                yesterdayRevenue: _yesterdayRevenue,
                commission: n(g.commission, _kind === 'direct_members' ? 0.08 : 0.05),
                // [角色推导] 与 TL 端同款（后端 groupLeaderRole 空时靠 kind+level 识别）
                groupLeaderRole: (() => {
                  const raw = [
                    g.groupLeaderRole, g.role, g.leaderRole, g.adminRole,
                    g.groupRole, g.glRole, g.groupLeaderType, g.leaderType,
                    g.leaderRoleName, g.groupLeaderRoleName, g.glRoleName,
                  ].find((v: any) => typeof v === 'string' && v.trim());
                  if (typeof raw === 'string') return raw.trim();
                  if (_kind === 'direct_members') return UserRole.NORMAL_ADMIN;
                  const tLv = (typeof g.teamLevel === 'string' ? g.teamLevel.trim().toLowerCase() : '');
                  if (tLv === 'sub') return UserRole.NORMAL_ADMIN;
                  if (tLv === 'own') return UserRole.GROUP_LEADER;
                  const lv = ([
                    g.groupLeaderLevel, g.level, g.levelCode, g.glLevel,
                    g.leaderLevel, g.groupLevel, g.currentLevel, g.adminLevel,
                  ].find((v: any) => typeof v === 'string' && v.trim()) || '').trim().toUpperCase();
                  if (lv === 'P1') return UserRole.GROUP_LEADER;
                  if (lv && /^P[2-8]$/.test(lv)) return UserRole.NORMAL_ADMIN;
                  return undefined;
                })(),
                groupLeaderId:
                  (g.groupLeaderId && String(g.groupLeaderId).trim()) ||
                  (g.leaderId && String(g.leaderId).trim()) ||
                  (g.groupLeaderUserId && String(g.groupLeaderUserId).trim()) ||
                  (g.adminUserId && String(g.adminUserId).trim()) ||
                  (g.groupLeaderEmployeeId && String(g.groupLeaderEmployeeId).trim()) ||
                  (g.employeeId && String(g.employeeId).trim()) || '',
                groupLeaderName:
                  (g.groupLeaderName && String(g.groupLeaderName).trim()) ||
                  (g.leaderName && String(g.leaderName).trim()) ||
                  (g.groupLeader && String(g.groupLeader).trim()) || '',
                // [ID Bag 透传]
                _id: (g._id != null ? String(g._id) : null) || (g.objectId != null ? String(g.objectId) : null) || (g.adminId != null ? String(g.adminId) : null) || null,
                objectId: (g.objectId != null ? String(g.objectId) : null) || (g._id != null ? String(g._id) : null) || null,
                adminId: (g.adminId != null ? String(g.adminId) : null) || (g._id != null ? String(g._id) : null) || null,
                userId: (g.userId != null ? String(g.userId) : null) || (g.groupLeaderUserId != null ? String(g.groupLeaderUserId) : null) || (g.adminUserId != null ? String(g.adminUserId) : null) || null,
                groupLeaderUserId: (g.groupLeaderUserId != null ? String(g.groupLeaderUserId) : null) || (g.adminUserId != null ? String(g.adminUserId) : null) || null,
                adminUserId: (g.adminUserId != null ? String(g.adminUserId) : null) || null,
                employeeId: (g.employeeId != null ? String(g.employeeId) : null) || (g.groupLeaderEmployeeId != null ? String(g.groupLeaderEmployeeId) : null) || null,
                groupLeaderEmployeeId: (g.groupLeaderEmployeeId != null ? String(g.groupLeaderEmployeeId) : null) || (g.employeeId != null ? String(g.employeeId) : null) || null,
                groupLeaderLevel: (() => {
                  const raw = [
                    g.groupLeaderLevel, g.level, g.levelCode, g.glLevel,
                    g.leaderLevel, g.groupLevel, g.currentLevel, g.adminLevel,
                  ].find((v: any) => typeof v === 'string' && v.trim());
                  return typeof raw === 'string' ? raw.trim().toUpperCase() : undefined;
                })(),
                groupLeaderLevelManual: (() => {
                  const v = [g.groupLeaderLevelManual, g.isManual, g.manual, g.levelManual, g.glManual]
                    .find((x: any) => typeof x === 'boolean' || x === 'true' || x === 'false' || x === 1 || x === 0);
                  if (v === undefined || v === null) return undefined;
                  return v === true || v === 'true' || v === 1;
                })(),
                growthRate: _growthRate,
              };
            });

            // ===== 战队级卡（TL 本人那张 kind=leader_team）=====
            //   kpi?team=teamName 为主（RED 验证返回的 teamRev/directRev/indirectRev 对得上），
            //   team-performance 为次（有现成 memberCount/totalAds/avgGold/growthRate），
            //   最后 accounts.tlMatch + subCards 加总兜底（保证哪怕 kpi 接口 404，也能用 groups 加总出真实值）
            let tlCard: Group | null = null;
            try {
              const kb = (tlKpiB && typeof tlKpiB === 'object' && ((tlKpiB as any).success !== false))
                ? ((tlKpiB as any).data || tlKpiB)
                : null;
              const tp = team.tpMatch || null;
              const tlMatch = team.tlMatch || null;
              // 子组加总兜底（最终兜底 —— groups 有数据时永远对得上 TL 视角）
              const sgToday = subCards.reduce((a, x) => a + (x.todayRevenue || 0), 0);
              const sgMonth = subCards.reduce((a, x) => a + (x.monthlyRevenue || 0), 0);
              const sgMem = subCards.reduce((a, x) => a + (x.memberCount || 0), 0);
              const sgImp = subCards.reduce((a, x) => a + (x.todayAdCount || 0), 0);
              const sgGrowth = (() => {
                if (tp && typeof tp.growthRate === 'number') return tp.growthRate;
                const y = subCards.reduce((a, x) => a + (x.yesterdayRevenue || 0), 0);
                if (y > 0) return ((sgToday - y) / y) * 100;
                return sgToday > 0 ? 9999 : 0;
              })();

              const tlTodayRev = rangeParam === 'today'
                ? (kb ? n(kb.teamRevenue, n(kb.todayRevenue, sgToday)) : n(tp?.totalRevenue, n(tp?.todayRevenue, sgToday)))
                : (kb ? n(kb.monthRevenue, n(kb.monthlyRevenue, sgMonth)) : n(tp?.monthRevenue, n(tp?.monthlyRevenue, sgMonth)));
              const tlMonthRev = rangeParam === 'today'
                ? (kb ? n(kb.monthRevenue, n(kb.monthlyRevenue, sgMonth)) : n(tp?.monthRevenue, n(tp?.monthlyRevenue, sgMonth)))
                : tlTodayRev;
              const tlMemberCount =
                (kb ? n(kb.directUserCount, 0) + n(kb.indirectUserCount, 0) : 0)
                || n(tp?.memberCount, sgMem) || sgMem;
              const tlImpressions =
                (kb ? n(kb.directImpressions, 0) + n(kb.indirectImpressions, 0) : 0)
                || n(tp?.totalAds, sgImp) || sgImp;
              const tlAvgGold = (() => {
                const avg = tp?.avgGold || tp?.avgEcpm || tp?.ecpm;
                if (typeof avg === 'number' && Number.isFinite(avg) && avg > 0) return avg;
                if (tlImpressions > 0) return (tlTodayRev * 1000) / tlImpressions;
                return 0;
              })();
              const tlGrowth =
                (kb && typeof kb.teamRevenueGrowth === 'number' && Number.isFinite(kb.teamRevenueGrowth)) ? kb.teamRevenueGrowth
                : (kb && typeof kb.directRevenueGrowth === 'number' && Number.isFinite(kb.directRevenueGrowth)) ? kb.directRevenueGrowth
                : typeof tp?.growthRate === 'number' && Number.isFinite(tp.growthRate) ? tp.growthRate
                : sgGrowth;
              const tlCommission =
                kb ? n(kb.teamCommission, 0.08)
                : n(tp?.commission, n(tp?.rate, 0.08)) || 0.08;

              const tlLeaderId =
                team.teamId
                || (kb ? String(kb.leaderId || kb.teamLeaderId || kb.ownerId || kb.adminId || '').trim() : '')
                || (tp ? String(tp.leaderId || tp.teamLeaderId || tp.ownerId || tp.adminId || tp.admin_id || tp.userId || '').trim() : '')
                || '';
              const tlLeaderName =
                team.leaderName
                || (kb ? String(kb.leaderName || kb.teamLeaderName || kb.ownerName || kb.adminName || '').trim() : '')
                || (tp ? String(tp.teamLeaderName || tp.leaderName || tp.ownerName || tp.adminName || tp.captainName || '').trim() : '')
                || '';
              const tlLevelRaw = (() => {
                if (team.leaderLevel) return team.leaderLevel;
                const from = [
                  kb?.level, kb?.teamLeaderLevel, kb?.adminLevel, kb?.currentLevel,
                  tp?.level, tp?.teamLeaderLevel, tp?.adminLevel, tp?.currentLevel, tp?.rank,
                ].find((v: any) => typeof v === 'string' && v.trim());
                return typeof from === 'string' ? from.trim().toUpperCase() : undefined;
              })();
              const tlLevelByComm =
                tlCommission >= 0.16 ? 'P8'
                : tlCommission >= 0.14 ? 'P7'
                : tlCommission >= 0.12 ? 'P6'
                : tlCommission >= 0.10 ? 'P4'
                : tlCommission >= 0.08 ? 'P2'
                : 'P1';
              const tlLevelManual =
                typeof team.leaderLevelManual === 'boolean' ? team.leaderLevelManual
                : (kb && typeof (kb as any).isManual === 'boolean') ? (kb as any).isManual
                : (kb && typeof (kb as any).levelManual === 'boolean') ? (kb as any).levelManual
                : (tp && typeof tp.isManual === 'boolean') ? tp.isManual
                : (tp && typeof tp.levelManual === 'boolean') ? tp.levelManual
                : undefined;

              const a = team.adminRaw || {};
              // 战队 TodayRevenue 与战队 header 用（真实显示给用户看的 —— 与 TL 端自己看到的团队页一致）
              const headerRev = rangeParam === 'today' ? tlTodayRev : tlMonthRev;
              // header 卡（合成 _teamHeader 假卡）—— 放在每支战队最前面
              const headerGroup: Group = {
                id: `__hdr_${team.teamIndex}_${teamId}`,
                name: teamName,
                teamId,
                teamName,
                createdAt: a.createdAt || new Date().toISOString(),
                _teamHeader: {
                  teamIndex: team.teamIndex,
                  teamName,
                  teamLeaderName: tlLeaderName,
                  teamLeaderLevel: (tlLevelRaw || tlLevelByComm).toUpperCase(),
                  teamLeaderLevelManual: tlLevelManual,
                  teamTodayRevenue: headerRev,
                  teamMemberCount: tlMemberCount,
                },
              };

              // TL 本人战队级卡（kind=leader_team）
              tlCard = {
                id: `team-${teamId}`,
                name: teamName || '未命名战队',
                teamId,
                teamName: teamName || '',
                kind: 'leader_team',
                createdAt: a.createdAt || tp?.createdAt || tlMatch?.createdAt || new Date().toISOString(),
                memberCount: tlMemberCount,
                todayActive:
                  (kb ? n(kb.directActiveUsers, 0) + n(kb.indirectActiveUsers, 0) : 0)
                  || n(tp?.todayActive, n(tp?.activeCount, tlMemberCount))
                  || tlMemberCount,
                todayRevenue: tlTodayRev,
                monthlyRevenue: tlMonthRev,
                todayAdCount: tlImpressions,
                avgEcpm: tlAvgGold,
                yesterdayRevenue: n(tp?.yesterdayRevenue, 0),
                commission: tlCommission,
                groupLeaderRole: UserRole.NORMAL_ADMIN, // 战队卡 = TL（NORMAL_ADMIN），业绩按钮分发到 TeamLeaderPerformance
                groupLeaderId: tlLeaderId || teamId,
                groupLeaderName: tlLeaderName || teamName,
                // [ID Bag 透传] —— 战队级卡（TL 本人）透传所有候选 ID，view-as-other 多参数命中
                _id:
                  (a && String(a._id || a.objectId || a.adminId || '').trim())
                  || (kb && String(kb._id || kb.objectId || kb.adminId || '').trim())
                  || (tp && String(tp._id || tp.objectId || tp.adminId || tp.admin_id || '').trim())
                  || null,
                objectId:
                  (a && String(a.objectId || a._id || '').trim())
                  || (kb && String(kb.objectId || kb._id || '').trim())
                  || (tp && String(tp.objectId || tp._id || '').trim())
                  || null,
                adminId:
                  (a && String(a.adminId || a._id || '').trim())
                  || (kb && String(kb.adminId || kb._id || '').trim())
                  || (tp && String(tp.adminId || tp.admin_id || tp._id || '').trim())
                  || null,
                userId:
                  (a && String(a.userId || a.adminUserId || a.employeeId || '').trim())
                  || (kb && String(kb.userId || kb.teamLeaderUserId || kb.adminUserId || kb.leaderUserId || '').trim())
                  || (tp && String(tp.userId || tp.teamLeaderUserId || tp.adminUserId || tp.leaderUserId || '').trim())
                  || null,
                groupLeaderUserId:
                  (a && String(a.adminUserId || a.userId || '').trim())
                  || (kb && String(kb.teamLeaderUserId || kb.adminUserId || '').trim())
                  || (tp && String(tp.teamLeaderUserId || tp.adminUserId || '').trim())
                  || null,
                adminUserId:
                  (a && String(a.adminUserId || a.userId || '').trim())
                  || (kb && String(kb.adminUserId || '').trim())
                  || (tp && String(tp.adminUserId || '').trim())
                  || null,
                employeeId:
                  (a && String(a.employeeId || a.adminEmployeeId || '').trim())
                  || (kb && String(kb.employeeId || kb.teamLeaderEmployeeId || '').trim())
                  || (tp && String(tp.employeeId || tp.teamLeaderEmployeeId || '').trim())
                  || null,
                groupLeaderEmployeeId:
                  (a && String(a.employeeId || '').trim())
                  || (kb && String(kb.teamLeaderEmployeeId || kb.employeeId || '').trim())
                  || (tp && String(tp.teamLeaderEmployeeId || tp.employeeId || '').trim())
                  || null,
                groupLeaderLevel: (tlLevelRaw || tlLevelByComm).toUpperCase(),
                groupLeaderLevelManual: tlLevelManual,
                growthRate: tlGrowth,
              };
              return [headerGroup, tlCard, ...subCards];
            } catch (err2) {
              console.warn('[GM-SA] build TL card fail team=', teamName, err2);
              // 至少输出 header + 子组，保证战队聚合可见（不丢战队）
              const headerRev = rangeParam === 'today'
                ? subCards.reduce((a, x) => a + (x.todayRevenue || 0), 0)
                : subCards.reduce((a, x) => a + (x.monthlyRevenue || 0), 0);
              const headerMem = subCards.reduce((a, x) => a + (x.memberCount || 0), 0);
              const headerGroup: Group = {
                id: `__hdr_${team.teamIndex}_${teamId}`,
                name: teamName, teamId, teamName,
                createdAt: new Date().toISOString(),
                _teamHeader: {
                  teamIndex: team.teamIndex,
                  teamName, teamLeaderName: team.leaderName,
                  teamLeaderLevel: team.leaderLevel || 'P2',
                  teamLeaderLevelManual: team.leaderLevelManual,
                  teamTodayRevenue: headerRev, teamMemberCount: headerMem,
                },
              };
              return [headerGroup, ...subCards];
            }
          } catch (err) {
            console.error(`[GM-SA] process team ${teamName} fail:`, err);
            return [];
          }
        });

        // ===== 最终扁平（用桶排序+header 合成卡保证战队聚合不被打散）=====
        const allGroupArrays = await Promise.all(teamPromises);
        groupsResponse = allGroupArrays.flat();
        console.log('[GM-SA] final groupsResponse count=', groupsResponse.length,
          '  headers=', groupsResponse.filter(g => g._teamHeader).length,
          '  leader_team=', groupsResponse.filter(g => g.kind === 'leader_team').length,
          '  subCards=', groupsResponse.filter(g => !g._teamHeader && g.kind !== 'leader_team').length);
        } // ← 关闭 fallback if：if (!__USE_NEW__ || __NEW_FAILED__)
      }
      
      setGroups(groupsResponse);

      // 写顶部总卡 KPI：优先用和首页相同的 KPI 接口值，保证口径对齐
      if (kpi && typeof kpi === 'object') {
        const nk = (x: any, fb = 0) => {
          const v = Number(x);
          return Number.isFinite(v) ? v : fb;
        };
        const first = (keys: string[], fb = 0): number => {
          for (const k of keys) {
            const v = Number((kpi as any)[k]);
            if (Number.isFinite(v)) return v;
          }
          return fb;
        };
        const todayRevenue = first(['todayRevenue', 'totalPerformance', 'teamRevenue', 'revenue']);
        const monthRevenue = first(['monthRevenue', 'monthlyRevenue', 'totalPerformance', 'teamRevenue']);
        const teamCommission = first(['teamCommission', 'totalCommission']);
        setKpiSummary({
          todayRevenue: todayRevenue || undefined,
          monthRevenue: monthRevenue || undefined,
          teamCommission: teamCommission || undefined,
        });
      } else if (groupsResponse.length > 0) {
        // KPI 接口失败的兜底：退回到加总（会和首页口径不一致，所以 Console 报警）
        const todayS = groupsResponse.reduce((s, g) => s + (g.todayRevenue || 0), 0);
        const monthS = groupsResponse.reduce((s, g) => s + (g.monthlyRevenue || 0), 0);
        console.warn('[GM-topKpi] KPI 接口未返回，退回到前端加总（可能和首页口径不一致）');
        setKpiSummary({ todayRevenue: todayS, monthRevenue: monthS });
      } else {
        setKpiSummary(null);
      }
      // [排障日志] 每个组的组长字段映射结果：按钮没显示时，Console 搜 "GM-btn-debug" 立即定位
      // 扩展：把 groupLeaderRole / commission / idBag 也打出来，因为"业绩点进去全 0"核心是角色分发 + ID 匹配
      const countsN = groupsResponse.reduce((acc: { ok?: number; total?: number }, g: Group) => ({
        ok: (acc.ok || 0) + (!!(g.groupLeaderId && g.groupLeaderName) ? 1 : 0),
        total: (acc.total || 0) + 1,
      }), {});
      const norm = (s: any) => typeof s === 'string' ? s.trim().toUpperCase().replace(/_/g, '') : '';
      const glNorm = 'GROUPLEADER';
      const tlNorm = 'NORMALADMIN';
      const superNorm = 'SUPERADMIN';
      const previewDispatch = (g: Group): string => {
        const roleNorm = norm(g.groupLeaderRole);
        if (roleNorm === glNorm || roleNorm === 'GL') return '→ GL页 (GroupLeaderPerformance)';
        const isSuper = roleNorm === superNorm || roleNorm === 'SUPERADMINISTRATOR';
        if (roleNorm === tlNorm || roleNorm === 'TEAMLEADER' || roleNorm === 'TL' || isSuper) return '→ TL页 (TeamLeaderPerformance)';
        if (typeof g.commission === 'number' && g.commission >= 0.08) return '⚠️ → TL页 (兜底commission ≥ 0.08)';
        return '→ GL页 (兜底commission < 0.08 / 空)';
      };
      console.log(
        `%c[GM-btn-debug] 已加载 ${groupsResponse.length} 组；能显示业绩按钮的有 ${countsN.ok || 0}/${countsN.total || 0} 个。详情：`,
        'color:#1d4ed8;font-weight:bold',
        groupsResponse.map((g: Group) => ({
          id: g.id, name: g.name, kind: g.kind ?? 'default',
          groupLeaderId: g.groupLeaderId ?? '<空>',
          groupLeaderName: g.groupLeaderName ?? '<空>',
          groupLeaderRole_raw: g.groupLeaderRole ?? '<空>',
          groupLeaderRole_norm: norm(g.groupLeaderRole) || '<空>',
          commission: g.commission ?? null,
          btnVisible: shouldShowViewGroupLeaderButton(currentUser?.role, g),
          predictedPage: previewDispatch(g),
          // idBag 概览（每个 ID 是否有值）
          ids: {
            objectId: g._id || g.objectId || g.adminId || null,
            userId: g.userId || g.groupLeaderUserId || g.adminUserId || null,
            employeeId: g.employeeId || g.groupLeaderEmployeeId || null,
            groupId: g.id || null,
          },
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      setCurrentUser({
        id: 'A001',
        username: '测试团队长',
        role: UserRole.NORMAL_ADMIN,
        status: 'enabled',
        teamName: '鼎盛战队'
      });
      setTeams([
        { id: 'T001', name: '鼎盛战队' },
        { id: 'T002', name: '精英战队' },
      ]);
      setGroups([
        { id: 'G001', name: '一组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-01', memberCount: 2, todayActive: 1, todayRevenue: 56.42, monthlyRevenue: 711.71, todayAdCount: 467, avgEcpm: 296.73, yesterdayRevenue: 331.45, commission: 0.05, groupLeaderId: 'GL001', groupLeaderName: '测试组长1' },
        { id: 'G002', name: '二组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-02', memberCount: 11, todayActive: 8, todayRevenue: 25.46, monthlyRevenue: 936.98, todayAdCount: 261, avgEcpm: 239.94, yesterdayRevenue: 456.78, commission: 0.05, groupLeaderId: 'GL002', groupLeaderName: '测试组长2' },
        { id: 'G003', name: '三组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-03', memberCount: 5, todayActive: 3, todayRevenue: 18.25, monthlyRevenue: 456.32, todayAdCount: 156, avgEcpm: 198.45, yesterdayRevenue: 22.36, commission: 0.05, groupLeaderId: 'GL003', groupLeaderName: '测试组长3' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // 预加载所有组的成员数据
  const preloadAllGroups = useCallback(async (groupsToPreload: Group[]) => {
    if (groupsToPreload.length === 0) return;
    
    console.log('Starting preloading for', groupsToPreload.length, 'groups');
    
    // 只拉 2 次团队全量（today + month），所有组共享，而不是每个组拉一次
    for (const timeRange of ['today', 'month'] as const) {
      try {
        const teamUsers = await fetchTeamUsers(timeRange);
        console.log(`[Preload] teamUsers for ${timeRange}:`, teamUsers.length);
        
        const membersPatch: { [groupId: string]: GroupMember[] } = {};
        for (const group of groupsToPreload) {
          if (membersCache[group.id]?.[timeRange]) continue;
          const groupMembers = filterMembersForGroup(teamUsers, group);
          membersPatch[group.id] = groupMembers.map((user: any): GroupMember => ({
            id: user.employeeId || user.id || user.userId || '',
            name: user.realName || user.realname || user.name || user.username || user.userName || user.userId || user.employeeId || '',
            avatar: user.avatar || '',
            todayWatched: user.watched || 0,
            todayEarnings: (user.earnings || 0) / 1000,
            status: (user.watched || 0) > 0 ? '在线' : '离线'
          }));
          console.log(`Preloaded ${timeRange} data for group:`, group.name, 'count:', membersPatch[group.id].length);
        }

        if (Object.keys(membersPatch).length > 0) {
          setMembersCache(prev => {
            const next = { ...prev };
            for (const [gid, list] of Object.entries(membersPatch)) {
              next[gid] = { ...(next[gid] || {}), [timeRange]: list };
            }
            return next;
          });
        }
      } catch (error) {
        console.error(`Error preloading ${timeRange} team users:`, error);
      }
      // 稍微延迟一下，避免 today 和 month 并发
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('Preloading completed!');
  }, [membersCache, setMembersCache, fetchTeamUsers, filterMembersForGroup]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData, refreshTrigger]);

  // 组列表加载完成后，延迟预加载成员数据
  useEffect(() => {
    if (groups.length > 0 && !loading) {
      // 延迟2秒开始预加载，给用户先看页面
      const timer = setTimeout(() => {
        preloadAllGroups(groups);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [groups, loading, preloadAllGroups]);

  // 过滤和排序后的组列表（含 _teamHeader 假卡 = 战队分组标题）
  const filteredGroups = useMemo(() => {
    // ===== 先按稳定 key 去重（超管双通道合并易产生重复）=====
    const seen = new Set<string>();
    const deduped: Group[] = [];
    for (const g of groups) {
      const k = g._teamHeader
        ? `__HDR__${g._teamHeader.teamIndex}__${g._teamHeader.teamName}`
        : `${String(g.id || '').trim()}__${String(g.teamId || '').trim()}__${String(g.name || '').trim()}__${String(g.groupLeaderId || '').trim()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(g);
    }
    // ===== 搜索过滤 =====
    const term = (searchTerm || '').trim().toLowerCase();
    const filtered = deduped.filter(group => {
      if (group._teamHeader) {
        const h = group._teamHeader;
        if (!term) return true;
        return (
          (h.teamName || '').toLowerCase().includes(term) ||
          (h.teamLeaderName || '').toLowerCase().includes(term)
        );
      }
      return (
        (group.name || '').toLowerCase().includes(term) ||
        (group.id || '').toLowerCase().includes(term) ||
        (group.teamName || '').toLowerCase().includes(term) ||
        (group.groupLeaderName || '').toLowerCase().includes(term)
      );
    });
    // ===== 排序规则（保证战队聚合不被打散）=====
    // 1) 先从 _teamHeader 建 teamId→teamIndex 反向索引（SA 才有 header，TL/GL 分支空数组）
    //    这样同战队所有卡（header + leader_team + subCards）能对齐到同一个桶；战队间按 teamIndex 顺序
    // 2) 桶内顺序：_teamHeader（第一） → leader_team（战队卡，第二） → 其它子组（按 range 业绩倒序）
    const teamIndexByTeamId = new Map<string, number>();
    const teamIndexByTeamName = new Map<string, number>();
    let maxTeamIndex = 0;
    for (const g of deduped) {
      if (g._teamHeader) {
        const idx = Number(g._teamHeader.teamIndex) || 0;
        if (idx > maxTeamIndex) maxTeamIndex = idx;
        // header 构造时显式填了 teamId（Group.teamId = TL Admin._id）和 teamName
        const tid = String(g.teamId || '').trim();
        const tn = String(g.teamName || g._teamHeader.teamName || '').trim();
        if (tid) teamIndexByTeamId.set(tid, idx);
        if (tn) teamIndexByTeamName.set(tn, idx);
      }
    }
    return filtered.sort((a, b) => {
      // ===== [新接口 direct_members 扁平卡 → 统一按业绩从高到低排序，不分角色] =====
      if (a.kind === 'direct_members' && b.kind === 'direct_members') {
        const ra = sortBy === 'today' ? Number(a.todayRevenue || 0) : Number(a.monthlyRevenue || 0);
        const rb = sortBy === 'today' ? Number(b.todayRevenue || 0) : Number(b.monthlyRevenue || 0);
        if (rb !== ra) return rb - ra;
        return Number(b.memberCount || 0) - Number(a.memberCount || 0);
      }
      // 统一 bucket key：T{0padded teamIndex}_{teamId}
      //   任何一卡都必须用同一个 teamId→teamIndex 解析，才能跟它的 header 聚到一起
      const bucketOf = (g: Group): string => {
        let idx = 0;
        let teamId = '';
        let teamName = '';
        if (g._teamHeader) {
          idx = Number(g._teamHeader.teamIndex) || 0;
          teamId = String(g.teamId || '').trim();
          teamName = String(g.teamName || g._teamHeader.teamName || '').trim();
        } else {
          teamId = String(g.teamId || '').trim();
          teamName = String(g.teamName || '').trim();
          idx = (teamId && teamIndexByTeamId.get(teamId)) || 0;
          if (!idx && teamName) idx = teamIndexByTeamName.get(teamName) || 0;
          // TL/GL 分支无 header（反向索引空）→ idx 全 =0 → 桶相同 → 用后面的 rank+rev 排序（保持原行为）
          // SA 分支但找不到索引（极端情况）→ 放最后，避免打散前面正常战队
          if (!idx) { idx = (teamId || teamName) ? (maxTeamIndex + 999) : 999999; }
        }
        return `T${String(idx).padStart(6, '0')}_${teamId || teamName}`;
      };
      const ba = bucketOf(a);
      const bb = bucketOf(b);
      // 如果是 TL/GL 分支（无 HDR，反向索引为空 → idx 全 0 → ba===bb），
      // 会直接落到 rank+业绩倒序 → 与原历史行为完全一致
      if (ba !== bb) return ba < bb ? -1 : 1;
      // 桶内顺序 rank
      const rank = (g: Group): number => {
        if (g._teamHeader) return 0;
        if (g.kind === 'leader_team') return 1;
        return 2;
      };
      const ra = rank(a); const rb = rank(b);
      if (ra !== rb) return ra - rb;
      // 同级：业绩倒序（跟原来一致）
      const rev = (g: Group): number => sortBy === 'today' ? (g.todayRevenue || 0) : (g.monthlyRevenue || 0);
      return rev(b) - rev(a);
    });
  }, [groups, searchTerm, sortBy]);

  // 计算总成员数
  const totalMemberCount = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + (group.memberCount || 0), 0);
  }, [filteredGroups]);

  if (selectedGroup) {
    return (
      <GroupMemberDetail 
        group={selectedGroup} 
        timeRange={sortBy}
        membersCache={membersCache}
        setMembersCache={setMembersCache}
        onBack={() => setSelectedGroup(null)}
        fetchTeamUsers={fetchTeamUsers}
        filterMembersForGroup={filterMembersForGroup}
      />
    );
  }

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Users2 className="text-[#1E40AF] mr-2" size={24} />
            团队管理
          </h1>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="p-2 text-gray-500 hover:text-[#1E40AF] hover:bg-gray-100 rounded-xl transition-colors"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
          </button>
        </div>

        <div className="relative mb-4 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
                <input 
                    type="text"
                    placeholder="输入组名称或团队名称筛选..."
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">总组数</div>
                    <div className="text-2xl font-black">{filteredGroups.length} <span className="text-xs font-normal opacity-70">个</span></div>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-100">
                    <div className="text-[10px] opacity-80 font-bold mb-1 uppercase tracking-wider">{sortBy === 'today' ? '今日团队总业绩' : '本月团队总业绩'}</div>
                    <div className="text-2xl font-black">
                      ¥{
                        (sortBy === 'today'
                          ? (kpiSummary?.todayRevenue ?? 0)
                          : (kpiSummary?.monthRevenue ?? 0)
                        ).toFixed(2)
                      } <span className="text-xs font-normal opacity-70">元</span>
                    </div>
                </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                    onClick={() => setSortBy('today')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'today' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按今日团队总业绩
                </button>
                <button 
                    onClick={() => setSortBy('month')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortBy === 'month' ? 'bg-white text-[#1E40AF] shadow-sm' : 'text-gray-500'}`}
                >
                    按本月团队总业绩
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
            ) : filteredGroups.length > 0 ? (
              filteredGroups.map((group, index) => {
                // ===== [超管专属] 战队分组标题栏（每支战队前插一张"合成 header 卡"） =====
                // 只有超管聚合时 SA 分支才会在 groupsResponse 里塞这种假卡；TL/GL 分支永远不会出现 _teamHeader 字段，完全无影响
                if (group._teamHeader) {
                  const h = group._teamHeader;
                  return (
                    <div
                      key={`hdr-${h.teamIndex}-${h.teamName}`}
                      className="relative flex items-center justify-between rounded-2xl px-3 py-2 mt-2 mb-1 bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 border border-indigo-100 shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#1E40AF] text-white text-[11px] font-black leading-none shadow-sm">
                          {h.teamIndex}
                        </span>
                        <div className="min-w-0 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-black text-[#1E293B] truncate max-w-[45vw]">
                            {h.teamName || '未命名战队'}
                          </span>
                          {h.teamLeaderName && (
                            <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[30vw]">
                              · 队长：{h.teamLeaderName}
                            </span>
                          )}
                          <GroupLeaderLevelBadge
                            level={h.teamLeaderLevel}
                            isManual={h.teamLeaderLevelManual}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <div className="text-[11px] font-bold text-emerald-700 leading-tight">
                          ¥{Number(h.teamTodayRevenue || 0).toFixed(2)}
                        </div>
                        <div className="text-[9px] text-slate-500 font-semibold leading-tight mt-0.5">
                          {h.teamMemberCount || 0}人
                        </div>
                      </div>
                    </div>
                  );
                }
                const gk = String(group.id || `${group.teamId}-${group.name}` || `g-${index}`).trim();
                return (
            <div key={`${gk}-${index}`} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-4 space-y-4 transition-colors mb-4">
              <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-300 text-gray-800' :
                          index === 2 ? 'bg-orange-600 text-white' : 'bg-green-400 text-white'
                      }`}>
                          {index < 3 ? (
                              <span className="text-xl font-black">{index + 1}</span>
                          ) : (
                              <Award size={24} />
                          )}
                      </div>
                      <div>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                            <div className="text-sm font-bold text-gray-900">{group.name}</div>
                            {(() => {
                              // 按钮可见性 / disabled 拆分：show 永远显示（只要 role 对），disabled 只拦 "回调没传"（副页栈没连）
                              const { show, disabled } = debugDecideViewGroupLeaderButton(
                                currentUser?.role,
                                group,
                                typeof onViewGroupLeaderPerformance === 'function',
                              );
                              // 精确定位日志：Console 搜「GM-btn-per-card」即可看到每个组的判断位
                              // eslint-disable-next-line no-console
                              console.debug('[GM-btn-per-card]', group.name, {
                                currentUserRole: currentUser?.role ?? '<空>',
                                groupId: group.id,
                                groupName: group.name,
                                hasLeaderId: Boolean((group.groupLeaderId || '').trim()),
                                hasLeaderName: Boolean((group.groupLeaderName || '').trim()),
                                callbackExists: typeof onViewGroupLeaderPerformance === 'function',
                                resolved_show: show,
                                resolved_disabled: disabled,
                              });
                              if (!show) return null;
                              return (
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={(e) => {
                                e.stopPropagation();
                                if (disabled) return;
                                const t = normalizeViewGroupLeaderTarget(group);
                                if (!t) return;
                                const cbExists = typeof onViewGroupLeaderPerformance === 'function';
                                let route: 'callback' | 'event' | 'noop' = 'noop';
                                if (cbExists) {
                                  onViewGroupLeaderPerformance(t);
                                  route = 'callback';
                                } else {
                                  const dispatched = dispatchViewGroupLeaderPerformanceEvent(t);
                                  route = dispatched ? 'event' : 'noop';
                                }
                                // eslint-disable-next-line no-console
                                console.debug('[GM-btn-click]', group.name, { target: t, route, callbackExists: cbExists });
                              }}
                                  className={[
                                    'inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition active:scale-[0.97]',
                                    disabled
                                      ? 'bg-gray-100 text-gray-400 ring-1 ring-gray-200 cursor-not-allowed'
                                      : 'bg-blue-50 ring-1 ring-blue-100 text-blue-700 hover:bg-blue-100 hover:text-blue-800',
                                  ].join(' ')}
                                  title={disabled ? '功能入口（副页栈未连接时灰化占位）' : '查看该组组长业绩看板（若 prop 不存在会走全局事件跳转）'}
                                >
                                  <BarChart3 size={12} />
                                  <span>业绩</span>
                                  <ChevronRight size={12} className="-ml-1" />
                                </button>
                              );
                            })()}
                          </div>
                          {/* 组长名行：有真实组长信息就显示；没有（后端未上线过渡期）用灰色占位提示，避免用户困惑 */}
                          <div className="mt-0.5 text-[11px] font-medium">
                            {group.groupLeaderName && group.groupLeaderId ? (
                              <>
                                <span className="text-gray-400">组长：</span>
                                <span className="text-gray-500 font-semibold align-middle">{group.groupLeaderName}</span>
                                <GroupLeaderLevelBadge
                                  level={group.groupLeaderLevel}
                                  isManual={group.groupLeaderLevelManual}
                                />
                              </>
                            ) : (
                              <span className="text-gray-300">组长信息待同步</span>
                            )}
                          </div>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className={`text-sm font-bold ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{(sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue)?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-400 font-medium">
                        {sortBy === 'today' ? '今日小组总业绩' : '本月小组总业绩'}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">成员总数</div>
                      <div className="text-sm font-bold text-gray-900">{group.memberCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">广告总次数</div>
                      <div className={`text-sm font-bold ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>{group.todayAdCount || 0}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs text-gray-400 font-medium mb-1">平均金币</div>
                      <div className={`text-sm font-bold ${(((sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue) || 0) * 1000) / (group.todayAdCount || 1) >= 100 ? 'text-green-600' : 'text-red-500'}`}>{((((sortBy === 'today' ? group.todayRevenue : group.monthlyRevenue) || 0) * 1000) / (group.todayAdCount || 1)).toFixed(2)}</div>
                  </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-1">
                      {group.growthRate >= 0 ? (
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                          <ChevronUp size={12} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                          <ChevronDown size={12} className="text-red-500" />
                        </div>
                      )}
                      <div className={`text-xs font-medium ${group.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        较{sortBy === 'today' ? '昨日' : '上月'}业绩{group.growthRate >= 0 ? `增长 ` : `下降 `}{Math.abs(group.growthRate).toFixed(2)}%
                      </div>
                  </div>
                  <button
                    className="text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors flex items-center space-x-1"
                    onClick={() => {
                      setSelectedGroup(group);
                    }}
                  >
                    查看{sortBy === 'today' ? '今日' : '本月'}成员详情 <ChevronRight size={14} />
                  </button>
              </div>
            </div>
            ); })
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm font-bold">暂无组数据</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default GroupManagement;