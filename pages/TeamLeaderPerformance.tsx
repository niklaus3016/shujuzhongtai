import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Coins, Calendar, TrendingUp, BarChart3, RefreshCw,
  ChevronDown, Wallet, Layers, Flame, Crown, Zap,
  Sparkles, Medal, Trophy, Wrench, ArrowLeft
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { cacheManager } from '../services/cacheManager';
import { UserRole } from '../types';
import type {
  ViewGroupLeaderTarget,
  GLPMode,
} from '../utils/viewGroupLeaderPerformance';
import {
  resolvePerformanceIdentity,
  makeTLPRequestUrl,
} from '../utils/viewGroupLeaderPerformance';
import {
  LEVEL_V2_ORDER,
  computeAdminLevelV2,
  formatCommission,
  getLevelV2Theme,
  normalizeLevelConfig as normalizeLevelConfigV2,
  type AdminLevelInfoV2,
  type LevelV2ConfigRow,
} from '../utils/levelV2Service';

export interface TeamLeaderPerformanceProps {
  mode?: GLPMode;
  /** 仅 mode='view-as-other' 需要：目标团队长 + 来源组名 */
  target?: ViewGroupLeaderTarget | null;
  /** 仅 view-as-other 模式生效：点顶栏返回按钮回调 */
  onBack?: () => void;
}

// ============== 后端接口约定（对齐 Q5 硬规则） ==============
// GET /team-leader/performance
// Response:
// {
//   summary: { totalRevenue, directRevenue, groupsRevenue, teamFoundedAt, operatingDays },
//   // Q5 ① manualLevel / manualLevelSetAt 来源 Admin.js
//   manualLevel?: 'P1'~'P8' | null,
//   manualLevelSetAt?: string | number | Date,
//   level?: { currentLevel, currentLevelName, currentCommission, ... },
//   monthly: [{ month: 'YYYY-MM', revenue }],
//   daily:   [{ date: 'YYYY-MM-DD', weekday: 1-7, revenue }],
//   currentMonth: { yearMonth, daysInMonth, daysPassed, revenue, dailyAvg },
//   levelConfig?: LevelV2ConfigRow[],
// }
// Q5 经验 742672：所有数字/映射全从接口读，绝不写死。
// Q5 ⑤ 晋升兼容：role 从 GROUP_LEADER → NORMAL_ADMIN 后 teamGroupId 变 null 属正常。

// TL 端展示 8 档（含 P1 组长档，作完整晋升路径参考）
const TL_VISIBLE_LEVELS = ['P1','P2','P3','P4','P5','P6','P7','P8'] as const;

interface LevelConfigItem {
  level: string;
  name: string;
  commission: number;
  minRevenue: number;
  maxRevenue?: number;
  targetRevenue: number;
}
function toOldShape(row: LevelV2ConfigRow, all8: LevelV2ConfigRow[]): LevelConfigItem {
  const curIdx = all8.findIndex(c => c.level === row.level);
  const next = curIdx >= 0 && curIdx < all8.length - 1 ? all8[curIdx + 1] : undefined;
  return {
    level: row.level,
    name: row.name,
    commission: Number(row.commission || 0),
    minRevenue: Number(row.minRevenue || 0),
    targetRevenue: Number(row.targetRevenue || 0),
    maxRevenue: next ? Number(next.minRevenue) : undefined,
  };
}

export interface TeamLeaderLevelInfo {
  currentLevel: string;
  currentLevelName: string;
  currentCommission: number;
  nextLevel?: string;
  nextLevelName?: string;
  nextCommission?: number;
  nextLevelThreshold?: number;
  progressToNext: number;
  revenueToNext?: number;
  isMaxLevel: boolean;
  upgradePending?: boolean;
  isManual?: boolean;
  manualLevelSetAt?: Date | null;
  /** 手动档被指定到的实际档位（展示「手动·Pn」用） */
  manualLevelLabel?: string | null;
}

/**
 * TL 端算档（P2~P8）
 *   - 手动档：按 manualLevel 指定；若被手动降到 P1（非法，TL 不应有），强制提升到 P2 展示，但保留 manualLevelLabel 提示
 *   - 自动档：若累计营收 < P2.minRevenue → 在 TL 页面按 P2 起始展示，但进度 0%，文案提示"起步期"
 */
