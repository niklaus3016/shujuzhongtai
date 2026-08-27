import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Wallet, Coins, Eye, Users, BarChart3,
  TrendingUp, TrendingDown, Clock, Zap,
  Building2, ArrowRightLeft, UsersRound, Target, UserPlus, Activity
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { cacheManager } from '../services/cacheManager';

interface TeamLeaderDashboardProps {
  timeRange: string;
  onRefresh: () => void;
  onDataLoaded?: () => void;
  currentUser?: any;
}

type KpiCard = {
  title: string;
  value: string;
  growth?: string;
  isUp?: boolean;
  subValue?: string;
  icon: any;
  color: string;
  bg: string;
  dim?: boolean;
};

type KpiSections = {
  summary: KpiCard[];       // 团队汇总 2 张
  direct: KpiCard[];        // 直推 3 张
  indirect: KpiCard[];      // 间推 3 张
  directMgmt: KpiCard[];    // 直推管理 3 张
  indirectMgmt: KpiCard[];  // 间推管理 3 张
};

const TIME_RANGE_TO_PARAM: Record<string, string> = {
  '今日': 'today',
  '昨日': 'yesterday',
  '本周': 'week',
  '本月': 'month',
};
const TIME_RANGE_TO_PREFIX: Record<string, string> = {
  '今日': '今日',
  '昨日': '昨日',
  '本周': '本周',
  '本月': '本月',
};

const fmtMoney = (v: number) =>
  `¥${(Number.isFinite(v) ? v : 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtCount = (v: number) =>
  `${(Number.isFinite(v) ? Math.round(v) : 0).toLocaleString()}`;
const fmtPct = (v: number) =>
  `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;
const growthText = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
};

