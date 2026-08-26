import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Wallet, Coins, Eye, Users, BarChart3,
  TrendingUp, TrendingDown, Clock, Zap,
  Building2, ArrowRightLeft, UsersRound, Target, UserPlus, Activity
} from 'lucide-react';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { cacheManager } from '../services/cacheManager';

interface GroupLeaderProps {
  timeRange: string;
  onRefresh: () => void;
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
  summary: KpiCard[];
  direct: KpiCard[];
  indirect: KpiCard[];
  directMgmt: KpiCard[];
  indirectMgmt: KpiCard[];
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

function transformKpi(raw: any, timeRangeLabel?: string): KpiSections {
  const d = raw && typeof raw === 'object' ? raw : {};
  const n = (k: string, fallback = 0) => {
    const v = Number(d[k]);
    return Number.isFinite(v) ? v : fallback;
  };
  // 取第一个命中的字段（新字段优先，老字段兜底）
  const first = (keys: string[], fallback = 0): number => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null) {
        const v = Number(d[k]);
        if (Number.isFinite(v)) return v;
      }
    }
    return fallback;
  };
  const firstStr = (keys: string[]): string | undefined => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== '') return d[k];
    }
    return undefined;
  };

  // 新版字段优先（totalPerformance / totalCommission / activeUserCount / registeredUsers / activeRate），老字段兜底
  const totalPerformance = first(['totalPerformance', 'teamRevenue']);
  const totalCommission = first(['totalCommission', 'teamCommission']);
  const commissionRate = first(['commissionRate'], 0);

  // direct* 兜底（部分卡片仍使用 direct 口径）
  const teamRevenue = totalPerformance;
  const teamCommission = totalCommission;
  const directRevenue = first(['directRevenue', 'revenue']);
  const directCommission = first(['directCommission']);
  const directImpressions = first(['directImpressions', 'impressions']);

  const registeredUsers = first(['registeredUsers', 'directUserCount']);
  const activeUserCount = first(['activeUserCount', 'directActiveUsers']);
  const activeRate = first(['activeRate', 'directActiveRate']);
  const userCountForRate = registeredUsers > 0 ? registeredUsers : n('directUserCount');
  const activeRateComputed =
    activeRate > 0
      ? activeRate
      : userCountForRate > 0
      ? (activeUserCount / userCountForRate) * 100
      : 0;

  // growth 字段：后端返回 revenueGrowth / commissionGrowth（兼容新老多种命名）
  const teamRevenueGrowth = firstStr(['totalPerformanceGrowth', 'revenueGrowth', 'teamRevenueGrowth']);
  const teamCommissionGrowth = firstStr(['totalCommissionGrowth', 'commissionGrowth', 'teamCommissionGrowth']);
  const directRevenueGrowth = firstStr(['directRevenueGrowth', 'revenueGrowth']);
  const directCommissionGrowth = firstStr(['directCommissionGrowth', 'commissionGrowth']);
  const directImpressionsGrowth = firstStr(['directImpressionsGrowth', 'impressionsGrowth']);
  const registeredUsersGrowth = firstStr(['registeredUsersGrowth', 'directUserCountGrowth']);
  const activeUserCountGrowth = firstStr(['activeUserCountGrowth', 'activeUsersGrowth', 'directActiveUsersGrowth']);
  const activeRateGrowth = firstStr(['activeRateGrowth']);

  // 计算本组的平均金币 = (本组业绩元 * 1000) / 曝光数
  const avgGoldPerAd =
    directImpressions > 0 ? (directRevenue * 1000) / directImpressions : 0;

  // 环比标签只在「今日」「本月」展示，昨日/本周不显示
  const showGrowth = timeRangeLabel === '今日' || timeRangeLabel === '本月';
  const toNum = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const grd1 = showGrowth ? growthText(toNum(teamRevenueGrowth)) : '';
  const isup1 = showGrowth ? toNum(teamRevenueGrowth) > 0 : undefined;
  const grd2 = showGrowth ? growthText(toNum(teamCommissionGrowth)) : '';
  const isup2 = showGrowth ? toNum(teamCommissionGrowth) > 0 : undefined;
  const gD = (raw: any) => showGrowth ? growthText(toNum(raw)) : '';
  const uD = (raw: any) => showGrowth ? toNum(raw) > 0 : undefined;

  // commissionRate 兜底（若后端未返回则用 teamCommission / teamRevenue 估算）
  const finalCommissionRate =
    commissionRate > 0
      ? commissionRate
      : teamRevenue > 0
      ? teamCommission / teamRevenue
      : 0;
  const commissionRatePct =
    finalCommissionRate >= 1
      ? finalCommissionRate.toFixed(2)
      : (finalCommissionRate * 100).toFixed(2);

  const summary: KpiCard[] = [
    {
      title: '本组总业绩',
      value: fmtMoney(teamRevenue),
      ...(grd1 ? { growth: grd1, isUp: isup1 } : {}),
      icon: Wallet,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: '本组总提成',
      value: fmtMoney(teamCommission),
      subValue: teamRevenue > 0 ? `${commissionRatePct}%` : '0%',
      ...(grd2 ? { growth: grd2, isUp: isup2 } : {}),
      icon: Coins,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];

  const direct: KpiCard[] = [
    {
      title: '组内业绩',
      value: fmtMoney(directRevenue),
      growth: gD(directRevenueGrowth),
      isUp: uD(directRevenueGrowth),
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: '组内提成',
      value: fmtMoney(directCommission),
      growth: gD(directCommissionGrowth),
      isUp: uD(directCommissionGrowth),
      icon: BarChart3,
      color: 'text-fuchsia-600',
      bg: 'bg-fuchsia-50',
    },
    {
      title: '广告总曝光',
      value: fmtCount(directImpressions),
      growth: gD(directImpressionsGrowth),
      isUp: uD(directImpressionsGrowth),
      icon: Eye,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  // 组长无间推概念，展示本组平均金币作为替代（3 张更有价值的数据）。对应环比字段后端补齐中，缺的按 0 展示。
  const indirect: KpiCard[] = [
    {
      title: '单条平均金币',
      value: avgGoldPerAd.toFixed(2),
      growth: gD((d as any).avgGoldPerAdGrowth),
      isUp: uD((d as any).avgGoldPerAdGrowth),
      icon: Zap,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      title: '本组在册',
      value: `${fmtCount(registeredUsers)} 人`,
      growth: gD(registeredUsersGrowth),
      isUp: uD(registeredUsersGrowth),
      icon: Users,
      color: 'text-sky-700',
      bg: 'bg-sky-50',
    },
    {
      title: '本组活跃',
      value: `${fmtCount(activeUserCount)} 人`,
      growth: gD(activeUserCountGrowth),
      isUp: uD(activeUserCountGrowth),
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  const directMgmt: KpiCard[] = [
    {
      title: '在册用户',
      value: `${fmtCount(registeredUsers)} 人`,
      icon: Users,
      color: 'text-sky-700',
      bg: 'bg-sky-50',
    },
    {
      title: '活跃用户',
      value: `${fmtCount(activeUserCount)} 人`,
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: '活跃率',
      value: fmtPct(activeRateComputed),
      icon: Target,
      color:
        activeRateComputed >= 30 ? 'text-emerald-600' : 'text-red-500',
      bg: 'bg-emerald-50',
    },
  ];

  // 右半：放一些本组衍生指标，避免全灰
  const indirectMgmt: KpiCard[] = [
    {
      title: '人均业绩',
      value: userCountForRate > 0 ? fmtMoney(directRevenue / userCountForRate) : '¥0.00',
      icon: Wallet,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      title: '人均提成',
      value: userCountForRate > 0 ? fmtMoney(directCommission / userCountForRate) : '¥0.00',
      icon: Coins,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      title: '人均曝光',
      value: userCountForRate > 0 ? fmtCount(directImpressions / userCountForRate) : '0',
      icon: Eye,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
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
                  kpi.isUp
                    ? 'text-[#10B981] bg-emerald-50'
                    : 'text-[#EF4444] bg-red-50'
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
            <div className="mt-1 text-[9px] text-gray-400">组长视角无间推</div>
          )}
        </div>
      );
    })}
  </div>
);

