import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Coins, Calendar, TrendingUp, BarChart3, RefreshCw,
  ChevronDown, Wallet, Sparkles, Medal, Trophy, Crown, Zap, Flame, ArrowLeft, Wrench, Layers
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
  makeGLPCacheKey,
  makeGLPRequestUrl,
  resolvePerformanceIdentity,
} from '../utils/viewGroupLeaderPerformance';
import {
  LEVEL_V2_ORDER,
  LEVEL_V2_FALLBACK_8,
  LEVEL_V2_API,
  computeAdminLevelV2,
  formatCommission,
  getLevelV2Theme,
  normalizeLevelConfig as normalizeLevelConfigV2,
  type AdminLevelInfoV2,
  type LevelV2ConfigRow,
} from '../utils/levelV2Service';

export interface GroupLeaderPerformanceProps {
  mode?: GLPMode;
  /** 仅 mode='view-as-other' 需要，代表要看的目标组长 + 来源组名 */
  target?: ViewGroupLeaderTarget | null;
  /** 仅 view-as-other 模式生效：点顶栏返回按钮回调 */
  onBack?: () => void;
}

// ============== 后端接口约定（对齐 Q5 硬规则） ==============
// GET /group-leader/performance  (?userId=xxx 用于 TL/SA 看别人)
// Response:
// {
//   summary: { totalRevenue, teamFoundedAt, operatingDays, groupName? },
//   // Q5 ① manualLevel / manualLevelSetAt 来源 Admin.js
//   manualLevel?: 'P1'~'P8' | null,
//   manualLevelSetAt?: string | number | Date,
//   // （可选）后端若返回了 level 就优先，否则前端按 totalRevenue + v2 档位表本地算
//   level?: { currentLevel, currentLevelName, currentCommission, ... },
//   monthly: [{ month: 'YYYY-MM', revenue }],
//   daily:   [{ date: 'YYYY-MM-DD', weekday: 1-7, revenue }],
//   currentMonth: { yearMonth, daysInMonth, daysPassed, revenue, dailyAvg },
//   levelConfig?: LevelV2ConfigRow[],  // v2 统一 8 档（没有则走 FALLBACK_8 兜底）
// }
// Q5 经验 742672：前端不写死任何数字/映射，全从接口读。
// 新职级 v2：P1=组长，P2~P8=团队长。组长界面只展示 P1；超过自动晋升线的提示切 TL 页面。
// Q5 ⑤ 晋升兼容：role 从 GROUP_LEADER → NORMAL_ADMIN 后 teamGroupId 变 null 属正常，
//   前端若本地缓存了 role，下一次进入页面要强制刷新 currentUser。
// ============================================================

/** 把 v2 行映射回旧 LevelConfigItem（只给 GL 端的 P1 用，用于 LevelCard levelConfig prop） */
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

export interface GroupLeaderLevelInfo {
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
  /** v2 手动档 */
  isManual?: boolean;
  /** v2 最近一次手动调档时间 */
  manualLevelSetAt?: Date | null;
  /** v2：实际手动指定的档位（可能为 P2+，用于「手动·Pn」展示 */
  manualLevelLabel?: string | null;
}

/**
 * 组长端算档（与团队长端完全一致，8 档 v2 统一路径，不强制 P2）：
 *   - 手动档：直接按 manualLevel 指定的档位（P1~P8 都允许，组长端支持 P1）
 *   - 自动档：< P2.minRevenue → 进度挂在 P1→P2；≥ P2.minRevenue → 直接按 computeAdminLevelV2 返回档位
 */
