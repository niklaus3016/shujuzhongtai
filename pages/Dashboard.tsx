
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TimeRange, KPIStats, User, UserRole, AdminUser } from '../types';
import { 
  TrendingUp, TrendingDown, Eye, MousePointer2, Coins, 
  Wallet, BarChart3, Percent, ChevronRight, Globe, Smartphone, Zap, Users,
  Trophy, Medal, Crown, RefreshCw, Search, Gift, UserPlus,
} from 'lucide-react';
import { request } from '../services/api';
import { authService } from '../services/authService';
import { cacheManager } from '../services/cacheManager';
import { transformUsers } from '../utils/transformUser';
import TeamLeaderDashboard from '../components/TeamLeaderDashboard';
import GroupLeader from './GroupLeader';

interface DashboardUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  trend: 'up' | 'down' | 'stable';
  superior?: string;
  teamName?: string;
  teamGroupId?: string;
  groupName?: string;
  regDays: number;
  /** 上级账号（username，稳定推荐人，优先取） */
  supervisorUsername?: string;
  /** 上级真实姓名（兜底显示在括号里） */
  supervisorRealName?: string;
  /** 兼容字段：上级账号名 */
  supervisorName?: string;
  /** 是否当前查看者的直推用户。TL/GL 视角返回；超管视角不返回该字段 → badge 自动隐藏 */
  isDirect?: boolean;
  /**
   * 来源细分，hover 作为 tooltip 展示：
   * - directD: TL 的直属D（直推）
   * - subGroupG: TL 下属组长的组内G（间推）
   * - subTlDirectD: TL 下属TL的直属D（间推）
   * - glGroupG: 组长组内的G（组长视角全员直推）
   */
  sourceKind?: 'directD' | 'subGroupG' | 'subTlDirectD' | 'glGroupG' | string;
}

interface NewUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  regDays: number;
  superior?: string;
  isOnline?: boolean;
  groupName?: string;
  groupLeaderName?: string;
  lastActiveTime?: string;
  loginDays?: number;
}

/** sourceKind 细分枚举 → 中文 tooltip（hover 展示） */
const SOURCE_KIND_TOOLTIP: Record<string, string> = {
  directD: '直推 · 自己的直属员工',
  subGroupG: '间推 · 下属组长的组内员工',
  subTlDirectD: '间推 · 下属团队长的直属员工',
  glGroupG: '本组员工 · 组长全员直推',
};
const sourceKindTooltip = (u: DashboardUser): string => {
  if (u.sourceKind && SOURCE_KIND_TOOLTIP[u.sourceKind]) return SOURCE_KIND_TOOLTIP[u.sourceKind];
  if (u.sourceKind) return u.sourceKind;
  return u.isDirect ? '直推用户' : '间推用户';
};

interface DashboardProps {
  onSelectUser?: (user: any) => void;
  onViewAllUsers?: () => void;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  currentUser?: AdminUser | null;
}

const mockDashboardUsers: DashboardUser[] = [
  { id: '8901', userId: 'user001', name: '王*亮', avatar: 'https://picsum.photos/seed/u1/100/100', watched: 1240, earnings: 186.5, ipCount: 1, deviceCount: 1, ecpm: 150.4, trend: 'up', superior: '张管理', regDays: 45 },
  { id: '8902', userId: 'user002', name: '李*华', avatar: 'https://picsum.photos/seed/u2/100/100', watched: 980, earnings: 245.2, ipCount: 2, deviceCount: 1, ecpm: 250.2, trend: 'up', superior: '李管理', regDays: 32 },
  { id: '8903', userId: 'user003', name: '张*强', avatar: 'https://picsum.photos/seed/u3/100/100', watched: 1100, earnings: 165.0, ipCount: 1, deviceCount: 2, ecpm: 85.0, trend: 'down', superior: '王主管', regDays: 12 },
  { id: '8904', userId: 'user004', name: '赵*敏', avatar: 'https://picsum.photos/seed/u4/100/100', watched: 850, earnings: 210.8, ipCount: 1, deviceCount: 1, ecpm: 248.0, trend: 'stable', superior: '张管理', regDays: 5 },
  { id: '8905', userId: 'user005', name: '陈*平', avatar: 'https://picsum.photos/seed/u5/100/100', watched: 1320, earnings: 198.0, ipCount: 3, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '李管理', regDays: 60 },
  { id: '8906', userId: 'user006', name: '刘*洋', avatar: 'https://picsum.photos/seed/u6/100/100', watched: 750, earnings: 112.5, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '系统直属', regDays: 3 },
  { id: '8907', userId: 'user007', name: '孙*超', avatar: 'https://picsum.photos/seed/u7/100/100', watched: 1420, earnings: 213.0, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '王主管', regDays: 120 },
  { id: '8908', userId: 'user008', name: '周*杰', avatar: 'https://picsum.photos/seed/u8/100/100', watched: 640, earnings: 96.0, ipCount: 4, deviceCount: 2, ecpm: 75.0, trend: 'down', superior: '张管理', regDays: 8 },
  { id: '8909', userId: 'user009', name: '吴*凡', avatar: 'https://picsum.photos/seed/u9/100/100', watched: 1050, earnings: 157.5, ipCount: 1, deviceCount: 1, ecpm: 150.0, trend: 'stable', superior: '系统直属', regDays: 200 },
  { id: '8910', userId: 'user010', name: '郑*爽', avatar: 'https://picsum.photos/seed/u10/100/100', watched: 1180, earnings: 177.0, ipCount: 2, deviceCount: 1, ecpm: 150.0, trend: 'up', superior: '李管理', regDays: 2 },
];