function transformKpi(
  raw: any,
  _scopeHint?: 'TL' | 'GL',
  timeRangeLabel?: string,
): KpiSections {
  const d = raw && typeof raw === 'object' ? raw : {};
  const first = (keys: string[], fb = 0): number => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null) {
        const v = Number(d[k]);
        if (Number.isFinite(v)) return v;
      }
    }
    return fb;
  };
  const firstStr = (keys: string[]): any => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') return d[k];
    }
    return undefined;
  };

  // A1 / A2 — 团队汇总（总额字段）
  const teamRevenue = first(['totalPerformance', 'teamRevenue', 'revenue']);
  const teamCommission = first(['totalCommission', 'teamCommission']);

  // 业绩拆解：直推/间推拆分字段（后端已返回拆分）
  const directRevenue = first(['directRevenue']);
  const directCommission = first(['directCommission']);
  const directImpressions = first(['directImpressions']);
  const indirectRevenue = first(['indirectRevenue']);
  const indirectCommission = first(['indirectCommission']);
  const indirectImpressions = first(['indirectImpressions']);

  // B1~B3 / C2~C4 — 管理数据（使用后端拆分字段）
  const directUserCount = first(['directRegisteredUsers', 'registeredUsers']);
  const directActiveUsers = first(['directActiveUserCount', 'activeUserCount']);
  const directActiveRate = first(['directActiveRate', 'activeRate']);
  const indirectUserCount = first(['indirectRegisteredUsers']);
  const indirectActiveUsers = first(['indirectActiveUserCount']);
  const indirectActiveRate = first(['indirectActiveRate']);

  // D1~D3 环比
  const teamRevenueGrowth = firstStr(['totalPerformanceGrowth', 'revenueGrowth']);
  const teamCommissionGrowth = firstStr(['totalCommissionGrowth', 'commissionGrowth']);
  const directRevenueGrowth = firstStr(['directRevenueGrowth']);
  const directCommissionGrowth = firstStr(['directCommissionGrowth']);
  const directImpressionsGrowth = firstStr(['directImpressionsGrowth']);
  const indirectRevenueGrowth = firstStr(['indirectRevenueGrowth']);
  const indirectCommissionGrowth = firstStr(['indirectCommissionGrowth']);
  const indirectImpressionsGrowth = firstStr(['indirectImpressionsGrowth']);

  // scope 判断：当 _scopeHint=GL 或 direct==total 且 indirect 全0
  const scope = _scopeHint || (d._scope as 'TL' | 'GL' | undefined) || 'TL';
  const isGl = scope === 'GL';
  const indirectAllZero =
    indirectRevenue === 0 && indirectCommission === 0 && indirectImpressions === 0 &&
    indirectUserCount === 0 && indirectActiveUsers === 0;
  const hideIndirect = isGl || indirectAllZero;

  // 环比标签只在「今日」「本月」展示，昨日/本周不显示
  const showGrowth = timeRangeLabel === '今日' || timeRangeLabel === '本月';
  const grd1 = showGrowth ? growthText(teamRevenueGrowth) : '';
  const isup1 = showGrowth ? Number(teamRevenueGrowth) > 0 : undefined;
  const grd2 = showGrowth ? growthText(teamCommissionGrowth) : '';
  const isup2 = showGrowth ? Number(teamCommissionGrowth) > 0 : undefined;
  const gD = (raw: any) => showGrowth ? growthText(raw ?? 0) : '';
  const uD = (raw: any) => showGrowth ? Number(raw ?? 0) > 0 : undefined;

  const summary: KpiCard[] = [
    {
      title: '团队总业绩',
      value: fmtMoney(teamRevenue),
      ...(grd1 ? { growth: grd1, isUp: isup1 } : {}),
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: '团队总提成',
      value: fmtMoney(teamCommission),
      ...(grd2 ? { growth: grd2, isUp: isup2 } : {}),
      icon: Coins,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  const direct: KpiCard[] = [
    {
      title: '业绩',
      value: fmtMoney(directRevenue),
      growth: gD(directRevenueGrowth),
      isUp: uD(directRevenueGrowth),
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: '提成',
      value: fmtMoney(directCommission),
      growth: gD(directCommissionGrowth),
      isUp: uD(directCommissionGrowth),
      icon: BarChart3,
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50',
    },
    {
      title: '曝光',
      value: fmtCount(directImpressions),
      growth: gD(directImpressionsGrowth),
      isUp: uD(directImpressionsGrowth),
      icon: Eye,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  const indirect: KpiCard[] = hideIndirect
    ? [
        {
          title: '业绩',
          value: '—',
          icon: ArrowRightLeft,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
        {
          title: '提成',
          value: '—',
          icon: BarChart3,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
        {
          title: '曝光',
          value: '—',
          icon: Eye,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
      ]
    : [
        {
          title: '业绩',
          value: fmtMoney(indirectRevenue),
          growth: gD(indirectRevenueGrowth),
          isUp: uD(indirectRevenueGrowth),
          icon: ArrowRightLeft,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
        },
        {
          title: '提成',
          value: fmtMoney(indirectCommission),
          growth: gD(indirectCommissionGrowth),
          isUp: uD(indirectCommissionGrowth),
          icon: Zap,
          color: 'text-rose-600',
          bg: 'bg-rose-50',
        },
        {
          title: '曝光',
          value: fmtCount(indirectImpressions),
          growth: gD(indirectImpressionsGrowth),
          isUp: uD(indirectImpressionsGrowth),
          icon: Eye,
          color: 'text-sky-600',
          bg: 'bg-sky-50',
        },
      ];

  const directMgmt: KpiCard[] = [
    {
      title: '直推在册',
      value: `${fmtCount(directUserCount)} 人`,
      icon: Users,
      color: 'text-sky-700',
      bg: 'bg-sky-50',
    },
    {
      title: '直推活跃',
      value: `${fmtCount(directActiveUsers)} 人`,
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: '直推活跃率',
      value: fmtPct(directActiveRate),
      icon: Target,
      color:
        Number(directActiveRate) >= 30 ? 'text-emerald-600' : 'text-red-500',
      bg: 'bg-emerald-50',
    },
  ];

  const indirectMgmt: KpiCard[] = hideIndirect
    ? [
        {
          title: '间推在册',
          value: '—',
          icon: UsersRound,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
        {
          title: '间推活跃',
          value: '—',
          icon: Activity,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
        {
          title: '间推活跃率',
          value: '—',
          icon: Target,
          color: 'text-gray-400',
          bg: 'bg-gray-100',
          dim: true,
        },
      ]
    : [
        {
          title: '间推在册',
          value: `${fmtCount(indirectUserCount)} 人`,
          icon: UsersRound,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          title: '间推活跃',
          value: `${fmtCount(indirectActiveUsers)} 人`,
          icon: Activity,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
        },
        {
          title: '间推活跃率',
          value: fmtPct(indirectActiveRate),
          icon: Target,
          color:
            Number(indirectActiveRate) >= 30
              ? 'text-teal-600'
              : 'text-red-500',
          bg: 'bg-teal-50',
        },
      ];

  return { summary, direct, indirect, directMgmt, indirectMgmt };
}

const SectionTitle: React.FC<{ icon: any; title: string; hint?: string }> = ({
  icon: Icon,
  title,
  hint,
}) => (
  <div className="flex items-center justify-between mb-2 px-1">
    <div className="flex items-center space-x-1.5">
      <Icon size={12} className="text-[#1E40AF]" />
      <h3 className="text-[11px] font-bold text-gray-800">{title}</h3>
    </div>
    {hint && <span className="text-[9px] text-gray-400">{hint}</span>}
  </div>
);

const CardGrid: React.FC<{ cards: KpiCard[] }> = ({ cards }) => (
  <div className="grid grid-cols-3 gap-2">
    {cards.map((kpi, i) => {
      const Icon = kpi.icon;
      return (
        <div
          key={i}
          className={`bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${
            kpi.dim ? 'opacity-60' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div
              className={`p-2 rounded-xl shadow-sm ${kpi.bg} ${
                kpi.dim ? 'bg-gray-100' : ''
              }`}
            >
              <Icon size={16} className={kpi.color} />
            </div>
            {kpi.growth && !kpi.dim && (
              <div
                className={`text-[9px] font-bold flex items-center px-2 py-0.5 rounded-full ${
                  kpi.isUp ? 'text-[#10B981] bg-emerald-50' : 'text-[#EF4444] bg-red-50'
                }`}
              >
                {kpi.isUp ? (
                  <TrendingUp size={10} className="mr-0.5" />
                ) : (
                  <TrendingDown size={10} className="mr-0.5" />
                )}
                {kpi.growth}
              </div>
            )}
          </div>
          <div className="text-gray-400 text-[10px] font-medium mb-1 tracking-wide">
            {kpi.title}
          </div>
          <div
            className={`text-base font-bold leading-tight ${
              kpi.dim ? 'text-gray-400' : 'text-gray-900'
            }`}
          >
            {kpi.value}
            {kpi.subValue && (
              <span className="ml-1 text-[10px] font-bold text-gray-500">
                ({kpi.subValue})
              </span>
            )}
          </div>
          {kpi.dim && (
            <div className="mt-1 text-[9px] text-gray-400">无间推数据</div>
          )}
        </div>
      );
    })}
  </div>
);

// 单张横排 KPI 卡（左标签+右数字，用于顶部横排 4 卡）
const WideKpiRow: React.FC<{ label: string; kpi: KpiCard; accent?: string }> = ({ label, kpi, accent }) => {
  const Icon = kpi.icon;
  return (
    <div
      className={`bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2.5 ${
        kpi.dim ? 'opacity-60' : ''
      }`}
    >
      <div
        className={`p-2 rounded-xl shadow-sm flex-shrink-0 ${kpi.dim ? 'bg-gray-100' : kpi.bg}`}
      >
        <Icon size={16} className={kpi.dim ? 'text-gray-400' : kpi.color} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <div
            className={`text-[10px] font-bold tracking-wide ${
              accent || 'text-gray-500'
            }`}
          >
            {label}
          </div>
          {kpi.growth && !kpi.dim && (
            <div
              className={`text-[9px] font-bold flex items-center px-1.5 py-0.5 rounded-full ${
                kpi.isUp
                  ? 'text-[#10B981] bg-emerald-50'
                  : 'text-[#EF4444] bg-red-50'
              }`}
            >
              {kpi.isUp ? (
                <TrendingUp size={9} className="mr-0.5" />
              ) : (
                <TrendingDown size={9} className="mr-0.5" />
              )}
              {kpi.growth}
            </div>
          )}
        </div>
        <div
          className={`text-[15px] font-black leading-tight truncate ${
            kpi.dim ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {kpi.value}
          {kpi.subValue && (
            <span className="ml-1 text-[10px] font-bold text-gray-500">
              ({kpi.subValue})
            </span>
          )}
        </div>
        {kpi.dim && (
          <div className="mt-0.5 text-[8px] text-gray-400">无间推数据</div>
        )}
      </div>
    </div>
  );
};

// 指标行：左右两张小卡，同一指标（直推 vs 间推）并排，更紧凑
const MetricCompareRow: React.FC<{
  label: string;
  direct: KpiCard;
  indirect: KpiCard;
}> = ({ label, direct, indirect }) => {
  const DIcon = direct.icon;
  const IIcon = indirect.icon;
  const Cell: React.FC<{ k: KpiCard; side: 'L' | 'R' }> = ({ k, side }) => (
    <div
      className={`bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2 flex-1 min-w-0 ${
        k.dim ? 'opacity-60' : ''
      }`}
    >
      <div
        className={`p-1.5 rounded-xl shadow-sm flex-shrink-0 ${
          k.dim ? 'bg-gray-100' : k.bg
        }`}
      >
        {side === 'L' ? (
          <DIcon size={14} className={k.dim ? 'text-gray-400' : k.color} />
        ) : (
          <IIcon size={14} className={k.dim ? 'text-gray-400' : k.color} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] text-gray-400 font-medium mb-0.5 truncate">
          {k.title}
        </div>
        <div
          className={`text-[14px] font-black leading-tight truncate ${
            k.dim ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {k.value}
          {k.subValue && (
            <span className="ml-0.5 text-[9px] font-bold text-gray-500">
              ({k.subValue})
            </span>
          )}
        </div>
        {k.dim && (
          <div className="text-[8px] text-gray-400 mt-0.5">无间推数据</div>
        )}
      </div>
      {k.growth && !k.dim && (
        <div
          className={`text-[9px] font-bold flex items-center px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            k.isUp ? 'text-[#10B981] bg-emerald-50' : 'text-[#EF4444] bg-red-50'
          }`}
        >
          {k.isUp ? (
            <TrendingUp size={9} className="mr-0.5" />
          ) : (
            <TrendingDown size={9} className="mr-0.5" />
          )}
          {k.growth}
        </div>
      )}
    </div>
  );
  return (
    <div>
      <div className="px-1 mb-1.5 text-[11px] font-bold text-gray-500 flex items-center">
        {label}
      </div>
      <div className="flex items-stretch space-x-2">
        <Cell k={direct} side="L" />
        <Cell k={indirect} side="R" />
      </div>
    </div>
  );
};

const TeamLeaderDashboard: React.FC<TeamLeaderDashboardProps> = ({
  timeRange,
  onRefresh,
  onDataLoaded,
  currentUser,
}) => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<KpiSections | null>(null);

  const prefix = TIME_RANGE_TO_PREFIX[timeRange] || '今日';

  const getCachedData = useCallback((key: string) => {
    const cacheTime = key.includes('today') ? 300000 : 600000;
    return cacheManager.get(key, cacheTime);
  }, []);
  const setCachedData = useCallback((key: string, data: any) => {
    cacheManager.set(key, data);
  }, []);

  const fetchKpiRaw = useCallback(
    async (rangeParam: string) => {
      const url = `/admin/dashboard/kpi?range=${rangeParam}`;
      const raw = await request<any>(url, { method: 'GET' });
      return raw;
    },
    []
  );

  const fetchData = useCallback(
    async (isRefresh = false) => {
      const rangeParam = TIME_RANGE_TO_PARAM[timeRange] || 'today';
      const cacheKey = `tl_kpi_${rangeParam}_${currentUser?.id || 'u'}`;

      if (!isRefresh) {
        const cached = getCachedData(cacheKey);
        if (cached) {
          setSections(cached);
          setLoading(false);
          onDataLoaded?.();
          setTimeout(() => preloadOtherTimeRanges(), 100);
          return;
        }
        setLoading(true);
      }

      try {
        const raw = await fetchKpiRaw(rangeParam);
        const transformed = transformKpi(raw, 'TL', timeRange);
        setSections(transformed);
        setCachedData(cacheKey, transformed);
        setTimeout(() => preloadOtherTimeRanges(), 100);
      } catch (e) {
        console.error('[TeamLeaderDashboard] KPI获取失败:', e);
        setSections(
          transformKpi(
            {},
            'TL',
            timeRange,
          )
        );
      } finally {
        setLoading(false);
        onDataLoaded?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, currentUser, fetchKpiRaw, getCachedData, setCachedData, onDataLoaded]
  );

  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser) return;
    const all = Object.keys(TIME_RANGE_TO_PARAM);
    const others = all.filter((r) => r !== timeRange);
    await Promise.allSettled(
      others.map(async (rangeLabel) => {
        const p = TIME_RANGE_TO_PARAM[rangeLabel];
        const key = `tl_kpi_${p}_${currentUser.id}`;
        if (getCachedData(key)) return;
        try {
          const raw = await fetchKpiRaw(p);
          const transformed = transformKpi(raw, 'TL', rangeLabel);
          setCachedData(key, transformed);
        } catch (e) {
          /* ignore */
        }
      })
    );
  }, [timeRange, currentUser, fetchKpiRaw, getCachedData, setCachedData]);

  useEffect(() => {
    // 初次挂载强制走后端，跳过缓存（修复 React 子组件 effect 早于父组件 cacheManager.clear() 导致读到旧缓存的时序 bug）
    if (currentUser) fetchData(true);
  }, [fetchData, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const iv = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(iv);
  }, [currentUser, fetchData]);

  // 骨架屏
  if (loading) {
    return (
      <div className="space-y-4 mb-6">
        {['汇总', '业绩拆解', '管理数据'].map((_, bi) => (
          <div
            key={bi}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md"
          >
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Array(bi === 0 ? 2 : 3).fill(0).map((_, i) => (
                <div
                  key={i}
                  className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm animate-pulse"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-gray-100">
                      <Clock size={16} className="text-gray-400" />
                    </div>
                    <div className="w-12 h-3 bg-gray-100 rounded-full"></div>
                  </div>
                  <div className="w-20 h-2.5 bg-gray-100 rounded-full mb-1.5"></div>
                  <div className="w-16 h-5 bg-gray-100 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const d = sections?.direct || [];
  const ii = sections?.indirect || [];
  const dm = sections?.directMgmt || [];
  const im = sections?.indirectMgmt || [];

  // 把两张 3 列的合并成一张 3 列的宽卡（直推指标和间推指标交替？用户意思是「横着」，所以行按「指标维度」：第一行业绩3项，第二行提成3项，第三行曝光3项... 不，每侧 3 张共 6 张 → 3 列 × 2 行，正好每行 3 张，竖着放）
  // 根据用户需求：把「竖着的 3 列 × 2 行」改成「横着的 2 行 × 3 列」即每行 3 张、共 2 行，等价于 grid-cols-3 gap-2 直接把 6 张平铺（原本是左3+右3，现在是 6 张在一个 3 列网格里，每行 3 张就更宽）
  const mergedDirectIndirect: KpiCard[] = [
    ...d.map((c) => ({ ...c, _side: '直推' } as KpiCard & { _side: string })),
    ...ii.map((c) => ({ ...c, _side: '间推' } as KpiCard & { _side: string })),
  ];

  const mergedMgmt: KpiCard[] = [
    ...dm.map((c) => ({ ...c, _side: '直推' } as KpiCard & { _side: string })),
    ...im.map((c) => ({ ...c, _side: '间推' } as KpiCard & { _side: string })),
  ];

  // 横向卡：图标在左、标签在标题上方（带直推/间推徽标），数字横向展开更宽
  const HorizontalCard: React.FC<{ kpi: KpiCard & { _side?: string }; col?: boolean }> = ({
    kpi,
  }) => {
    const Icon = kpi.icon;
    const sideColor =
      (kpi as any)._side === '直推'
        ? 'text-indigo-600 bg-indigo-50 border border-indigo-100'
        : (kpi as any)._side === '间推'
        ? 'text-amber-600 bg-amber-50 border border-amber-100'
        : 'text-gray-500 bg-gray-50 border border-gray-100';
    return (
      <div
        className={`bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${
          kpi.dim ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <div
            className={`p-2 rounded-xl shadow-sm flex-shrink-0 ${
              kpi.dim ? 'bg-gray-100' : kpi.bg
            }`}
          >
            <Icon size={14} className={kpi.dim ? 'text-gray-400' : kpi.color} />
          </div>
          {(kpi as any)._side && (
            <span
              className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${sideColor}`}
            >
              {(kpi as any)._side}
            </span>
          )}
        </div>
        <div className="text-gray-400 text-[9px] font-medium mb-1 tracking-wide flex items-center justify-between gap-2 min-w-0 w-full">
          <span className="truncate">{kpi.title}</span>
          {kpi.growth && !kpi.dim && (
            <span
              className={`text-[8px] font-bold flex items-center flex-shrink-0 leading-none ${
                kpi.isUp
                  ? 'text-[#10B981]'
                  : 'text-[#EF4444]'
              }`}
            >
              {kpi.isUp ? (
                <TrendingUp size={7} className="mr-0.5" />
              ) : (
                <TrendingDown size={7} className="mr-0.5" />
              )}
              {kpi.growth}
            </span>
          )}
        </div>
        <div
          className={`text-[14px] font-black leading-tight break-all ${
            kpi.dim ? 'text-gray-400' : 'text-gray-900'
          }`}
        >
          {kpi.value}
          {kpi.subValue && (
            <span className="ml-1 text-[9px] font-bold text-gray-500">
              ({kpi.subValue})
            </span>
          )}
        </div>
        {kpi.dim && <div className="mt-1 text-[8px] text-gray-400">无间推数据</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4 mb-6">
      {/* ① 团队汇总（2 张占满一行） */}
      <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
        <SectionTitle icon={Wallet} title={`${prefix}团队汇总`} hint="业绩 + 实际到手提成" />
        <div className="grid grid-cols-2 gap-3">
          {sections?.summary.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="bg-gradient-to-br from-white to-gray-50 p-3.5 rounded-2xl border border-gray-100 shadow-md hover:shadow-lg transition-all"
              >
                {/* 顶部：图标 + 标题并排（标题紧跟图标后） */}
                <div className="flex items-center space-x-2 min-w-0 mb-2.5">
                  <div className={`p-2 rounded-xl shadow-sm flex-shrink-0 ${kpi.bg}`}>
                    <Icon size={18} className={kpi.color} />
                  </div>
                  <div className={`text-[13px] font-bold tracking-wide ${kpi.color} truncate`}>
                    {kpi.title}
                  </div>
                </div>
                {/* 金额 + 环比徽标同一行：金额在左（15px），徽标在右上角对齐，不挤也不遮 */}
                <div className="flex items-start justify-between gap-2 min-w-0 w-full">
                  <div className="text-[15px] leading-[1.15] font-black text-gray-900 break-all min-w-0">
                    {kpi.value}
                  </div>
                  {kpi.growth && (
                    <div
                      className={`text-[9px] font-bold flex items-center px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 leading-none ${
                        kpi.isUp
                          ? 'text-[#10B981] bg-emerald-50'
                          : 'text-[#EF4444] bg-red-50'
                      }`}
                    >
                      {kpi.isUp ? (
                        <TrendingUp size={8} className="mr-0.5" />
                      ) : (
                        <TrendingDown size={8} className="mr-0.5" />
                      )}
                      {kpi.growth}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ② 业绩拆解：6 张统一 3 列网格，每行 3 张更宽（横着的 2 行 × 3 列），上方带 直推/间推 徽标 */}
      <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
        <SectionTitle icon={UserPlus} title={`${prefix}业绩拆解`} hint="直推（自己发展） vs 间推（下游贡献）" />
        <div className="grid grid-cols-3 gap-2">
          {mergedDirectIndirect.map((kpi, i) => (
            <HorizontalCard key={`di-${i}`} kpi={kpi as any} />
          ))}
        </div>
      </section>

      {/* ③ 管理数据：仅今日/昨日显示，本周/本月隐藏（用户要求） */}
      {timeRange !== '本周' && timeRange !== '本月' && (
        <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
          <SectionTitle icon={UsersRound} title={`${prefix}管理数据`} hint="在册 / 活跃 / 活跃率" />
          <div className="grid grid-cols-3 gap-2">
            {mergedMgmt.map((kpi, i) => (
              <HorizontalCard key={`mg-${i}`} kpi={kpi as any} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TeamLeaderDashboard;