function computeLevelForGL(params: {
  totalRevenue: number;
  cfg8: LevelV2ConfigRow[];
  manualLevel?: any;
  manualLevelSetAt?: any;
}): GroupLeaderLevelInfo {
  // 接口没返回 8 档配置时 → 全 0 空态，绝不写死任何档位
  if (!Array.isArray(params.cfg8) || params.cfg8.length === 0) {
    return {
      currentLevel: 'P1',
      currentLevelName: '',
      currentCommission: 0,
      nextLevel: undefined,
      nextLevelName: undefined,
      nextCommission: undefined,
      nextLevelThreshold: undefined,
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
  const p1 = params.cfg8.find(c => c.level === 'P1');
  const p2 = params.cfg8.find(c => c.level === 'P2');
  const rev = Math.max(0, Number(params.totalRevenue) || 0);

  if (v2Info.isManual) {
    // 组长端允许 P1 手动档（不做 TL 端的最低 P2 拦截），按实际被指定的档位渲染
    const effectiveLevel = v2Info.currentLevel || (p1?.level ?? 'P1');
    const curCfg = (params.cfg8.find(c => c.level === effectiveLevel) || p1 || params.cfg8[0])!;
    return {
      currentLevel: curCfg.level,
      currentLevelName: curCfg.name,
      currentCommission: Number(curCfg.commission ?? v2Info.currentCommission ?? 0),
      progressToNext: 1,
      isMaxLevel: curCfg.level === 'P8',
      isManual: true,
      manualLevelSetAt: v2Info.manualLevelSetAt,
      manualLevelLabel: v2Info.currentLevel, // 实际被指定到的档位 P1~P8
      upgradePending: false,
    };
  }

  // 自动档：若 < P2.minRevenue（组长起步期），进度 0%，挂在 P1，下一档 P2
  if (p1 && (!p2 || rev < Number(p2.minRevenue || 0))) {
    const next = p2;
    const nextThreshold = next ? Number(next.minRevenue || 0) : 0;
    const progress = nextThreshold > 0 ? Math.max(0, Math.min(1, rev / nextThreshold)) : 0;
    return {
      currentLevel: p1.level,
      currentLevelName: p1.name,
      currentCommission: Number(p1.commission ?? v2Info.currentCommission ?? 0),
      nextLevel: next ? next.level : undefined,
      nextLevelName: next ? next.name : undefined,
      nextCommission: next ? Number(next.commission) : undefined,
      nextLevelThreshold: nextThreshold > 0 ? nextThreshold : undefined,
      progressToNext: next ? progress : 1,
      revenueToNext: next ? Math.max(0, nextThreshold - rev) : 0,
      isMaxLevel: !next,
      isManual: false,
      manualLevelLabel: null,
      upgradePending: false,
    };
  }

  // 正常：≥ P2.minRevenue，直接按 v2 算档结果（8 档路径和团队长完全一致）
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
}

type MonthlyItem = { month: string; revenue: number };
type DailyItem = { date: string; weekday: number; revenue: number };

interface PerformanceData {
  summary: {
    totalRevenue: number;
    teamFoundedAt: string;
    operatingDays: number;
    groupName?: string;
  };
  level: GroupLeaderLevelInfo;
  levelConfig: LevelConfigItem[]; // 组长端只有 P1 1 行；用于渲染卡片和路径图
  levelConfigV2: LevelV2ConfigRow[]; // v2 完整 8 档，缓存需要校验
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
  return { cfg8, glRows: [] as any[] };
})();
const EMPTY_DATA: PerformanceData = {
  summary: { totalRevenue: 0, teamFoundedAt: '', operatingDays: 0, groupName: '' },
  level: computeLevelForGL({ totalRevenue: 0, cfg8: _EMPTY_CFG.cfg8 }),
  levelConfig: _EMPTY_CFG.glRows,
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

// 百分比格式化：0.08 → "8%"，0.085 → "8.5%"（统一走 v2 util）
const formatPct = (n: number): string => formatCommission(n);

const truncateDateOnly = (s: string | null | undefined): string | null | undefined => {
  if (s == null) return s;
  const str = String(s).trim();
  if (!str) return str;
  return str.split('T')[0].split(' ')[0];
};

// Q5 ② 提成比例 3 场景分清楚：
//   1) 本页「当前提成比例」= Admin.commission（= v2 档位表 P1.commission，晋升已写入）
//   2) 配置页 = /api/admin/level-config/v2 返回的 list[i].commission（由超管配置页组件自己渲染）
//   3) 历史订单提成 = GoldLog 固化字段，**绝不用当前档位反算**（订单明细不在此页，本条是注释提醒后续同学）
// 本页不直接展示历史订单提成，这里不做订单相关逻辑。

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
 * 页头"组长：XX"后面的小职级徽章（极简版本）
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
  // 背景用渐变（badgeBg）、边框 badgeBorder，文字色不用 badgeText（是白色，只适合大图标徽章），改用 rowText
  return (
    <span className={`${base} ${t.badgeBg} ${t.rowText} ${t.badgeBorder} ${className ?? ''}`}>
      {level}
    </span>
  );
};

/**
 * 职级卡片：显示当前 P 级、提成比例、到下一级的进度条和差值
 * v2 新增：手动档时显示「手动·Pn」+ 最近调整时间，不展示"还差XX升下一档"
 */
const LevelCard: React.FC<{ level: GroupLeaderLevelInfo; totalRevenue: number; levelConfig: LevelConfigItem[]; }> = ({
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

        {/* 手动档 / 最高级 / 正常三级分支（和团队长完全一致的格式） */}
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

      {/* 8 档路径图：P1~P4 一行，P5~P8 一行（和团队长页面一模一样） */}
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

const GroupLeaderPerformance: React.FC<GroupLeaderPerformanceProps> = ({
  mode: modeProp,
  target,
  onBack,
}) => {
  const mode: GLPMode = modeProp === 'view-as-other' ? 'view-as-other' : 'self';
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCurrentUser());

  // Q5 ⑤ 晋升兼容 1/2：role 刷新
  // 如果本地缓存 role 还是 GROUP_LEADER，但 currentUser.commission >= P2 比例或其他迹象表明可能已晋升，
  // 进入页面时主动刷新一次 currentUser（重新解析 localStorage，避免写死老角色）。
  // 这里把 currentUser 放 state，若以后登录态接口补齐，可在 refreshRole 里调。
  const refreshRoleFromLocal = useCallback(() => {
    const fresh = authService.getCurrentUser();
    if (!fresh) return;
    // role 兼容：NORMAL_ADMIN 时 teamGroupId = null 是正常（Q5 ⑤ 2/2），这里不做 !teamGroupId 报警
    setCurrentUser(fresh);
  }, []);

  useEffect(() => {
    // 首次进入：尝试从 localStorage 重新拉 currentUser，覆盖闭包中老的 role
    refreshRoleFromLocal();
  }, [refreshRoleFromLocal]);

  // 决定请求目标是谁
  const identity = useMemo(() => {
    try {
      return resolvePerformanceIdentity(mode, currentUser as any, target || null);
    } catch (e) {
      console.warn('[GroupLeaderPerformance] resolvePerformanceIdentity fallback:', e);
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

  const cacheKey = useMemo(() => {
    try {
      return makeGLPCacheKey(mode, String(currentUser?.id || ''), targetUserId);
    } catch (e) {
      return `gl_perf_fallback_${targetUserId}`;
    }
  }, [mode, currentUser?.id, targetUserId]);

  const requestUrl = useMemo(
    () => {
      try {
        return makeGLPRequestUrl(mode, targetUserId, target?.idBag);
      } catch (e) {
        console.warn('[GroupLeaderPerformance] makeGLPRequestUrl fallback:', e);
        return '/group-leader/performance';
      }
    },
    [mode, targetUserId, target?.idBag]
  );

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
        // 组长级业绩页面 = 必须 8 档完整（缓存必须 levelConfigV2.length === 8 才视为合法）
        if (
          cached &&
          Array.isArray(cached.levelConfigV2) &&
          cached.levelConfigV2.length === 8 &&
          cached.levelConfigV2.every(
            (c: any) => c && typeof c.level === 'string' && typeof c.commission === 'number'
          ) &&
          cached.summary &&
          typeof cached.summary === 'object' &&
          cached.level &&
          cached.level.currentLevel &&
          Array.isArray(cached.levelConfig) &&
          cached.levelConfig.length === 8
        ) {
          setData(cached);
          setLoading(false);
          return;
        }
        // 旧缓存条数不是 8 档 → 丢弃
        if (cached) {
          console.warn('[GroupLeaderPerformance] 旧缓存非8档，丢弃并重拉接口');
          cacheManager.delete(cacheKey);
        }
        setLoading(true);
      }

      try {
        // ① 请求：GL业绩接口（只调这一个）。
        //   ⚠️ 历史背景：之前用第二个并行请求调 /team-leader/performance 想拿真实档位，
        //      但后端 /team-leader/performance 会做角色鉴权——目标角色不是 TL 直接 403
        //      （组长卡被传进去也会 403）。按 project_memory 硬规则：
        //      - GL /group-leader/performance 的 levelConfig 已经是合并后完整的 8 条
        //        （GL P1 + TL P2~P8），每条含 level/name/commission/minRevenue/targetRevenue/role
        //      → 档位直接从 GL 接口的 levelConfig 读，不需要再跨接口借 TL 的。
        //   兜底：如果 GL 接口 levelConfig 条数不足（后端未上线过渡期），再从
        //        LEVEL_V2_API.list + LEVEL_V2_FALLBACK_8 补齐。
        let resp: any = null;
        try {
          resp = await request<any>(requestUrl, { method: 'GET' });
        } catch (e) {
          console.warn('[GroupLeaderPerformance] GL业绩接口失败，空态：', e);
          resp = null;
        }

        const hasRealData = !!(resp && resp.summary && typeof resp.summary === 'object');
        const summaryRevenue = hasRealData ? Number(resp?.summary?.totalRevenue ?? 0) : 0;

        const extractRows = (raw: any): any[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'object' && Array.isArray(raw.list)) return raw.list;
          if (Array.isArray(raw.levels)) return raw.levels;
          return [];
        };

        // ② cfg8 合并：GL接口 levelConfig（最高优先级，项目memory已确认=完整8条）
        //            → LEVEL_V2_API.list（/admin/team-leader+group-leader 档，注意：GL 无 admin 权限会 403，已 catch null）
        //            → LEVEL_V2_FALLBACK_8（兜底）
        //   注：LEVEL_V2_API.list 即便失败也只是少了一次更新机会，GL 接口返回的 8 条已经够用
        let v2Rows: any[] = [];
        try {
          const v2 = await LEVEL_V2_API.list();
          v2Rows = Array.isArray(v2?.rows) ? v2.rows : [];
        } catch (e) {
          console.warn('[GroupLeaderPerformance] LEVEL_V2_API.list 失败（无权限/网络），仅用 GL 接口返回档：', e);
          v2Rows = [];
        }
        const perfRows = hasRealData
          ? (() => {
              const r1 = extractRows((resp as any)?.levelConfig);
              if (r1.length > 0) return r1;
              const r2 = extractRows((resp as any)?.level?.levelList);
              return r2;
            })()
          : [];
        const cfg8: LevelV2ConfigRow[] = (() => {
          // 按 level 唯一合并，优先级：GL接口 levelConfig → V2_API（独立档口）→ fallback
          const map = new Map<string, any>();
          const pushAll = (arr: any[]) => arr.forEach((r: any) => {
            const k = String(r?.level || '').toUpperCase();
            if (!k) return;
            if (!map.has(k)) map.set(k, { ...r });
          });
          pushAll(perfRows);
          pushAll(v2Rows);
          pushAll(LEVEL_V2_FALLBACK_8.slice());
          const merged = Array.from(map.values());
          const normalized = normalizeLevelConfigV2(merged.length > 0 ? merged : LEVEL_V2_FALLBACK_8);
          // 保底：P1~P8 每个档位都必须有，缺的用 fallback 对应档位补齐
          const LEVEL_8_ORDER = ['P1','P2','P3','P4','P5','P6','P7','P8'] as const;
          const out: any[] = [];
          for (const lv of LEVEL_8_ORDER) {
            const got = normalized.find((c: any) => String(c.level) === lv);
            out.push(got ?? (LEVEL_V2_FALLBACK_8.find(f => f.level === lv) as any));
          }
          return normalizeLevelConfigV2(out);
        })();

        // ③ 手动档标志：无论后端返回什么 shape，都从 resp 提取，传给 computeLevelForGL
        const manualLevel = hasRealData
          ? (resp?.level?.manualLevel ?? resp?.manualLevel ?? null)
          : null;
        const manualLevelSetAt = hasRealData
          ? (resp?.level?.manualLevelSetAt ?? resp?.manualLevelSetAt ?? null)
          : null;
        // 若后端 level.isManual=true 但 manualLevel=null（简写），manualLevel 就用 currentLevel 兜底（computeAdminLevelV2 能正确识别）
        const finalManualLevel = (() => {
          if (manualLevel) return manualLevel;
          if (hasRealData && (resp?.level?.isManual || resp?.isManual)) return resp?.level?.currentLevel ?? resp?.currentLevel ?? null;
          return null;
        })();
        const finalManualSetAt = (() => {
          if (manualLevelSetAt) return manualLevelSetAt;
          if (hasRealData && (resp?.level?.isManual || resp?.isManual)) return (resp?.level?.manualLevelSetAt ?? resp?.level?.manualLevelSetAt ?? resp?.manualLevelSetAt ?? resp?.manualLevelSetAt ?? null) as any;
          return null;
        })();

        // ④ levelInfo 一律走 computeLevelForGL 重算（保证 nextLevel / nextCommission / progressToNext 正确和团队长完全一致）
        //    —— 不再直信后端 resp.level（B2组长接口可能缺 nextLevel，导致「距离 职级 还差…」没 P2 文案）
        const levelInfo: GroupLeaderLevelInfo = computeLevelForGL({
          totalRevenue: summaryRevenue,
          cfg8,
          manualLevel: finalManualLevel,
          manualLevelSetAt: finalManualSetAt,
        });

        // ⑤ 组长端 8 档全量：和团队长完全一样，P1~P8 按顺序渲染（cfg8 已保证 8 条齐全）
        const LEVEL_8_ORDER = ['P1','P2','P3','P4','P5','P6','P7','P8'] as const;
        const glRows: any[] = [];
        for (const lv of LEVEL_8_ORDER) {
          const cfg = cfg8.find(c => c.level === lv);
          if (cfg) glRows.push(toOldShape(cfg, cfg8));
        }

        const normalized: PerformanceData = {
          summary: {
            totalRevenue: summaryRevenue,
            teamFoundedAt: hasRealData ? (resp?.summary?.teamFoundedAt ?? '') : '',
            operatingDays: hasRealData ? Number(resp?.summary?.operatingDays ?? 0) : 0,
            groupName: hasRealData
              ? (resp?.summary?.groupName ?? (mode === 'view-as-other' ? (target?.fromGroupName || '') : (currentUser?.groupName ?? '')))
              : (mode === 'view-as-other' ? (target?.fromGroupName || '') : (currentUser?.groupName ?? '')),
          },
          level: levelInfo,
          levelConfig: glRows,
          levelConfigV2: cfg8,
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
        if (hasRealData) {
          cacheManager.set(cacheKey, normalized);
        }
      } catch (e) {
        console.error('[GroupLeaderPerformance] 拉取失败:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheKey, requestUrl, mode, currentUser?.groupName, target?.fromGroupName]
  );

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const filteredMonthly = useMemo(() => {
    return data.monthly
      .filter((m) => (m.month || '').startsWith(String(selectedYear)))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [data.monthly, selectedYear]);

  void filteredMonthly;

  const operatingDaysText = useMemo(() => {
    if (data.summary.operatingDays > 0) return `${data.summary.operatingDays} 天`;
    if (data.summary.teamFoundedAt) {
      const ms = Date.now() - new Date(data.summary.teamFoundedAt).getTime();
      const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
      return `${days} 天`;
    }
    return '-- 天';
  }, [data.summary.operatingDays, data.summary.teamFoundedAt]);

  const groupName =
    data.summary.groupName || currentUser?.groupName || currentUser?.teamName || '本组';

  void groupName;

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
    // Q5 ⑤：刷新前刷新一次本地 currentUser，确保晋升后 role 是最新的
    refreshRoleFromLocal();
    fetchPerformance(true);
  };

  const showViewAsOtherHeader = mode === 'view-as-other';

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-6">
      {/* 顶部标题栏 */}
      <div className="px-5 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {showViewAsOtherHeader && (
            <button
              type="button"
              onClick={() => { onBack?.(); }}
              className="w-9 h-9 -ml-1 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition"
              aria-label="返回"
            >
              <ArrowLeft size={17} className="text-gray-600" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] flex items-center justify-center shadow-md shrink-0">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-black text-gray-800 tracking-tight truncate">
              业绩看板
            </div>
            {showViewAsOtherHeader && target && (
              <div className="text-[11px] text-gray-400 font-medium mt-0.5 truncate flex items-center">
                <span>
                  来自 <span className="text-gray-500 font-semibold">{target.fromGroupName || '组'}</span>
                </span>
                <span className="mx-1 text-gray-300">·</span>
                <span className="inline-flex items-center">
                  组长 <span className="text-gray-600 font-semibold">{target.groupLeaderName || '未知'}</span>
                  {!loading && data.level.currentLevel && (
                    <LevelBadgeMini level={data.level.currentLevel} levelName={data.level.currentLevelName} isManual={data.level.isManual} className="ml-1.5" />
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm active:scale-95 transition-transform disabled:opacity-50 shrink-0 ml-2"
        >
          <RefreshCw
            size={16}
            className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* ① 累计总业绩大卡 */}
      <div className="mx-4 rounded-2xl p-5 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#60A5FA] text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -right-20 bottom-0 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

        <div className="flex items-center space-x-2 text-blue-100 text-[11px] font-semibold opacity-90">
          <Wallet size={13} />
          <span>团队成立至今累计业绩</span>
        </div>

        <div className="mt-2 flex items-end space-x-2">
          <div className="text-[12px] font-bold text-blue-100/90 mb-1.5">¥</div>
          {loading ? (
            <div className="h-10 w-40 bg-white/15 rounded-lg animate-pulse" />
          ) : (
            <div className="text-[34px] font-black tracking-tight leading-none">
              {formatMoney(data.summary.totalRevenue)}
            </div>
          )}
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

      {/* ② 职级 & 升级进度卡片 */}
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
                      <div className="text-[13px] font-black text-gray-700 leading-none">
                        {dayStr}日
                      </div>
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

      {/* ④ 过往月份业绩（年份下拉） */}
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

export default GroupLeaderPerformance;