const Dashboard: React.FC<DashboardProps> = ({ onSelectUser, onViewAllUsers, timeRange: propTimeRange, onTimeRangeChange, currentUser: propCurrentUser }) => {
  // 使用传入的currentUser或内部状态
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(propCurrentUser || null);
  
  // 状态变量定义
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'watched' | 'earnings' | 'agc'>('earnings');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'direct' | 'indirect'>('all');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [userData, setUserData] = useState<DashboardUser[]>([]);
  
  // 使用传入的timeRange或默认值
  const timeRange = useMemo(() => {
    if (propTimeRange) {
      // 将字符串转换为TimeRange类型
      switch (propTimeRange) {
        case 'today': return TimeRange.TODAY;
        case 'yesterday': return TimeRange.YESTERDAY;
        case 'week': return TimeRange.THIS_WEEK;
        case 'month': return TimeRange.THIS_MONTH;
        default: return TimeRange.TODAY;
      }
    }
    return TimeRange.TODAY;
  }, [propTimeRange]);
  
  // 添加滚动位置保存
  const scrollPositionRef = React.useRef<number>(0);
  
  // 当propCurrentUser变化时，更新内部状态
  useEffect(() => {
    if (propCurrentUser) {
      setCurrentUser(propCurrentUser);
    }
  }, [propCurrentUser]);
  
  // 恢复滚动位置
  useEffect(() => {
    // 恢复滚动位置
    const savedPosition = sessionStorage.getItem('dashboard_scroll_position');
    if (savedPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedPosition, 10));
        // 清除保存的位置
        sessionStorage.removeItem('dashboard_scroll_position');
      }, 100);
    }
  }, []);

  // 当timeRange变化时，重新加载数据
  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [timeRange, currentUser]);
  
  const isTeamLeader = currentUser?.role === UserRole.NORMAL_ADMIN;
  const isGroupLeader = currentUser?.role === UserRole.GROUP_LEADER;
  const roleStr = String(currentUser?.role);
  const isSuperAdmin = roleStr === 'superadmin' || roleStr === 'SUPER_ADMIN' || roleStr === 'ADMIN_MANAGER';
  // 只要不是团队长，就显示数据看板（包括超级管理员、高管和组长）
  const showKPIDashboard = !isTeamLeader;
  
  // 团队名称映射表
  const teamNameMap: Record<string, string> = {
    'cuiding': '鼎盛战队',
    'cuijie': '花好月圆战队',
    'huangzhenhui': '四季发财战队'
    // 可以根据需要添加更多映射
  };
  
  // 获取用户对应的团队名称
  const getUserTeamName = () => {
    if (currentUser?.teamName) {
      return currentUser.teamName;
    }
    if (currentUser?.username && teamNameMap[currentUser.username]) {
      return teamNameMap[currentUser.username];
    }
    // 对于团队长，默认返回其username作为团队名称
    if (isTeamLeader && currentUser?.username) {
      return currentUser.username;
    }
    return '团队';
  };
  
  // 获取缓存数据
  const getCachedData = (key: string) => {
    // 为不同时间范围设置不同的缓存时间
    const cacheTime = key.includes('today') ? 300000 : 600000; // 今日数据5分钟，其他10分钟
    return cacheManager.get(key, cacheTime);
  };
  
  // 设置缓存数据
  const setCachedData = (key: string, data: any, cacheTime?: number) => {
    console.log('[Dashboard] 设置缓存，键:', key, '数据:', data ? `存在(${data.users?.length || data.teams?.length || 'unknown'}条)` : '空', '缓存时间:', cacheTime ? `${cacheTime}ms` : '默认');
    cacheManager.set(key, data, cacheTime);
  };

  // Time range mapping
  const timeRangeMap: Record<string, string> = {
    [TimeRange.TODAY]: 'today',
    [TimeRange.YESTERDAY]: 'yesterday',
    [TimeRange.THIS_WEEK]: 'week',
    [TimeRange.THIS_MONTH]: 'month'
  };

  const timePrefixMap: Record<string, string> = {
    [TimeRange.TODAY]: '今日',
    [TimeRange.YESTERDAY]: '昨日',
    [TimeRange.THIS_WEEK]: '本周',
    [TimeRange.THIS_MONTH]: '本月'
  };

  // ===== 新 KPI 接口字段转换辅助（v2 新接口 17 字段，替代旧 coins/revenue/impressions） =====
  type DashKpi = {
    title: string; value: string; growth?: string; isUp?: boolean; subValue?: string;
    icon: any; color: string; bg: string;
    /** [标记] 后端暂未返回字段、前端先做 UI 占位的卡；接口上线后读真实字段时 grep `_placeholder` 快速找到位置 */
    _placeholder?: true;
  };
  const _fmtY = (v:number) => `¥${(Number.isFinite(v) ? v : 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const _fmtC = (v:number) => (Number.isFinite(v) ? Math.round(v) : 0).toLocaleString();
  const _fmtPct = (v:number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;
  const _gTxt = (v:any) => {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '';
    const n = Number(v);
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
  };

  // 超管 / 通用 8 卡（showKPIDashboard 分支里的 else 路径）
  // 兼容两种后端：
  //   · 超管新接口 /admin/dashboard/super/kpi → raw.businessRevenue / raw.platformProfit 等 19 字段齐全（后端指定V2算法）
  //   · TL/GL 老接口 /admin/dashboard/kpi     → 走原逻辑（teamRevenue / teamCommission）
  const isV2SuperKpi = (raw: any): boolean => {
    const d = raw && typeof raw === 'object' ? raw : {};
    // V2 特征：同时存在 businessRevenue + managementCommission + platformProfit 3 个新字段
    return typeof d.businessRevenue === 'number'
        && typeof d.managementCommission === 'number'
        && ('platformProfit' in d);
  };

  const buildSuperAdminV2 = useCallback((raw: any, prefix: string, showGrowth: boolean): DashKpi[] => {
    const d = raw && typeof raw === 'object' ? raw : {};
    const n = (k: string, fb = 0) => { const v = Number(d[k]); return Number.isFinite(v) ? v : fb; };
    const g = (k: string) => { const v = d[k]; if (v === null || v === undefined || !Number.isFinite(Number(v))) return ''; const num = Number(v); return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`; }; // 后端已×100，直接加%，不要再次乘！

    const businessRevenue    = n('businessRevenue');    // 业务总收入（广告流水，元）
    const userShareCommission = n('userShareCommission'); // 用户分成金额（金币合计/1000，元）
    const managementCommission = n('managementCommission'); // 管理分成总计（逐人teamCommission加总，元）
    const platformProfit     = n('platformProfit');     // 平台利润（允许负数！后端公式=业务收入−用户分成−管理分成−分红总计）
    const platformProfitRate = n('platformProfitRate'); // 毛利率（已×100，如 -13.52%）
    const impressions        = n('impressions');        // 广告总曝光（条）
    const ecpmAvg            = n('ecpmAvg');            // 平均 eCPM（¥/千次，后端已算好，不要再用 revenue*1000/imp 自算）
    const activeUserCount    = n('activeUserCount');    // 活跃用户（人，范围内有金币记录的员工去重）
    const activeUserRate     = n('activeUserRate');     // 活跃率（已×100，如 32.4%）
    const dividendTotal      = n('dividendTotal');      // 分红金额总计（后端公式=用户分成×0.25 − 管理分成）
    const newUserCount       = n('newUserCount');       // 新增用户（窗口内 createdAt 落在 [起始,结束) 的员工数）

    // 用户分成占业务收入的真实比例（不是写死 100%）
    const userSharePct = businessRevenue > 0
      ? (userShareCommission / businessRevenue * 100).toFixed(2) + '%'
      : '0.00%';

    return [
      // ============================================================
      // 卡片新排序（5 行 × 2 列）—— 用户自定义视觉顺序
      //  行1：今日毛利 / 今日毛利率
      //  行2：业务总收入 / 用户分成金额
      //  行3：管理分成总计 / 分红金额总计
      //  行4：广告总曝光 / 今日平均 ECPM
      //  行5：今日活跃用户 / 新增用户
      // ============================================================
      // -------- 行 1 --------
      {
        title: `${prefix}毛利`,
        value: _fmtY(platformProfit), // ❌ 不要 MAX(0,x)！负数就显示负数！后端公式=业务收入−用户分成−管理分成−分红总计
        growth: showGrowth ? g('platformProfitGrowth') : '',
        isUp:   Number(d.platformProfitGrowth) > 0,
        icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50',
      },
      {
        title: `${prefix}毛利率`,
        value: `${platformProfitRate.toFixed(2)}%`, // 后端已×100，直接加%
        growth: showGrowth ? g('platformProfitRateGrowth') : '',
        isUp:   Number(d.platformProfitRateGrowth) > 0,
        icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50',
      },
      // -------- 行 2 --------
      {
        title: '业务总收入',
        value: _fmtY(businessRevenue),
        growth: showGrowth ? g('businessRevenueGrowth') : '',
        isUp:   Number(d.businessRevenueGrowth) > 0,
        icon: Wallet, color: 'text-green-600', bg: 'bg-green-50',
      },
      {
        title: '用户分成金额',
        value: _fmtY(userShareCommission), // ✅ 独立字段，不再等于业务收入
        subValue: userSharePct,             // ✅ 真实比例（如 101.97%），不再写死 100%
        growth: showGrowth ? g('userShareGrowth') : '',
        isUp:   Number(d.userShareGrowth) > 0,
        icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50',
      },
      // -------- 行 3 --------
      {
        title: '管理分成总计',
        value: _fmtY(managementCommission),
        subValue: businessRevenue > 0 ? (managementCommission / businessRevenue * 100).toFixed(2) + '%' : '0.00%',
        growth: showGrowth ? g('managementCommissionGrowth') : '',
        isUp:   Number(d.managementCommissionGrowth) > 0,
        icon: Users, color: 'text-purple-600', bg: 'bg-purple-50',
      },
      {
        title: '分红金额总计',
        value: _fmtY(dividendTotal),        // 后端公式=用户分成×0.25 − 管理分成
        subValue: businessRevenue > 0 ? (dividendTotal / businessRevenue * 100).toFixed(2) + '%' : '0.00%',
        growth: showGrowth ? g('dividendTotalGrowth') : '',
        isUp:   Number(d.dividendTotalGrowth) > 0,
        icon: Gift, color: 'text-rose-600', bg: 'bg-rose-50',
      },
      // -------- 行 4 --------
      {
        title: '广告总曝光',
        value: _fmtC(impressions),
        growth: showGrowth ? g('impressionsGrowth') : '',
        isUp:   Number(d.impressionsGrowth) > 0,
        icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50',
      },
      {
        title: `${prefix}平均 eCPM`,
        value: ecpmAvg.toFixed(2), // 后端已算好 ¥/千次，不要自算
        growth: showGrowth ? g('ecpmAvgGrowth') : '',
        isUp:   Number(d.ecpmAvgGrowth) > 0,
        icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50',
      },
      // -------- 行 5 --------
      {
        title: `${prefix}活跃用户`,
        value: _fmtC(activeUserCount),
        subValue: `${activeUserRate.toFixed(1)}%`, // 后端已×100 活跃率
        growth: showGrowth ? g('activeUserGrowth') : '',
        isUp:   Number(d.activeUserGrowth) > 0,
        icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50',
      },
      {
        title: '新增用户',
        value: _fmtC(newUserCount),        // 窗口内 createdAt ∈ [起始,结束) 的员工数
        growth: showGrowth ? g('newUserCountGrowth') : '',
        isUp:   Number(d.newUserCountGrowth) > 0,
        icon: UserPlus, color: 'text-teal-600', bg: 'bg-teal-50',
      },
    ];
  }, []);

  const buildSuperAdminKpis = useCallback((raw: any, prefix: string, showGrowth: boolean): DashKpi[] => {
    // V2 新接口（超管专属）直接走 V2 映射，零兼容成本
    if (isV2SuperKpi(raw)) return buildSuperAdminV2(raw, prefix, showGrowth);

    const d = raw && typeof raw === 'object' ? raw : {};
    const n = (k: string, fb = 0) => { const v = Number(d[k]); return Number.isFinite(v) ? v : fb; };
    const teamRevenue = n('teamRevenue');
    const teamCommission = n('teamCommission');
    const totalImpressions = n('directImpressions') + n('indirectImpressions');
    const totalActive = n('directActiveUsers') + n('indirectActiveUsers');
    const totalUser = n('directUserCount') + n('indirectUserCount');
    const profit = Math.max(0, teamRevenue - teamCommission);
    const profitMargin = teamRevenue > 0 ? (profit / teamRevenue) * 100 : 0;
    const avgEcpm = totalImpressions > 0 ? (teamRevenue * 1000) / totalImpressions : 0;
    const activeRate = totalUser > 0 ? (totalActive / totalUser) * 100 : 0;
    const revGrowth = showGrowth ? d.teamRevenueGrowth : undefined;
    const comGrowth = showGrowth ? d.teamCommissionGrowth : undefined;
    return [
      // ============================================================
      // V1 兼容分支 —— 保持与 V2 完全一致的视觉排序（5 行 × 2 列）
      //  行1：今日毛利 / 今日毛利率
      //  行2：业务总收入 / 用户分成金额
      //  行3：管理分成总计 / 分红金额总计
      //  行4：广告总曝光 / 今日平均 ECPM
      //  行5：今日活跃用户 / 新增用户
      // ============================================================
      // -------- 行 1 --------
      { title: `${prefix}毛利`, value: _fmtY(profit), growth: showGrowth ? _gTxt(comGrowth) : '', isUp: Number(comGrowth) < 0, icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { title: `${prefix}毛利率`, value: _fmtPct(profitMargin), growth: showGrowth ? '0.0%' : '', isUp: false, icon: Percent, color: 'text-pink-600', bg: 'bg-pink-50' },
      // -------- 行 2 --------
      { title: '业务总收入', value: _fmtY(teamRevenue), growth: showGrowth ? _gTxt(revGrowth) : '', isUp: Number(revGrowth) > 0, icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
      { title: '用户分成金额', value: _fmtY(teamRevenue), subValue: teamRevenue > 0 ? '100.00%' : '0.00%', growth: showGrowth ? _gTxt(revGrowth) : '', isUp: Number(revGrowth) > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
      // -------- 行 3 --------
      { title: '管理分成总计', value: _fmtY(teamCommission), subValue: teamRevenue > 0 ? (teamCommission / teamRevenue * 100).toFixed(2) + '%' : '0.00%', growth: showGrowth ? _gTxt(comGrowth) : '', isUp: Number(comGrowth) > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
      // [UI占位 2026-07-13] 超管首页新增 2 张卡（V1兼容分支也加，避免老接口时少卡）
      { title: '分红金额总计', value: _fmtY(0), subValue: teamRevenue > 0 ? (0 / teamRevenue * 100).toFixed(2) + '%' : '0.00%', growth: showGrowth ? '0.0%' : '', isUp: false, icon: Gift, color: 'text-rose-600', bg: 'bg-rose-50', _placeholder: true as const },
      // -------- 行 4 --------
      { title: '广告总曝光', value: _fmtC(totalImpressions), growth: showGrowth ? _gTxt(revGrowth) : '', isUp: Number(revGrowth) > 0, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: `${prefix}平均 eCPM`, value: avgEcpm.toFixed(2), growth: showGrowth ? '0.0%' : '', isUp: false, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
      // -------- 行 5 --------
      { title: `${prefix}活跃用户`, value: _fmtC(totalActive), subValue: totalUser > 0 ? `${activeRate.toFixed(1)}%` : '0.00%', icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50' },
      { title: '新增用户',        value: _fmtC(0), growth: showGrowth ? '0.0%' : '', isUp: false, icon: UserPlus, color: 'text-teal-600', bg: 'bg-teal-50', _placeholder: true as const },
    ];
  }, [buildSuperAdminV2]);

  // 超管新接口返回 { success:true, data:{...19字段}, cached: true/false } —— 这里统一解包成 data 主体，
  // 老接口 /admin/dashboard/kpi 直接返回对象时 → 原样返回，兼容两种包装
  const unwrapKpiResponse = (raw: any): any => {
    if (!raw || typeof raw !== 'object') return raw;
    const obj = raw as Record<string, any>;
    // 只要是形如 success:true + data是对象，就拆包装（无论新接口cached是否存在）
    if (obj.success === true && typeof obj.data === 'object' && obj.data !== null) {
      return obj.data;
    }
    return raw;
  };

  // 组长 5 卡（Dashboard 内部 showKPIDashboard 分支里的 isGroupLeader 路径；注意真正组长渲染走独立 <GroupLeader/> 组件）
  // 注意：commission 参数仅作为“接口未返回 teamCommission 时的兜底估算”使用，实际值优先用接口返回的 teamCommission（这是按GoldLog固化率聚合的真实提成）
  const buildGroupLeaderKpis = useCallback((raw: any, showGrowth: boolean, commission: number): DashKpi[] => {
    const d = raw && typeof raw === 'object' ? raw : {};
    const n = (k: string, fb = 0) => { const v = Number(d[k]); return Number.isFinite(v) ? v : fb; };
    const teamRevenue = n('teamRevenue');
    const teamCommission = n('teamCommission');
    const directImpressions = n('directImpressions');
    const directActive = n('directActiveUsers');
    const directUserCount = n('directUserCount');
    const com = commission || 0.06;
    // 若接口真的没返回 teamCommission，则按 commission * teamRevenue 估算（兜底，极少见）
    const groupEarnings = teamCommission > 0 ? teamCommission : teamRevenue * com;
    const avgGold = directImpressions > 0 ? (teamRevenue * 1000) / directImpressions : 0;
    const revGrowth = showGrowth ? d.teamRevenueGrowth : undefined;
    const comGrowth = showGrowth ? d.teamCommissionGrowth : undefined;
    const activeRate = directUserCount > 0 ? (directActive / directUserCount) * 100 : 0;
    return [
      { title: '组提成收益', value: _fmtY(groupEarnings), subValue: teamRevenue > 0 ? `${(com*100).toFixed(2)}%` : '0%', growth: showGrowth ? _gTxt(comGrowth) : '', isUp: Number(comGrowth) > 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
      { title: '团队用户收益', value: _fmtY(teamRevenue), growth: showGrowth ? _gTxt(revGrowth) : '', isUp: Number(revGrowth) > 0, icon: Coins, color: 'text-orange-600', bg: 'bg-orange-50' },
      { title: '今日活跃用户', value: _fmtC(directActive), subValue: directUserCount > 0 ? `${activeRate.toFixed(1)}%` : '0.0%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: '广告总曝光', value: _fmtC(directImpressions), icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: '单条平均金币', value: avgGold.toFixed(2), icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    ];
  }, []);
  // ==================================================

  const fetchData = useCallback(async (isRefresh = false) => {
    // 保存当前滚动位置
    if (isRefresh) {
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      setRefreshing(true);
      // 刷新时清除缓存
      cacheManager.clear();
    } else {
      // 无论是否为团队长，都需要设置loading为true
      // 因为Dashboard组件需要显示整体加载状态
      setLoading(true);
    }
    // 不清空之前的数据，避免闪屏
    try {
      // 检查currentUser是否存在
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const rangeParam = timeRangeMap[timeRange];
      const cacheKey = `${rangeParam}_${currentUser.id}`;
      
      // 声明昨日数据映射变量
      let yesterdayUserMap: Record<string, number> = {};
      let yesterdayEarningsMap: Record<string, number> = {};
      
      // 检查缓存
      const cachedData = getCachedData(cacheKey);
      if (cachedData && !isRefresh) {
        const { kpiData: cachedKpiData, userData: cachedUserData } = cachedData;
        setKpiData(cachedKpiData);
        setUserData(Array.isArray(cachedUserData) ? cachedUserData : []);
        // 无论是否有昨日数据，都使用缓存的今日数据
        setLoading(false);
        setRefreshing(false);
        
        // 标记数据已加载，避免GroupLeader组件重复加载
        (window as any).dashboardDataLoaded = true;
        
        // 后台预加载其他时间范围的数据（不阻塞主流程）
        setTimeout(() => {
          preloadOtherTimeRanges();
        }, 100);
        return;
      }

      // 1. 先获取当前时间范围的数据（主要请求）
      let kpiResponse: any = null;
      let userResponse: any = null;
      let transformedKpis: any[] = [];
      
      console.log('[Dashboard] 开始获取当前时间范围数据', { timeRange, showKPIDashboard, isTeamLeader, isGroupLeader, isSuperAdmin });
        const startTime = Date.now();
        
        // 构建主要API请求
        const primaryRequests: Promise<any>[] = [];
        
        // KPI数据请求
        if (showKPIDashboard) {
          let kpiUrl: string;
          if (isSuperAdmin) {
            // 超管新接口（平台全局视角，不加 group/team 参数，严格不动 TL/GL 的旧/kpi）
            kpiUrl = `/admin/dashboard/super/kpi?range=${rangeParam}`;
          } else {
            kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
            if (isGroupLeader) {
              const teamGroupId = currentUser.teamGroupId;
              kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
            }
          }
          console.log('[Dashboard] 添加KPI请求:', kpiUrl);
          primaryRequests.push(request<any>(kpiUrl, { method: 'GET' }));
        } else {
          primaryRequests.push(Promise.resolve(null));
        }
        
        // 用户数据请求
        let userUrl = `/admin/dashboard/users?range=${rangeParam}`;
        if (isGroupLeader) {
          const teamGroupId = currentUser.teamGroupId;
          userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
        } else if (isTeamLeader) {
          const teamName = getUserTeamName();
          userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}`;
        }
        console.log('[Dashboard] 添加用户请求:', userUrl);
        primaryRequests.push(request<any[]>(userUrl, { method: 'GET' }));
        
        console.log(`[Dashboard] 共有 ${primaryRequests.length} 个主要请求需要执行`);
        
        // 执行主要请求（当前时间范围的数据）
        const primaryResponses = await Promise.all(primaryRequests);
        
        console.log(`[Dashboard] 主要请求完成，耗时: ${Date.now() - startTime}ms`);
        
        // 处理主要响应结果
        let responseIndex = 0;
        if (showKPIDashboard) {
          kpiResponse = primaryResponses[responseIndex++];
          // 超管新接口 {success,data,cached} 解包；老接口直返对象 → 原样
          kpiResponse = unwrapKpiResponse(kpiResponse);
        } else {
          responseIndex += 1;
        }
        
        userResponse = primaryResponses[responseIndex++];
        console.log('[Dashboard] 用户数据响应:', userResponse);
        
        // 2. 处理KPI数据
        if (kpiResponse) {
          const timePrefix = timePrefixMap[timeRange];
          const showGrowth = timeRange === TimeRange.TODAY || timeRange === TimeRange.THIS_MONTH;
          if (isGroupLeader) {
            const commissionRate = currentUser?.commission || 0.06;
            transformedKpis = buildGroupLeaderKpis(kpiResponse, showGrowth, commissionRate);
          } else {
            transformedKpis = buildSuperAdminKpis(kpiResponse, timePrefix, showGrowth);
          }
          // 立即更新KPI数据，让用户看到初步结果
          setKpiData(transformedKpis);
        }
        
        // 3. 处理用户数据
        if (userResponse) {
          // Transform user data to match frontend format
          const userArray = typeof userResponse === 'object' && userResponse !== null && 'data' in userResponse && Array.isArray(userResponse.data) ? userResponse.data : Array.isArray(userResponse) ? userResponse : [];
          const transformedUsers = transformUsers(userArray, true) as DashboardUser[];

          // ✅ URL 已传 team/group 参数，后端已按范围返回；不再基于 teamName 老字段做前端二次过滤（字段不全会把所有数据全过滤掉）
          const filteredUsers = transformedUsers;

          // 显示所有用户，不限制数量
          setUserData(filteredUsers);
          
          // 5. 缓存数据
          const cacheTime = timeRange === TimeRange.TODAY ? 300000 : 600000; // 今日数据缓存5分钟，其他10分钟
          setCachedData(cacheKey, { kpiData: showKPIDashboard && kpiResponse ? transformedKpis : kpiData, userData: filteredUsers }, cacheTime);
        }
      
      // 后台预加载其他时间范围的数据（不阻塞主流程）
      setTimeout(() => {
        preloadOtherTimeRanges();
      }, 100);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // 数据获取失败，保持数据为空，不显示模拟数据
      setKpiData([]);
      setUserData([]);
    } finally {
      // 无论是否为团队长，都需要设置loading为false
      // 因为团队长的loading状态也需要被重置
      setLoading(false);
      setRefreshing(false);
      // 切换时间范围时滚动到顶部
      if (!isRefresh) {
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 50);
      } else if (scrollPositionRef.current > 0) {
        // 刷新时恢复滚动位置
        setTimeout(() => {
          window.scrollTo(0, scrollPositionRef.current);
        }, 50);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, currentUser, isTeamLeader, isGroupLeader, showKPIDashboard]);

  // 后台预加载其他时间范围的数据
  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser || !currentUser.token) return;
    
    // 所有时间范围
    const allTimeRanges = Object.values(TimeRange);
    // 排除当前时间范围
    const otherTimeRanges = allTimeRanges.filter(range => range !== timeRange);
    
    // 并行预加载所有其他时间范围的数据
    await Promise.all(
      otherTimeRanges.map(async (range) => {
        const rangeParam = timeRangeMap[range];
        const cacheKey = `${rangeParam}_${currentUser.id}`;
        
        // 检查是否已经有缓存
        if (getCachedData(cacheKey)) {
          return; // 已有缓存，跳过预加载
        }
        
        try {
          // 预加载KPI数据
          let kpiUrl: string;
          if (isSuperAdmin) {
            // 超管新接口（平台全局视角，不加 group/team 参数）
            kpiUrl = `/admin/dashboard/super/kpi?range=${rangeParam}`;
          } else {
            kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}`;
            if (isGroupLeader) {
              const teamGroupId = currentUser.teamGroupId;
              kpiUrl = `/admin/dashboard/kpi?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
            }
          }
          const rawKpiResponse = await request<any>(kpiUrl, { method: 'GET' });
          // 超管新接口 {success,data,cached} 解包；老接口直返对象 → 原样
          const kpiResponse = unwrapKpiResponse(rawKpiResponse);
          
          // 预加载用户数据
          let userUrl = `/admin/dashboard/users?range=${rangeParam}`;
          if (isGroupLeader) {
            const teamGroupId = currentUser.teamGroupId;
            userUrl = `/admin/dashboard/users?range=${rangeParam}&group=${encodeURIComponent(teamGroupId || '')}`;
          } else if (isTeamLeader) {
            const teamName = getUserTeamName();
            userUrl = `/admin/dashboard/users?range=${rangeParam}&team=${encodeURIComponent(teamName)}`;
          }
          const userResponse = await request<any[]>(userUrl, { method: 'GET' });
          
          // 处理数据并缓存
          if (kpiResponse && userResponse) {
            // 转换KPI数据：统一调用 build*Kpis，完全基于新接口字段（不再使用旧 coins/revenue/impressions 等字段）
            let transformedKpis: any[] = [];
            if (showKPIDashboard) {
              const localPrefixMap: Record<string, string> = {
                [TimeRange.TODAY]: '今日',
                [TimeRange.YESTERDAY]: '昨日',
                [TimeRange.THIS_WEEK]: '本周',
                [TimeRange.THIS_MONTH]: '本月'
              };
              const timePrefix = localPrefixMap[range];
              const showGrowth = range === TimeRange.TODAY || range === TimeRange.THIS_MONTH;

              if (isGroupLeader) {
                const commissionRate = currentUser?.commission || 0.06;
                transformedKpis = buildGroupLeaderKpis(kpiResponse, showGrowth, commissionRate);
              } else {
                transformedKpis = buildSuperAdminKpis(kpiResponse, timePrefix, showGrowth);
              }
            }
            
            // 转换用户数据（与正常加载逻辑完全一致）
            const userArray = typeof userResponse === 'object' && userResponse !== null && 'data' in userResponse && Array.isArray(userResponse.data) ? userResponse.data : Array.isArray(userResponse) ? userResponse : [];
            const transformedUsers: DashboardUser[] = transformUsers(userArray, true) as DashboardUser[];
            
            // ✅ URL 已传 team/group 参数，后端已按范围返回；不再做前端二次过滤
            const filteredUsers = transformedUsers;
            
            const finalUsers = filteredUsers.slice(0, 30);
            
            // 缓存数据（与正常加载逻辑完全一致）
            const cacheTime = range === TimeRange.TODAY ? 300000 : 600000;
            setCachedData(cacheKey, { 
              kpiData: showKPIDashboard && kpiResponse ? transformedKpis : [], 
              userData: finalUsers
            }, cacheTime);
          }
        } catch (error) {
          console.error(`Error preloading ${range} data:`, error);
        }
      })
    );
    
    // 并行预加载其他页面数据（按角色裁剪）
    const preloadTasks: Promise<void>[] = [];
    
    // 1. 用户列表预加载（所有角色都需要）
    const preloadUserList = async () => {
      const userListCacheKey = `user_list_today_${currentUser.id}_v3`;
      if (getCachedData(userListCacheKey)) return;
      
      let userListUrl = `/admin/dashboard/users?range=today&limit=1000`;
      if (isGroupLeader) {
        const teamGroupId = currentUser.teamGroupId;
        userListUrl = `/admin/dashboard/users?range=today&group=${encodeURIComponent(teamGroupId || '')}&limit=1000`;
      } else if (isTeamLeader) {
        const teamName = getUserTeamName();
        userListUrl = `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`;
      }
      
      const userListResponse = await request<any[]>(userListUrl).catch(() => []);
      const userArray = Array.isArray(userListResponse) ? userListResponse : [];
      const transformedUsers = transformUsers(userArray);
      const uniqueUsers = Array.from(new Map(transformedUsers.map(user => [user.id, user])).values());
      
      setCachedData(userListCacheKey, { users: uniqueUsers });
      cacheManager.set(userListCacheKey, { users: uniqueUsers });
    };
    
    // 2. "我的"页面预加载（所有角色都需要）
    const preloadMyData = async () => {
      const myCacheKey = `my_data_${currentUser.id}`;
      if (getCachedData(myCacheKey)) return;
      
      const myDataResponse = await request<any>('/admin/account/profile', { method: 'GET' }).catch(() => null);
      setCachedData(myCacheKey, { profile: myDataResponse || {} });
      cacheManager.set(myCacheKey, { profile: myDataResponse || {} });
    };
    
    // 3. 新人页面预加载（仅超管有新人菜单）
    const preloadNewUsers = async () => {
      const isSuperAdmin = roleStr === 'superadmin' || roleStr === 'SUPER_ADMIN';
      if (!isSuperAdmin) return;
      
      const newUsersCacheKey = `new_users_${currentUser.id}`;
      if (getCachedData(newUsersCacheKey)) return;
      
      const teamName = currentUser?.teamName || '';
      const teamId = currentUser?.id || '';
      
      let newUsersUrl = '/user/new-users?days=15';
      if (isTeamLeader) {
        if (teamId) {
          newUsersUrl += `&teamId=${encodeURIComponent(teamId)}`;
        } else if (teamName) {
          newUsersUrl += `&team=${encodeURIComponent(teamName)}`;
        }
      }
      
      const todayDataUrl = isTeamLeader
        ? `/admin/dashboard/users?range=today&team=${encodeURIComponent(teamName)}&limit=1000`
        : '/admin/dashboard/users?range=today&limit=1000';
      
      const yesterdayDataUrl = isTeamLeader
        ? `/admin/dashboard/users?range=yesterday&team=${encodeURIComponent(teamName)}&limit=1000`
        : '/admin/dashboard/users?range=yesterday&limit=1000';
      
      const [newUsersResponse, todayDataResponse, yesterdayDataResponse] = await Promise.all([
        request<any>(newUsersUrl, { method: 'GET' }).catch(() => []),
        request<any>(todayDataUrl, { method: 'GET' }).catch(() => []),
        request<any>(yesterdayDataUrl, { method: 'GET' }).catch(() => [])
      ]);
      
      const todayDataMap: Record<string, any> = {};
      if (Array.isArray(todayDataResponse)) {
        todayDataResponse.forEach((user: any) => {
          const userId = user.userId || user.employeeId || '';
          if (userId) todayDataMap[userId] = user;
        });
      }
      
      const yesterdayUserDataMap: Record<string, number> = {};
      const yesterdayEarningsDataMap: Record<string, number> = {};
      if (Array.isArray(yesterdayDataResponse)) {
        yesterdayDataResponse.forEach((user: any) => {
          const userId = user.userId || user.employeeId || '';
          if (userId) {
            yesterdayUserDataMap[userId] = user.watched || 0;
            yesterdayEarningsDataMap[userId] = user.earnings || 0;
          }
        });
      }
      
      const list = Array.isArray(newUsersResponse) ? newUsersResponse : [];
      const now = new Date();
      const currentTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
      const transformedUsers: NewUser[] = list.map((user: any) => {
        const userId = user.employeeId || user.userId || '';
        const todayData = todayDataMap[userId] || {};
        const registerTime = user.registerTime ? new Date(user.registerTime).getTime() : currentTime;
        const regDays = Math.ceil((currentTime - registerTime) / (1000 * 60 * 60 * 24)) || 1;
        
        return {
          id: userId,
          userId: user.employeeId || user.userId || '',
          name: user.realName || user.realname || user.name || user.username || user.userName || userId,
          avatar: '',
          watched: todayData.watched || 0,
          earnings: (todayData.earnings || 0) / 1000,
          ipCount: todayData.ipCount || 1,
          deviceCount: todayData.deviceCount || 1,
          ecpm: todayData.ecpm || 0,
          regDays,
          superior: user.superior || user.supervisorUsername || user.supervisorName || user.supervisorRealName || '系统直属',
          groupName: user.groupName || user.teamGroup || '',
          groupLeaderName: user.groupLeaderName || '',
          isOnline: (todayData.watched || 0) > 0
        };
      });
      
      setCachedData(newUsersCacheKey, {
        users: transformedUsers,
        yesterdayUserData: yesterdayUserDataMap,
        yesterdayEarningsData: yesterdayEarningsDataMap
      });
      cacheManager.set(newUsersCacheKey, {
        users: transformedUsers,
        yesterdayUserData: yesterdayUserDataMap,
        yesterdayEarningsData: yesterdayEarningsDataMap
      });
    };
    
    // 4. 团队页面预加载（超管、高管、团队长有团队菜单，组长没有）
    const preloadTeams = async () => {
      const isSuperAdmin = roleStr === 'superadmin' || roleStr === 'SUPER_ADMIN';
      const isAdminManager = roleStr === 'ADMIN_MANAGER';
      if (!isSuperAdmin && !isAdminManager && !isTeamLeader) return;
      
      const todayCacheKey = `teams_${currentUser.id}_today`;
      const monthCacheKey = `teams_${currentUser.id}_month`;
      if (cacheManager.get(todayCacheKey, 300000)) return;
      
      const teamsData = await request<any[]>(`/admin/team-performance?range=today`, { method: 'GET' }).catch(() => []);
      
      if (Array.isArray(teamsData)) {
        const validTeams = teamsData.filter((team: any) => {
          return team && typeof team === 'object' && team.teamName && team.leaderId;
        });
        
        cacheManager.set(todayCacheKey, { teams: validTeams });
        
        const monthData = await request<any[]>(`/admin/team-performance?range=month`, { method: 'GET' }).catch(() => []);
        if (Array.isArray(monthData)) {
          const validMonthTeams = monthData.filter((team: any) => {
            return team && typeof team === 'object' && team.teamName && team.leaderId;
          });
          cacheManager.set(monthCacheKey, { teams: validMonthTeams });
        }
      }
    };
    
    // 并行执行所有预加载任务
    preloadTasks.push(preloadUserList(), preloadMyData(), preloadNewUsers(), preloadTeams());
    
    try {
      await Promise.all(preloadTasks);
    } catch (error) {
      console.error('Error in parallel preloading:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, currentUser, isTeamLeader, isGroupLeader, showKPIDashboard]);

  useEffect(() => {
    // 只有当currentUser存在时才加载数据
    if (currentUser) {
      // 标记Dashboard组件已设置自动刷新
      (window as any).dashboardAutoRefresh = true;
      
      // 初始加载数据，强制刷新，不使用缓存
      fetchData(true);
      
      // 设置自动刷新定时器，每60秒刷新一次，使用静默刷新模式
      const interval = setInterval(() => {
        // 静默刷新：不显示刷新动画，只更新缓存
        fetchData(true);
      }, 60000);
      
      // 清理函数
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, currentUser, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const kpis = kpiData;

  const isAdminManager = useMemo(() => {
    const roleUpper = String(currentUser?.role || '').toUpperCase().replace(/_/g, '');
    return roleUpper === String(UserRole.ADMIN_MANAGER).toUpperCase().replace(/_/g, '');
  }, [currentUser?.role]);

  const filteredKpis = useMemo(() => {
    if (!isAdminManager) return kpis;
    const allowedTitles = ['用户分成金额', '管理分成总计', '分红金额总计', '广告总曝光', '新增用户'];
    return kpis.filter(kpi => allowedTitles.includes(kpi.title) || kpi.title.includes('活跃用户'));
  }, [kpis, isAdminManager]);

  // 使用useMemo缓存排序结果，避免每次渲染都重新排序
  const sortedUsers = useMemo(() => {
    // Step 1: searchKeyword 过滤
    let filteredUsers = userData;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filteredUsers = userData.filter(user => {
        return user.id.toLowerCase().includes(keyword) || 
               user.name.toLowerCase().includes(keyword);
      });
    }

    // Step 2: memberFilter 直推/间推过滤（超管/高管不生效，TL/GL 生效）
    const hasDirectTag = !isSuperAdmin && filteredUsers.some(u => typeof u.isDirect === 'boolean');
    if (hasDirectTag) {
      if (memberFilter === 'direct') {
        filteredUsers = filteredUsers.filter(u => u.isDirect === true);
      } else if (memberFilter === 'indirect') {
        filteredUsers = filteredUsers.filter(u => u.isDirect === false);
      }
    }
    
    // Step 3: 排序
    const sorted = [...filteredUsers].sort((a, b) => {
      if (sortBy === 'agc') {
        const agcA = a.watched > 0 ? (a.earnings * 1000) / a.watched : 0;
        const agcB = b.watched > 0 ? (b.earnings * 1000) / b.watched : 0;
        return agcB - agcA;
      }
      return b[sortBy] - a[sortBy];
    });
    
    // 超管和团队长只显示TOP30，组长显示所有
    if (!isGroupLeader) {
      return sorted.slice(0, 30);
    }
    return sorted;
  }, [userData, sortBy, searchKeyword, memberFilter, isGroupLeader]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB]">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* 显示头部标题和时间切换栏 */}
      <header className="sticky top-0 bg-white z-40 px-4 py-3 border-b border-gray-100 shadow-sm animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <TrendingUp size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{isTeamLeader ? '团队数据' : isGroupLeader ? '团队数据' : '数据总览'}</h1>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 bg-blue-50 rounded-lg text-[#1E40AF] hover:bg-blue-100 transition-all disabled:opacity-50 animate-in hover:scale-105"
              title="刷新数据"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="p-1.5 bg-green-50 rounded-full flex items-center px-3 text-green-600 text-[10px] font-bold shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5"></div>
            实时更新中
          </div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
          {Object.values(TimeRange).map((range) => (
            <button
              key={range}
              onClick={() => {
                // 将TimeRange枚举值转换为对应的字符串
                const rangeMap: Record<string, string> = {
                  '今日': 'today',
                  '昨日': 'yesterday',
                  '本周': 'week',
                  '本月': 'month'
                };
                const newTimeRange = rangeMap[range] || 'today';
                // 调用传入的onTimeRangeChange函数
                onTimeRangeChange?.(newTimeRange);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                timeRange === range ? 'bg-white text-[#1E40AF] shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 mt-4 space-y-4">
        {/* 团队长显示专用数据看板，组长显示团队模块的数据看板，超级管理员显示完整数据看板 */}
        {isTeamLeader ? (
          <TeamLeaderDashboard 
            timeRange={timeRange} 
            onRefresh={handleRefresh} 
            onDataLoaded={() => setLoading(false)}
          />
        ) : isGroupLeader ? (
          <GroupLeader 
            timeRange={timeRange} 
            onRefresh={handleRefresh} 
          />
        ) : (
          showKPIDashboard && (
            <div className="grid grid-cols-2 gap-3">
              {filteredKpis.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                  <div className="text-sm mb-2">暂无数据</div>
                  <div className="text-[10px]">请稍后刷新或检查网络连接</div>
                </div>
              ) : filteredKpis.map((kpi: any, idx) => {
                const Icon = kpi.icon;
                const rawValue = kpi.title.includes('eCPM') ? parseFloat(kpi.value) : 0;
                
                return (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2.5 rounded-xl ${kpi.bg} shadow-sm`}>
                        <Icon size={20} className={kpi.color} />
                      </div>
                      {kpi.growth && (
                        <div className={`text-[9px] font-bold flex items-center ${kpi.isUp ? 'text-[#10B981]' : 'text-[#EF4444]'} bg-opacity-10 px-2 py-0.5 rounded-full`}>
                          {kpi.isUp ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
                          {kpi.growth}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-500 text-[10px] font-medium mb-1 uppercase tracking-wider">{kpi.title}</div>
                    <div className={`text-lg font-bold leading-none ${
                        kpi.title.includes('eCPM') 
                            ? (rawValue >= 150 ? 'text-[#10B981]' : 'text-[#EF4444]') 
                            : 'text-gray-900'
                    }`}>
                        {kpi.value}
                        {kpi.subValue && !(
                          isAdminManager && ['用户分成金额', '管理分成总计', '分红金额总计'].includes(kpi.title)
                        ) && (
                          <span className={`ml-1.5 text-[10px] font-bold ${
                            kpi.title === '广告总点击' 
                              ? (parseFloat(kpi.subValue) >= 70 ? 'text-[#10B981]' : 'text-[#EF4444]')
                              : kpi.title === '用户分成金额'
                                ? (parseFloat(kpi.subValue) <= 60 ? 'text-[#10B981]' : 'text-[#EF4444]')
                                : kpi.title.includes('活跃用户')
                                  ? (parseFloat(kpi.subValue) < 50 ? 'text-[#EF4444]' : 'text-[#10B981]')
                                  : (parseFloat(kpi.subValue) > 50 ? 'text-[#EF4444]' : 'text-[#10B981]')
                          }`}>
                            ({kpi.subValue})
                          </span>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden animate-in fade-in duration-500">
            {isGroupLeader && (
                <div className="p-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="按用户 ID 或昵称快速查找..." 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            <Search size={16} />
                        </div>
                    </div>
                </div>
            )}
            <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                {(() => {
                  // ✅ 超管/高管不显示直推/间推，团队长/组长显示：
                  //   · 超管/高管（isSuperAdmin === true）→ 合并成一行：标题 + 排序
                  //   · TL/GL（isSuperAdmin === false）→ 保持原两行结构：标题居中 + 筛选（全部/直推/间推）+ 排序
                  const hasDirectTag = !isSuperAdmin && userData.length > 0 && userData.some(u => typeof u.isDirect === 'boolean');
                  const titleBlock = (
                    <h3 className="text-sm font-bold text-gray-900 flex items-center shrink-0">
                        <Users size={16} className="mr-2 text-[#1E40AF]" />
                        {isTeamLeader ? '成员实时业绩' : '用户实时业绩'}
                    </h3>
                  );
                  const sortBlock = (
                    <div className="flex items-center space-x-2 ml-auto shrink-0">
                        <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-200">
                            <button 
                                onClick={() => setSortBy('agc')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'agc' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                平均金币
                            </button>
                            <button 
                                onClick={() => setSortBy('watched')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'watched' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                次数
                            </button>
                            <button 
                                onClick={() => setSortBy('earnings')}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${sortBy === 'earnings' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}
                            >
                                收益
                            </button>
                        </div>
                    </div>
                  );
                  const filterBlock = (
                    <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-200 shrink-0">
                        <button 
                            onClick={() => setMemberFilter('all')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${memberFilter === 'all' ? 'bg-[#1E40AF] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            全部
                        </button>
                        <button 
                            onClick={() => setMemberFilter('direct')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${memberFilter === 'direct' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            直推
                        </button>
                        <button 
                            onClick={() => setMemberFilter('indirect')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all duration-200 ${memberFilter === 'indirect' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            间推
                        </button>
                    </div>
                  );

                  if (hasDirectTag) {
                    // ============= TL / GL：保持原两行结构 =============
                    return (
                      <>
                        {/* 行1：标题居中（原实现 100% 保留，不动） */}
                        <div className="flex justify-center items-center px-4 pt-3 pb-2">
                            {titleBlock}
                        </div>
                        {/* 行2：左=筛选（全部/直推/间推），右=排序（原实现 100% 保留，不动） */}
                        <div className="flex items-center justify-between gap-2 px-4 pb-3 flex-wrap">
                            {filterBlock}
                            {sortBlock}
                        </div>
                      </>
                    );
                  }

                  // ============= 超管（hasDirectTag=false）：合并成一行，左=标题 右=排序（解决左下空丑的问题）=============
                  return (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                        {titleBlock}
                        {sortBlock}
                    </div>
                  );
                })()}
            </div>
            
            <div className="divide-y divide-gray-100">
                {sortedUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <div className="text-sm mb-2">暂无用户数据</div>
                    <div className="text-[10px]">请稍后刷新或检查网络连接</div>
                  </div>
                ) : sortedUsers.map((user, idx) => (
                    <div 
                      key={`${user.id}-${idx}`}
                      className="p-4 space-y-3 active:bg-gray-50 transition-all duration-200 cursor-pointer hover:bg-gray-50/50 animate-in fade-in duration-300"
                      onClick={() => {
                        // 保存当前滚动位置
                        sessionStorage.setItem('dashboard_scroll_position', String(window.scrollY));
                        onSelectUser?.(user);
                      }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center text-gray-900 text-xs font-bold shadow-sm border border-gray-100">
                                        {user.id}
                                    </div>
                                    
                                    {idx === 0 && (
                                        <div className="absolute -top-3 -left-2.5 text-yellow-500 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)] transform -rotate-12 animate-pulse">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 1 && (
                                        <div className="absolute -top-3 -left-2.5 text-slate-400 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    {idx === 2 && (
                                        <div className="absolute -top-3 -left-2.5 text-amber-700 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] transform -rotate-12">
                                            <Crown size={18} fill="currentColor" strokeWidth={1.5} />
                                        </div>
                                    )}

                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white ${
                                        idx === 0 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-400'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-bold text-gray-900 truncate">{user.name}</h4>
                                        {user.regDays <= 15 && (
                                            <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded-full border border-emerald-200 uppercase leading-tight flex-shrink-0 shadow-sm">新人</span>
                                        )}
                                        {!isSuperAdmin && typeof user.isDirect === 'boolean' && (
                                          <span
                                            title={sourceKindTooltip(user)}
                                            className={`text-[8px] font-black px-2 py-0.5 rounded-full leading-tight flex-shrink-0 shadow-sm border text-white ${
                                              user.isDirect
                                                ? 'bg-blue-600 border-blue-700'
                                                : 'bg-orange-500 border-orange-600'
                                            }`}
                                          >
                                            {user.isDirect ? '直推' : '间推'}
                                          </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium tracking-tight flex items-center overflow-hidden mt-1 space-x-1.5">
                                        <span className="text-gray-600 font-semibold flex-shrink-0">上级:</span>
                                        <span className="text-[#1E40AF] font-bold min-w-0 whitespace-nowrap">
                                          {(() => {
                                            // ✅ 严格只认「上级真实姓名」，其他字段（superior / teamName / supervisorUsername / ...）一律忽略
                                            // —— 这些字段后端可能写成"李想代理群"（组名）或"lixiang"（账号），不符合"显示范洁就可以"的要求
                                            const realName = (user.supervisorRealName || '').trim();
                                            return realName || '系统直属';
                                          })()}
                                        </span>
                                        <span className="text-gray-300 flex-shrink-0">•</span>
                                        <span className="text-gray-400 flex-shrink-0">注册{user.regDays}天</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 flex-shrink-0">
                                <div className="text-right flex flex-col space-y-0.5">
                                    {sortBy === 'earnings' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${isGroupLeader ? (user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900') : user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${isGroupLeader ? (user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900') : user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                        </>
                                    ) : sortBy === 'watched' ? (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>{user.watched}</span>
                                                <span className="text-[9px] text-gray-400 font-bold">次数</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${(user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>
                                                    {(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">平均金币</span>
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                                <span className={`text-[11px] font-black ${user.earnings > 100 ? 'text-green-600' : user.earnings < 100 ? 'text-red-500' : 'text-gray-900'}`}>¥{user.earnings.toFixed(2)}</span>
                                                <span className="text-[9px] text-gray-400 font-medium">收益</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <ChevronRight size={16} className="text-gray-400 hover:text-[#1E40AF] transition-colors" />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 pt-1">
                            <div className="flex items-center space-x-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <Globe size={12} className="text-blue-500" />
                                <span className="text-[9px] text-gray-400 font-medium">IP:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.ipCount}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                <Smartphone size={12} className="text-purple-500" />
                                <span className="text-[9px] text-gray-400 font-medium">设备:</span>
                                <span className="text-[10px] font-bold text-gray-700">{user.deviceCount}</span>
                            </div>
                            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ml-auto ${sortBy === 'agc' ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-blue-50 border-blue-200 shadow-sm'}`}>
                                <Zap size={12} className={sortBy === 'agc' ? 'text-white' : 'text-orange-500'} />
                                <span className={`text-[9px] font-medium uppercase tracking-tighter ${sortBy === 'agc' ? 'text-white/80' : 'text-gray-400'}`}>平均金币:</span>
                                <span className={`text-[10px] font-black ${sortBy === 'agc' ? 'text-white' : (user.watched > 0 ? ((user.earnings * 1000) / user.watched) >= 100 : false) ? 'text-green-600' : 'text-red-500'}`}>
                                    {(user.watched > 0 ? ((user.earnings * 1000) / user.watched) : 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {!isGroupLeader && (
              <button 
                onClick={() => {
                  // 保存当前滚动位置
                  sessionStorage.setItem('dashboard_scroll_position', String(window.scrollY));
                  onViewAllUsers?.();
                }}
                className="w-full py-3 bg-gray-50 text-[11px] font-bold text-gray-500 hover:text-[#1E40AF] border-t border-gray-50 transition-colors"
              >
                  查看全部用户
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