function computeLevelForTL(params: {
  totalRevenue: number;
  cfg8: LevelV2ConfigRow[];
  manualLevel?: any;
  manualLevelSetAt?: any;
}): TeamLeaderLevelInfo {
  // 接口没返回 8 档配置时 → 全 0 空态，绝不写死任何档位
  if (!Array.isArray(params.cfg8) || params.cfg8.length === 0) {
    return {
      currentLevel: '',
      currentLevelName: '',
      currentCommission: 0,
      nextLevel: undefined,
      nextLevelName: undefined,
      nextCommission: undefined,
      nextLevelThreshold: 0,
      progressToNext: 0,
      revenueToNext: 0,
      isMaxLevel: false,
      isManual: false,
      manualLevelLabel: null,
      manualLevelSetAt: null as any,
      upgradePending: false,
    };
  }
  const v2Info: AdminLevelInfoV2 = computeAdminLevelV2({
    totalRevenue: params.totalRevenue,
    levelConfig: params.cfg8,
    manualLevel: params.manualLevel,
    manualLevelSetAt: params.manualLevelSetAt,
  });
  const p2 = params.cfg8.find(c => c.level === 'P2');
  const p8 = params.cfg8.find(c => c.level === 'P8');
  const rev = Math.max(0, Number(params.totalRevenue) || 0);

  if (v2Info.isManual) {
    // Q5 ④ TL 手动档最低 P2，禁止 P1（这里前端展示拦截一层）
    let effectiveLevel = v2Info.currentLevel;
    let belowWarning = false;
    if (effectiveLevel === 'P1') {
      effectiveLevel = 'P2';
      belowWarning = true;
    }
    const curCfg = (params.cfg8.find(c => c.level === effectiveLevel) || p2 || params.cfg8[0])!;
    return {
      currentLevel: curCfg.level,
      currentLevelName: curCfg.name,
      currentCommission: Number(curCfg.commission ?? v2Info.currentCommission ?? 0),
      progressToNext: 1,
      isMaxLevel: curCfg.level === 'P8',
      isManual: true,
      manualLevelSetAt: v2Info.manualLevelSetAt,
      manualLevelLabel: belowWarning ? `${v2Info.currentLevel}(已按TL最低P2展示)` : v2Info.currentLevel,
      upgradePending: false,
    };
  }

  // 自动档：若 < P2.minRevenue（刚晋升 TL 的起步期），进度 0%，挂在 P2
  const startLevel = p2 || params.cfg8[0];
  if (p2 && rev < Number(p2.minRevenue || 0)) {
    const nextIdx = params.cfg8.findIndex(c => c.level === 'P3');
    const next = nextIdx >= 0 ? params.cfg8[nextIdx] : undefined;
    return {
      currentLevel: startLevel.level,
      currentLevelName: startLevel.name,
      currentCommission: Number(startLevel.commission ?? v2Info.currentCommission ?? 0),
      nextLevel: next ? next.level : undefined,
      nextLevelName: next ? next.name : undefined,
      nextCommission: next ? Number(next.commission) : undefined,
      nextLevelThreshold: next ? Number(next.minRevenue) : undefined,
      progressToNext: 0,
      revenueToNext: next ? Math.max(0, Number(next.minRevenue) - rev) : 0,
      isMaxLevel: false,
      isManual: false,
      manualLevelLabel: null,
      upgradePending: false,
    };
  }

  // 正常：>= P2.minRevenue，直接用 v2 算档结果
  return {
    currentLevel: v2Info.currentLevel,
    currentLevelName: v2Info.currentLevelName || '',
    currentCommission: Number(v2Info.currentCommission ?? 0),
    nextLevel: v2Info.nextLevel,
    nextLevelName: v2Info.nextLevelName,
    nextCommission: v2Info.nextCommission,
    nextLevelThreshold: v2Info.nextLevelThreshold,
    progressToNext: Number(v2Info.progressToNext || 0),
    revenueToNext: v2Info.revenueToNext,
    isMaxLevel: v2Info.isMaxLevel || v2Info.currentLevel === 'P8',
    isManual: false,
    manualLevelLabel: null,
    upgradePending: false,
  };
  void p8;
}

type MonthlyItem = { month: string; revenue: number };
type DailyItem = { date: string; weekday: number; revenue: number };

interface PerformanceData {
  summary: {
    totalRevenue: number;
    directRevenue: number;
    /** 正确的间推合计 = groupsRevenue(组长组G) + subordinateTlRevenue(下属TL直属D)。后端返回优先直接取，没有则前端兜底相加。 */
    indirectRevenue: number;
    /** 间推中的"组长组G贡献"部分（老字段，保留调试/兼容用） */
    groupsRevenue: number;
    /** 间推中的"下属TL直属D贡献"部分（新字段，之前被漏加进间推） */
    subordinateTlRevenue?: number;
    teamFoundedAt: string;
    operatingDays: number;
  };
  /** 顶层别名：后端 B1 接口直接返回 data.directRevenue / data.indirectRevenue / data.totalRevenue，取到就直接存 */
  topLevel?: {
    directRevenue?: number;
    indirectRevenue?: number;
    totalRevenue?: number;
  };
  level: TeamLeaderLevelInfo;
  levelConfig: LevelConfigItem[]; // TL 端 P2~P8 7 档
  levelConfigV2: LevelV2ConfigRow[]; // 完整 8 档，缓存校验用
  monthly: MonthlyItem[];
  daily: DailyItem[];
  currentMonth: {
    yearMonth: string;
    daysInMonth: number;
    daysPassed: number;
    revenue: number;
    dailyAvg: number;
  };
}

const _EMPTY_CFG = (() => {
  const cfg8: LevelV2ConfigRow[] = [];
  return { cfg8, rows: [] as any[] };
})();
const EMPTY_DATA: PerformanceData = {
  summary: { totalRevenue: 0, directRevenue: 0, indirectRevenue: 0, groupsRevenue: 0, subordinateTlRevenue: 0, teamFoundedAt: '', operatingDays: 0 },
  topLevel: { directRevenue: 0, indirectRevenue: 0, totalRevenue: 0 },
  level: computeLevelForTL({ totalRevenue: 0, cfg8: _EMPTY_CFG.cfg8 }),
  levelConfig: _EMPTY_CFG.rows,
  levelConfigV2: _EMPTY_CFG.cfg8,
  monthly: [],
  daily: [],
  currentMonth: { yearMonth: '', daysInMonth: 0, daysPassed: 0, revenue: 0, dailyAvg: 0 },
};