const GroupLeader: React.FC<GroupLeaderProps> = ({ timeRange, onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<KpiSections | null>(null);

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const prefix = TIME_RANGE_TO_PREFIX[timeRange] || '今日';

  const getCachedData = useCallback((key: string) => {
    const cacheTime = key.includes('today') ? 300000 : 600000;
    return cacheManager.get(key, cacheTime);
  }, []);
  const setCachedData = useCallback((key: string, data: any) => {
    cacheManager.set(key, data);
  }, []);

  const teamGroupId = currentUser?.teamGroupId || '';

  const fetchKpiRaw = useCallback(
    async (rangeParam: string) => {
      let url = `/admin/dashboard/kpi?range=${rangeParam}`;
      if (teamGroupId) {
        url += `&group=${encodeURIComponent(teamGroupId)}`;
      }
      const raw = await request<any>(url, { method: 'GET' });
      return raw;
    },
    [teamGroupId]
  );

  const fetchData = useCallback(
    async (isRefresh = false) => {
      const rangeParam = TIME_RANGE_TO_PARAM[timeRange] || 'today';
      const cacheKey = `gl_kpi_${rangeParam}_${currentUser?.id || 'u'}`;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        const cached = getCachedData(cacheKey);
        if (cached) {
          setSections(cached);
          setLoading(false);
          setTimeout(() => preloadOtherTimeRanges(), 100);
          return;
        }
        setLoading(true);
      }

      try {
        const raw = await fetchKpiRaw(rangeParam);
        const transformed = transformKpi(raw, timeRange);
        setSections(transformed);
        setCachedData(cacheKey, transformed);
        setTimeout(() => preloadOtherTimeRanges(), 100);
      } catch (e) {
        console.error('[GroupLeader] KPI获取失败:', e);
        setSections(transformKpi({}, timeRange));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeRange, currentUser, fetchKpiRaw, getCachedData, setCachedData]
  );

  const preloadOtherTimeRanges = useCallback(async () => {
    if (!currentUser) return;
    const all = Object.keys(TIME_RANGE_TO_PARAM);
    const others = all.filter((r) => r !== timeRange);
    await Promise.allSettled(
      others.map(async (rangeLabel) => {
        const p = TIME_RANGE_TO_PARAM[rangeLabel];
        const key = `gl_kpi_${p}_${currentUser.id}`;
        if (getCachedData(key)) return;
        try {
          const raw = await fetchKpiRaw(p);
          const transformed = transformKpi(raw, rangeLabel);
          setCachedData(key, transformed);
        } catch (e) {
          /* ignore */
        }
      })
    );
  }, [timeRange, currentUser, fetchKpiRaw, getCachedData, setCachedData]);

  useEffect(() => {
    if (currentUser) fetchData(true);
  }, [fetchData, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if ((window as any).dashboardAutoRefresh) return;
    const iv = setInterval(() => fetchData(false), 300000);
    return () => clearInterval(iv);
  }, [currentUser, fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
    onRefresh?.();
  }, [fetchData, onRefresh]);

  if (loading) {
    const blocks =
      timeRange === '本周' || timeRange === '本月'
        ? ['汇总', '业绩拆解']
        : ['汇总', '业绩拆解', '管理数据'];
    return (
      <div className="pb-6 mt-4 space-y-4">
        {blocks.map((name, bi) => (
          <div
            key={bi}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md"
          >
            <div className="grid grid-cols-2 gap-3">
              {Array(bi === 0 ? 2 : 3)
                .fill(0)
                .map((_, i) => (
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
  const r = sections?.indirect || [];
  const dm = sections?.directMgmt || [];
  const rm = sections?.indirectMgmt || [];

  const taggedKpi = (k: KpiCard, tag: string, tagStyle: string): KpiCard & { _tag: string; _tagStyle: string } =>
    ({ ...k, _tag: tag, _tagStyle: tagStyle } as any);

  const mergedPerf = [
    ...d.map((c) => taggedKpi(c, '组内数据', 'text-indigo-600 bg-indigo-50 border border-indigo-100')),
    ...r.map((c) => taggedKpi(c, '本组衍生', 'text-amber-600 bg-amber-50 border border-amber-100')),
  ];

  const mergedMgmt = [
    ...dm.map((c) => taggedKpi(c, '本组', 'text-sky-600 bg-sky-50 border border-sky-100')),
    ...rm.map((c) => taggedKpi(c, '本组人均', 'text-teal-600 bg-teal-50 border border-teal-100')),
  ];

  // 宽卡：徽标 + 图标/增长在顶部，标题/数值横向展开
  const WideCard: React.FC<{ kpi: KpiCard & { _tag?: string; _tagStyle?: string } }> = ({ kpi }) => {
    const Icon = kpi.icon;
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
          {(kpi as any)._tag && (
            <span
              className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                (kpi as any)._tagStyle
              }`}
            >
              {(kpi as any)._tag}
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
        {kpi.dim && <div className="mt-1 text-[8px] text-gray-400">组长视角无间推</div>}
      </div>
    );
  };

  return (
    <div className="pb-6 mt-4 space-y-4">
      {/* ① 本组汇总 */}
      <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
        <SectionTitle icon={Wallet} title={`${prefix}本组汇总`} />
        <div className="grid grid-cols-2 gap-3">
          {sections?.summary.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div
                key={i}
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

      {/* ② 管理数据：组长界面四个Tab（今日/昨日/本周/本月）全部显示，且只保留上一行 3 张（在册/活跃/活跃率）；业绩拆解整个section组长不显示 */}
      <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-md">
        <SectionTitle icon={UsersRound} title={`${prefix}管理数据`} />
        <div className="grid grid-cols-3 gap-2">
          {mergedMgmt.slice(0, 3).map((k, i) => (
            <WideCard key={`mg-${i}`} kpi={k as any} />
          ))}
        </div>
      </section>

      {/* 静默刷新占位（refreshing 不阻塞 UI） */}
      {refreshing && (
        <div className="fixed top-2 right-3 z-50 p-1 rounded-full bg-blue-50 shadow-sm animate-pulse">
          <Clock size={12} className="text-blue-500" />
        </div>
      )}
    </div>
  );
};

export default GroupLeader;