const formatMoney = (n: number): string =>
  (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const formatMonthCN = (ym: string): string => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

const formatPct = (n: number): string => formatCommission(n);

const truncateDateOnly = (s: string | null | undefined): string | null | undefined => {
  if (s == null) return s;
  const str = String(s).trim();
  if (!str) return str;
  return str.split('T')[0].split(' ')[0];
};

const LEVEL_ICONS: Record<string, React.FC<any>> = {
  P1: Sparkles, P2: Medal, P3: Flame, P4: Trophy,
  P5: TrendingUp, P6: Layers, P7: Zap, P8: Crown,
};
function getTLTheme(level: string) {
  const t = getLevelV2Theme(level);
  const Icon = LEVEL_ICONS[level] ?? Layers;
  return {
    label: t.label,
    icon: Icon,
    gradFrom: t.cardFrom,
    gradTo: t.cardTo,
    badgeBg: t.badgeBg,
    badgeText: t.badgeText,
    badgeRing: t.badgeRing,
    barFrom: t.barFrom,
    barTo: t.barTo,
    nodeBg: t.nodeBg,
    nodeBorder: t.nodeBorder,
    nodeText: t.nodeText,
    lineFrom: t.lineFrom,
    lineTo: t.lineTo,
    rowText: t.rowText,
  };
}

const lvOrder = (lv: string) => LEVEL_V2_ORDER[lv] ?? 0;

/**
 * 页头"团队长：XX"后面的小职级徽章（极简版，与 GroupLeaderPerformance 同款视觉）
 * - P1/P2 组长档：蓝色系
 * - P3 及以上 团队长档：紫色/金色系
 * - 手动档：琥珀色底 + 扳手小图标前缀
 */
const LevelBadgeMini: React.FC<{
  level: string;
  levelName?: string;
  isManual?: boolean;
  className?: string;
}> = ({ level, isManual, className }) => {
  if (!level) return null;
  const t = getLevelV2Theme(level);
  const base =
    'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black tracking-tight leading-none border shrink-0 select-none';
  if (isManual) {
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200 ${className ?? ''}`}>
        <Wrench size={9} className="mr-0.5" />
        {level}
      </span>
    );
  }
  return (
    <span className={`${base} ${t.badgeBg} ${t.rowText} ${t.badgeBorder} ${className ?? ''}`}>
      {level}
    </span>
  );
};

const LevelCard: React.FC<{ level: TeamLeaderLevelInfo; totalRevenue: number; levelConfig: LevelConfigItem[]; }> = ({
  level,
  totalRevenue,
  levelConfig,
}) => {
  const theme = getTLTheme(level.currentLevel);
  const Icon = theme.icon;

  const progressPct = Math.round((level.progressToNext || 0) * 1000) / 10;
  const progressWidth = `${Math.max(0, Math.min(100, (level.progressToNext || 0) * 100))}%`;

  const manualDateText = (() => {
    if (!level.isManual || !level.manualLevelSetAt) return null;
    const d = new Date(level.manualLevelSetAt);
    if (Number.isNaN(d.getTime())) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  })();

  return (
    <div
      className={`mx-4 mt-5 rounded-2xl p-4 shadow-sm border border-gray-100 bg-gradient-to-br ${theme.gradFrom} ${theme.gradTo} relative overflow-hidden`}
    >
      <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/60 blur-2xl pointer-events-none" />

      {/* 第一行：职级徽章 + 自动/手动标识 + 提成大数字 */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${theme.badgeBg} ${theme.badgeRing ?? ''} flex items-center justify-center shadow-inner`}
          >
            <Icon size={18} className={theme.badgeText} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="text-[15px] font-black text-gray-800 leading-tight">
                职级{theme.label}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-gray-500 font-medium">
              当前提成比例 <span className={`font-black ${theme.rowText}`}>{formatPct(level.currentCommission)}</span>
              {level.isMaxLevel && !level.isManual && (
                <span className="ml-1.5 inline-flex items-center text-[10px] text-fuchsia-600 font-black">
                  <Crown size={11} className="mr-0.5" /> 最高级
                </span>
              )}
              {level.isManual && manualDateText && (
                <span className="ml-1.5 text-[10px] text-amber-700/90 font-semibold">· 最近调整 {manualDateText}</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-[20px] font-black leading-none tracking-tight ${theme.rowText}`}>
            {formatPct(level.currentCommission)}
          </div>
          {!level.isManual && !level.isMaxLevel && level.nextCommission !== undefined && (
            <div className="mt-1 text-[10px] text-gray-500 font-medium">
              下一级 {formatPct(level.nextCommission)}
            </div>
          )}
        </div>
      </div>

      {/* 第二行：进度条 + 文案 */}
      <div className="relative mt-4">
        <div className="w-full h-3.5 rounded-full bg-white/70 border border-white overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${theme.barFrom} ${theme.barTo} relative transition-all duration-700 ease-out`}
            style={{ width: progressWidth }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)',
                backgroundSize: '24px 100%',
              }}
            />
          </div>
        </div>

        {/* Q5 ③：手动档不展示「还差 XX」 */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          {level.isManual ? (
            <>
              <div className="text-amber-700 flex items-center space-x-1">
                <Wrench size={12} />
                <span>手动指定档位 · 不自动升降</span>
              </div>
              <div className="text-amber-700 font-black">累计业绩 ¥ {formatMoney(totalRevenue)}</div>
            </>
          ) : level.isMaxLevel ? (
            <>
              <div className="text-fuchsia-700 flex items-center space-x-1">
                <Zap size={12} />
                <span>已达最高职级，继续加油！</span>
              </div>
              <div className="text-fuchsia-700 font-black">累计业绩 ¥ {formatMoney(totalRevenue)}</div>
            </>
          ) : (
            <>
              <div className="text-gray-600">
                距离 <span className={`font-black ${theme.rowText}`}>职级{level.nextLevel}</span>
                <span className="mx-1 text-gray-400">还差</span>
                <span className="font-black text-red-600 tracking-tight">¥ {formatMoney(level.revenueToNext ?? 0)}</span>
              </div>
              <div className={`font-black ${theme.rowText}`}>{progressPct.toFixed(1)}%</div>
            </>
          )}
        </div>
      </div>

      {/* TL 8 档路径图：P1~P4 一行，P5~P8 一行（两行 4 列，避免一行 7/8 档过挤） */}
      <div className="relative mt-4 pt-3 border-t border-white/60 space-y-3">
        {[
          ['P1','P2','P3','P4'],
          ['P5','P6','P7','P8'],
        ].map((ROW, rIdx) => {
          const rowCfg = ROW.map(lv => levelConfig.find(c => c.level === lv)).filter(Boolean) as LevelConfigItem[];
          return (
            <div key={`row-${rIdx}`} className="flex items-center justify-between">
              {rowCfg.map((cfg, idx) => {
                const reached = lvOrder(cfg.level) <= lvOrder(level.currentLevel);
                const current = cfg.level === level.currentLevel;
                const coming = cfg.level === level.nextLevel;
                const CfgIcon = getTLTheme(cfg.level).icon;
                const t = getTLTheme(cfg.level);
                return (
                  <React.Fragment key={cfg.level}>
                    <div className="flex flex-col items-center space-y-0.5 min-w-0 flex-1">
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            current
                              ? `${t.nodeBg} border-white ring-2 ring-offset-1 ${t.nodeBorder.replace('border-', 'ring-')} shadow-md`
                              : reached
                              ? `${t.nodeBg} border-white/90 shadow`
                              : coming
                              ? `bg-white border-2 ${t.nodeBorder}`
                              : `bg-white ${t.nodeBorder}`
                          }`}
                        >
                          <CfgIcon
                            size={14}
                            strokeWidth={2.2}
                            className={
                              reached
                                ? `${t.nodeText}`
                                : `${t.rowText} ${coming ? '' : 'opacity-85'}`
                            }
                            fill={reached ? 'currentColor' : 'none'}
                          />
                        </div>
                        {current && (
                          <span
                            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${t.barTo.replace('to-', 'bg-')} ring-2 ring-white animate-pulse`}
                          />
                        )}
                      </div>
                      <div className={`text-[10px] font-black leading-tight ${t.rowText}`}>
                        {cfg.level}
                      </div>
                      <div className={`text-[11px] font-black leading-tight ${t.rowText}`}>
                        {formatPct(cfg.commission)}
                      </div>
                      <div
                        className={`text-[10px] leading-tight mt-0.5 whitespace-nowrap font-semibold text-gray-800`}
                        title={`达标值（minRevenue）：¥${formatMoney(cfg.minRevenue)}`}
                      >
                        ¥{(cfg.minRevenue / 10000).toFixed(0)}万
                      </div>
                    </div>
                    {idx < rowCfg.length - 1 && (() => {
                      const nextCfg = rowCfg[idx + 1];
                      const nextReached = lvOrder(nextCfg.level) <= lvOrder(level.currentLevel);
                      const isCurSegment = cfg.level === level.currentLevel;
                      return (
                        <div className="flex-1 mx-1 h-1 bg-gray-200/80 relative overflow-hidden rounded-full">
                          {(() => {
                            if (nextReached) {
                              return (
                                <div className={`absolute inset-0 bg-gradient-to-r ${t.lineFrom} ${t.lineTo}`} />
                              );
                            }
                            if (isCurSegment && !level.isMaxLevel) {
                              return (
                                <div
                                  className={`absolute inset-y-0 left-0 bg-gradient-to-r ${t.lineFrom} ${t.lineTo} transition-all duration-700 ease-out`}
                                  style={{ width: progressWidth }}
                                />
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamLeaderPerformance: React.FC<TeamLeaderPerformanceProps> = ({
  mode: modeProp,
  target,
  onBack,
}) => {
  const mode: GLPMode = modeProp === 'view-as-other' ? 'view-as-other' : 'self';
  // Q5 ⑤ 晋升兼容：currentUser 放 state，每次进入页面从 localStorage 重新拉（防止 role 缓存老的 GROUP_LEADER）
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCurrentUser());
  const refreshRoleFromLocal = useCallback(() => {
    const fresh = authService.getCurrentUser();
    if (!fresh) return;
    // Q5 ⑤ 1/2：role 从 GROUP_LEADER → NORMAL_ADMIN，需要接受
    // Q5 ⑤ 2/2：NORMAL_ADMIN 的 teamGroupId 变 null 属正常，不报警
    setCurrentUser({ ...fresh });
  }, []);

  useEffect(() => { refreshRoleFromLocal(); }, [refreshRoleFromLocal]);

  // 决定请求目标是谁：self 用登录人 id，view-as-other 用 target.groupLeaderId
  const identity = useMemo(() => {
    try {
      return resolvePerformanceIdentity(mode, currentUser as any, target || null);
    } catch (e) {
      console.warn('[TeamLeaderPerformance] resolvePerformanceIdentity fallback:', e);
      return { targetUserId: String(currentUser?.id || 'unknown'), roleMode: 'self' as GLPMode };
    }
  }, [mode, currentUser, target]);
  const targetUserId = identity.targetUserId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<PerformanceData>(EMPTY_DATA);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  // 兼容 role 大小写（后端可能返回 normal_admin / GROUP_LEADER / superadmin 等）
  const userRole = String(currentUser?.role || '').toUpperCase();
  const isTL = userRole === UserRole.NORMAL_ADMIN.toUpperCase() || userRole === 'NORMAL_ADMIN' ||
               userRole === 'SUPER_ADMIN' || userRole === 'SUPERADMIN';
  void isTL;

  const cacheKey = useMemo(
    () => {
      const suffix = targetUserId || currentUser?.id || 'unknown';
      return mode === 'view-as-other'
        ? `tl_perf_view_${suffix}`
        : `tl_perf_self_${suffix}`;
    },
    [mode, targetUserId, currentUser?.id]
  );

  const requestUrl = useMemo(() => {
    try {
      return makeTLPRequestUrl(mode, targetUserId, target?.idBag);
    } catch (e) {
      console.warn('[TeamLeaderPerformance] makeTLPRequestUrl fallback:', e);
      return '/team-leader/performance';
    }
  }, [mode, targetUserId, target?.idBag]);

  const PROJECT_START_YEAR = 2026;
  const yearOptions = useMemo(() => {
    const foundedYear = data?.summary?.teamFoundedAt
      ? new Date(data.summary.teamFoundedAt).getFullYear()
      : PROJECT_START_YEAR;
    const start = Math.max(PROJECT_START_YEAR, foundedYear);
    const arr: number[] = [];
    for (let y = currentYear; y >= start; y--) arr.push(y);
    return arr;
  }, [currentYear, data?.summary?.teamFoundedAt]);

  const fetchPerformance = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        const cached = cacheManager.get(cacheKey, 5 * 60 * 1000);
        // 认 v2 档位缓存（条数不强制：完整 8 档 / TL 7 档 / GL 1 档 都接受），只校验结构合法 + level.currentLevel 存在
        if (
          cached &&
          Array.isArray(cached.levelConfigV2) &&
          cached.levelConfigV2.length >= 1 &&
          cached.levelConfigV2.every(
            (c: any) => c && typeof c.level === 'string' && typeof c.commission === 'number'
          ) &&
          cached.summary && typeof cached.summary === 'object' &&
          cached.level && cached.level.currentLevel
        ) {
          setData(cached);
          setLoading(false);
          return;
        }
        // 兼容老缓存（结构合法的任何条数都行）
        if (
          cached &&
          Array.isArray(cached.levelConfig) &&
          cached.levelConfig.length >= 1 &&
          cached.levelConfig.every((c: any) => c && typeof c.level === 'string' && typeof c.commission === 'number') &&
          cached.summary && typeof cached.summary === 'object' &&
          cached.level?.currentLevel
        ) {
          setData(cached);
          setLoading(false);
          return;
        }
        if (cached) {
          console.warn('[TeamLeaderPerformance] 检测到脏缓存，已丢弃并重拉接口');
          cacheManager.delete(cacheKey);
        }
        setLoading(true);
      }

      try {
        let resp: any = null;
        let hasRealData = false;
        try {
          resp = await request<any>(requestUrl, { method: 'GET' });
          hasRealData = !!(resp && resp.summary && typeof resp.summary === 'object' && resp.summary.totalRevenue !== undefined);
        } catch (e) {
          console.warn('[TeamLeaderPerformance] 接口失败，显示空态（全 0）:', e);
          resp = null;
          hasRealData = false;
        }

        const summaryRevenue = hasRealData ? Number(resp?.summary?.totalRevenue ?? 0) : 0;
        // 【顶层别名优先】后端 B1 返回 data.directRevenue / data.indirectRevenue / data.totalRevenue 三个顶层字段，直接用
        // 【兼容写法】其次取 summary.directRevenue / summary.indirectRevenue
        // 【兜底自算】都没有时，indirectRevenue = groupsRevenue(组长组G) + subordinateTlRevenue(下属TL直属D，之前被漏掉了)
        const tlTopDirect  = hasRealData && typeof resp?.directRevenue === 'number'  ? resp.directRevenue  : null;
        const tlTopIndirect= hasRealData && typeof resp?.indirectRevenue === 'number'? resp.indirectRevenue: null;
        const tlTopTotal   = hasRealData && typeof resp?.totalRevenue === 'number'   ? resp.totalRevenue   : null;
        const smDirect  = hasRealData ? Number(resp?.summary?.directRevenue ?? 0) : 0;
        const smGroups  = hasRealData ? Number(resp?.summary?.groupsRevenue ?? 0) : 0;
        const smSubTl   = hasRealData ? Number(resp?.summary?.subordinateTlRevenue ?? 0) : 0;
        const smIndirect= hasRealData
          ? (typeof (resp?.summary as any)?.indirectRevenue === 'number'
              ? Number((resp?.summary as any).indirectRevenue)
              : null)
          : null;
        const directRevenue = tlTopDirect != null ? tlTopDirect : smDirect;
        const groupsRevenue = smGroups;
        const subordinateTlRevenue = smSubTl;
        // indirectRevenue 优先级：顶层别名 > summary.indirectRevenue > 兜底相加
        const indirectRevenue =
          tlTopIndirect != null
            ? tlTopIndirect
            : smIndirect != null
              ? smIndirect
              : (groupsRevenue + subordinateTlRevenue);
        const totalRevenueFinal = tlTopTotal != null ? tlTopTotal : summaryRevenue;

        // 方案A：直信后端 B1 GET /team-leader/performance 的返回，绝不自写算档
        // levelConfig 接受 3 种形态：① 外层 {list:[...], updatedAt}（B1 默认，和超管 A5.data 同结构）
        //                         ② 嵌套在 level.levelList 数组 ③ 直接数组。不强制 8 档，TL 页只看 P2~P8
        const extractRows = (raw: any): any[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'object' && Array.isArray(raw.list)) return raw.list;
          if (Array.isArray(raw.levels)) return raw.levels;
          return [];
        };
        const cfg8: LevelV2ConfigRow[] = (() => {
          const rows1 = extractRows((resp as any)?.levelConfig);
          if (rows1.length > 0) return normalizeLevelConfigV2(rows1);
          const rows2 = extractRows((resp as any)?.level?.levelList);
          if (rows2.length > 0) return normalizeLevelConfigV2(rows2);
          return [];
        })();

        // Q5 ① manualLevel / manualLevelSetAt（若后端返回 level，以 level 内嵌优先，最外层作为兜底）
        const manualLevel = hasRealData
          ? (resp?.level?.manualLevel ?? resp?.manualLevel ?? null)
          : null;
        const manualLevelSetAt = hasRealData
          ? (resp?.level?.manualLevelSetAt ?? resp?.manualLevelSetAt ?? null)
          : null;

        // 方案A核心：如果后端返回了 level.currentLevel，直接用，不再自写 computeLevelForTL 重算
        //   只有后端 level 完全缺失时才用 computeLevelForTL 作为防御兜底（此时 cfg8 空则返回全 0，不写死）
        let levelInfo: TeamLeaderLevelInfo;
        if (hasRealData && resp?.level && typeof resp.level === 'object' && resp.level.currentLevel) {
          const L: any = resp.level;
          const isManual = Boolean(L.isManual) || Boolean(manualLevel);
          levelInfo = {
            currentLevel: String(L.currentLevel),
            currentLevelName: L.currentLevelName ? String(L.currentLevelName) : '',
            currentCommission: Number(L.currentCommission ?? 0),
            nextLevel: L.nextLevel ? String(L.nextLevel) : undefined,
            nextLevelName: L.nextLevelName ? String(L.nextLevelName) : undefined,
            nextCommission: (L.nextCommission !== undefined && L.nextCommission !== null) ? Number(L.nextCommission) : undefined,
            nextLevelThreshold: (L.nextLevelThreshold !== undefined && L.nextLevelThreshold !== null) ? Number(L.nextLevelThreshold) : undefined,
            progressToNext: Math.max(0, Math.min(1, Number(L.progressToNext ?? 0))),
            revenueToNext: Math.max(0, Number(L.revenueToNext ?? 0)),
            isMaxLevel: Boolean(L.isMaxLevel || (L.nextLevel == null && L.currentLevel === 'P8')),
            isManual,
            manualLevelLabel: isManual ? String(L.manualLevelLabel ?? manualLevel ?? L.currentLevel) : null,
            manualLevelSetAt: (L.manualLevelSetAt ?? manualLevelSetAt ?? null) as any,
            upgradePending: Boolean(L.upgradePending),
          };
        } else {
          levelInfo = computeLevelForTL({
            totalRevenue: summaryRevenue, cfg8,
            manualLevel, manualLevelSetAt,
          });
        }

        // TL 展示 8 档：保证上下两行各 4 个对称。后端 B1（TL 业绩）通常只返回 P2~P8，缺少 P1 时 UI 兜底补组长占位行（6% 提成 / 0 万目标）
        const cfg8Padded: LevelV2ConfigRow[] = cfg8.slice();
        if (!cfg8Padded.some(c => c.level === 'P1')) {
          cfg8Padded.unshift({
            level: 'P1',
            name: '组长',
            commission: 0.05,
            minRevenue: 0,
            targetRevenue: 0,
            role: UserRole.GROUP_LEADER as any,
          });
        }
        const tlRows = cfg8Padded
          .filter(c => TL_VISIBLE_LEVELS.includes(c.level as any))
          .map(c => toOldShape(c, cfg8Padded));

        const normalized: PerformanceData = {
          summary: {
            totalRevenue: totalRevenueFinal,
            directRevenue,
            indirectRevenue,
            groupsRevenue,
            subordinateTlRevenue,
            teamFoundedAt: hasRealData ? (resp?.summary?.teamFoundedAt ?? '') : '',
            operatingDays: hasRealData ? Number(resp?.summary?.operatingDays ?? 0) : 0,
          },
          topLevel: {
            directRevenue: tlTopDirect != null ? tlTopDirect : undefined,
            indirectRevenue: tlTopIndirect != null ? tlTopIndirect : undefined,
            totalRevenue: tlTopTotal != null ? tlTopTotal : undefined,
          },
          level: levelInfo,
          levelConfig: tlRows,
          levelConfigV2: cfg8Padded,
          monthly: hasRealData && Array.isArray(resp?.monthly)
            ? resp.monthly.map((m: any) => ({
                month: String(m.month || ''),
                revenue: Number(m.revenue ?? 0),
              }))
            : [],
          daily: hasRealData && Array.isArray(resp?.daily)
            ? resp.daily.map((d: any) => ({
                date: String(d.date || ''),
                weekday: Number(d.weekday ?? 0),
                revenue: Number(d.revenue ?? 0),
              }))
            : [],
          currentMonth: {
            yearMonth: hasRealData ? (resp?.currentMonth?.yearMonth ?? '') : '',
            daysInMonth: hasRealData ? Number(resp?.currentMonth?.daysInMonth ?? 0) : 0,
            daysPassed: hasRealData ? Number(resp?.currentMonth?.daysPassed ?? 0) : 0,
            revenue: hasRealData ? Number(resp?.currentMonth?.revenue ?? 0) : 0,
            dailyAvg: hasRealData ? Number(resp?.currentMonth?.dailyAvg ?? 0) : 0,
          },
        };

        setData(normalized);
        if (hasRealData) cacheManager.set(cacheKey, normalized);
      } catch (e) {
        console.error('[TeamLeaderPerformance] 拉取失败:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, requestUrl]
  );

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const filteredMonthly = useMemo(() => {
    return data.monthly
      .filter((m) => (m.month || '').startsWith(String(selectedYear)))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [data.monthly, selectedYear]);

  const operatingDaysText = useMemo(() => {
    if (data.summary.operatingDays > 0) return `${data.summary.operatingDays} 天`;
    if (data.summary.teamFoundedAt) {
      const ms = Date.now() - new Date(data.summary.teamFoundedAt).getTime();
      const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
      return `${days} 天`;
    }
    return '-- 天';
  }, [data.summary.operatingDays, data.summary.teamFoundedAt]);

  const currentMonthRevenue =
    data.currentMonth.revenue > 0
      ? data.currentMonth.revenue
      : data.daily.reduce((s, d) => s + d.revenue, 0);

  const currentMonthTitle = useMemo(() => {
    if (data.currentMonth.yearMonth) return formatMonthCN(data.currentMonth.yearMonth);
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月`;
  }, [data.currentMonth.yearMonth]);

  const handleRefresh = () => {
    cacheManager.delete(cacheKey);
    refreshRoleFromLocal(); // Q5 ⑤：刷新时重新拉 role
    fetchPerformance(true);
  };

  // totalRevenue === directRevenue + indirectRevenue 恒等式校验；不等时附带 groups/subTl 明细方便调试
  const total = Number(data.summary.totalRevenue) || 0;
  const d = Number(data.summary.directRevenue) || 0;
  const ind = Number(data.summary.indirectRevenue) || 0;
  const g = Number(data.summary.groupsRevenue) || 0;
  const st = Number(data.summary.subordinateTlRevenue || 0);
  if (total > 0 && Math.abs(total - (d + ind)) > 0.01) {
    console.warn(
      `[TeamLeaderPerformance] 业绩对账警告：totalRevenue(${total}) ≠ directRevenue(${d}) + indirectRevenue(${ind}), 差值 ${(total - d - ind).toFixed(4)}\n` +
      `  间推拆解：groupsRevenue=${g} + subordinateTlRevenue=${st} = ${(g + st).toFixed(4)}`
    );
  }
  // 另一条一致性校验：indirectRevenue 应该等于 groups+subTl（除非后端用了更复杂的算法），如果差异超过 1 分钱也提示一下
  if (ind > 0 && st > 0 && Math.abs(ind - (g + st)) > 0.01) {
    console.info(
      `[TeamLeaderPerformance] indirectRevenue(${ind}) ≠ groupsRevenue(${g}) + subordinateTlRevenue(${st})，后端可能使用了额外维度合并`
    );
  }

  const showViewAsOtherHeader = mode === 'view-as-other';

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-6">
      {/* 顶部标题栏 */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {showViewAsOtherHeader && (
            <button
              type="button"
              onClick={() => { onBack?.(); }}
              className="w-9 h-9 -ml-1 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition shrink-0"
              aria-label="返回"
            >
              <ArrowLeft size={17} className="text-gray-600" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] flex items-center justify-center shadow-md shrink-0">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-black text-gray-800 tracking-tight truncate">业绩看板</div>
            {showViewAsOtherHeader && target && (
              <div className="text-[11px] text-gray-400 font-medium mt-0.5 truncate flex items-center">
                <span>
                  来自 <span className="text-gray-500 font-semibold">{target.fromGroupName || '组'}</span>
                </span>
                <span className="mx-1 text-gray-300">·</span>
                <span className="inline-flex items-center">
                  团队长 <span className="text-gray-600 font-semibold">{target.groupLeaderName || '未知'}</span>
                  {!loading && data.level.currentLevel && (
                    <LevelBadgeMini
                      level={data.level.currentLevel}
                      levelName={data.level.currentLevelName}
                      isManual={data.level.isManual}
                      className="ml-1.5"
                    />
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ① 累计总业绩大卡（直属 / 各组汇总 拆分） */}
      <div className="mx-4 rounded-2xl p-5 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#60A5FA] text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -right-20 bottom-0 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

        <div className="flex items-center space-x-2 text-blue-100 text-[11px] font-semibold opacity-90">
          <Wallet size={13} />
          <span>团队成立至今累计业绩</span>
        </div>

        <div className="mt-2 flex flex-col items-center">
          <div className="flex items-end space-x-2">
            <div className="text-[12px] font-bold text-blue-100/90 mb-1.5">¥</div>
            {loading ? (
              <div className="h-10 w-40 bg-white/15 rounded-lg animate-pulse" />
            ) : (
              <div className="text-[34px] font-black tracking-tight leading-none">
                {formatMoney(data.summary.totalRevenue)}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-center text-[11.5px] text-blue-100/85 font-medium tracking-tight">
            直推业绩：¥{formatMoney(data.summary.directRevenue)}
            <span className="mx-1.5 text-blue-200/60">｜</span>
            间推业绩 ¥{formatMoney(data.summary.indirectRevenue)}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-1 text-blue-100/90">
            <Calendar size={12} />
            <span>
              团队成立于{' '}
              {data.summary.teamFoundedAt ? truncateDateOnly(data.summary.teamFoundedAt) : '----年--月--日'}
            </span>
          </div>
          <div className="flex items-center space-x-1 bg-white/15 px-2.5 py-1 rounded-full font-semibold">
            <TrendingUp size={12} />
            <span>已运营 {operatingDaysText}</span>
          </div>
        </div>
      </div>

      {/* ② 职级卡片（P2~P8 7 档） */}
      <LevelCard level={data.level} totalRevenue={data.summary.totalRevenue} levelConfig={data.levelConfig} />

      {/* ③ 本月每日业绩 */}
      <div className="mx-4 mt-5 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <BarChart3 size={14} className="text-amber-600" />
            </div>
            <div>
              <div className="text-[14px] font-black text-gray-800">
                {currentMonthTitle} 每日业绩
              </div>
              <div className="text-[10px] text-gray-400">
                {data.currentMonth.daysPassed > 0
                  ? `已过 ${data.currentMonth.daysPassed} 天 / 共 ${data.currentMonth.daysInMonth || '?'} 天`
                  : '截至昨日'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400">本月截至昨日</div>
            <div className="text-[14px] font-black text-blue-700">
              ¥ {formatMoney(currentMonthRevenue)}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data.daily.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-gray-400">
            <BarChart3 size={28} className="opacity-40 mb-2" />
            <div className="text-[12px] font-medium">本月暂无每日业绩明细</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...data.daily]
              .sort((a, b) => (a.date && b.date ? b.date.localeCompare(a.date) : 0))
              .map((d) => {
                const dayStr = d.date ? d.date.slice(8).replace(/^0/, '') : '--';
                return (
                  <div
                    key={d.date}
                    className="flex items-center justify-between space-x-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-14 flex-shrink-0">
                      <div className="text-[13px] font-black text-gray-700 leading-none">{dayStr}日</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-[14px] font-black text-gray-900 tracking-tight">
                        ¥ {formatMoney(d.revenue)}
                      </span>
                    </div>
                  </div>
                );
              })}

            <div className="mt-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-sky-700/80 font-semibold">本月日均</div>
                <div className="text-[14px] font-black text-sky-700">
                  ¥ {formatMoney(data.currentMonth.dailyAvg > 0 ? data.currentMonth.dailyAvg :
                    data.currentMonth.daysPassed > 0
                      ? currentMonthRevenue / data.currentMonth.daysPassed
                      : 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-blue-700/80 font-semibold">本月合计</div>
                <div className="text-[14px] font-black text-blue-700">
                  ¥ {formatMoney(currentMonthRevenue)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ④ 过往月份业绩 */}
      <div className="mx-4 mt-5 mb-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Calendar size={14} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-[14px] font-black text-gray-800">过往月份业绩</div>
              <div className="text-[10px] text-gray-400">按年份筛选，倒序展示</div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setYearPickerOpen((v) => !v)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-[12px] font-bold text-gray-700 active:bg-gray-100"
            >
              <span>{selectedYear} 年</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {yearPickerOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setYearPickerOpen(false)} />
                <div className="absolute right-0 mt-2 w-28 max-h-52 overflow-y-auto rounded-xl bg-white border border-gray-100 shadow-lg z-40 py-1">
                  {yearOptions.map((y) => (
                    <button
                      key={y}
                      onClick={() => {
                        setSelectedYear(y);
                        setYearPickerOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[12px] ${
                        y === selectedYear
                          ? 'text-blue-600 font-bold bg-blue-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {y} 年
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 w-full bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredMonthly.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-gray-400">
            <Coins size={28} className="opacity-40 mb-2" />
            <div className="text-[12px] font-medium">{selectedYear} 年暂无业绩记录</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredMonthly.map((m) => (
              <div
                key={m.month}
                className="flex items-center justify-between space-x-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-shrink-0">
                  <div className="text-[13px] font-black text-gray-700 leading-none">
                    {formatMonthCN(m.month)}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-[14px] font-black text-gray-900 tracking-tight">
                    ¥ {formatMoney(m.revenue)}
                  </span>
                </div>
              </div>
            ))}

            {(() => {
              const yearTotal = filteredMonthly.reduce((sum, m) => sum + Number(m.revenue || 0), 0);
              const yearAvg = filteredMonthly.length ? yearTotal / filteredMonthly.length : 0;
              return (
                <div className="mt-3 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-sky-700/80 font-semibold">
                      {selectedYear} 年月均
                    </div>
                    <div className="text-[14px] font-black text-sky-700">
                      ¥ {formatMoney(yearAvg)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-blue-700/80 font-semibold">
                      {selectedYear} 年合计
                    </div>
                    <div className="text-[14px] font-black text-blue-700">
                      ¥ {formatMoney(yearTotal)}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamLeaderPerformance;
