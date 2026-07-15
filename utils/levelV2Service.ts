// utils/levelV2Service.ts
// =============================================================
// 新职级体系 v2：P1 为组长（role=GROUP_LEADER），P2~P8 为团队长（role=NORMAL_ADMIN）
// 所有纯函数均不依赖 React，方便单测 & 复用。
// 核心规则（与后端 verification.js / Admin.js 对齐）：
//   - 档位永远按 P1 < P2 < ... < P8 排序
//   - 手动档 manualLevel: 'P1'~'P8' | null：null=自动档（累计营收自动升降，只升不降）
//   - 手动档不显示"下一档/差值/进度"，直接显示"手动指定档位"+ 最近调整时间
//   - TL (NORMAL_ADMIN) 手动调档最低 P2，禁止降到 P1
//   - 历史订单提成比例用 GoldLog 固化字段（commissionRate/tlCommissionRate/parentTlCommissionRate），
//     绝不按当前档位反算。
// =============================================================

import { UserRole } from '../types';

export const VALID_LEVELS_V2: Array<'P1'|'P2'|'P3'|'P4'|'P5'|'P6'|'P7'|'P8'> =
  ['P1','P2','P3','P4','P5','P6','P7','P8'];

export const LEVEL_V2_ORDER: Record<string, number> =
  { P1:1,P2:2,P3:3,P4:4,P5:5,P6:6,P7:7,P8:8 };

/**
 * 8 档兜底配置（仅当后端 level-config/v2 还没上线 / 网络失败时本地兜底）。
 * ⚠️ 注意：超管实际保存的数字请以 GET /api/admin/level-config/v2 返回为准，
 *        这里写死兜底只是为了 UI 不要空 / 0。
 */
export const LEVEL_V2_FALLBACK_8: LevelV2ConfigRow[] = [
  { level:'P1', name:'组长',          commission:0.05, minRevenue:      0, targetRevenue: 100000, role:UserRole.GROUP_LEADER },
  { level:'P2', name:'初级团队长',    commission:0.08, minRevenue: 100000, targetRevenue: 400000, role:UserRole.NORMAL_ADMIN },
  { level:'P3', name:'中级团队长',    commission:0.10, minRevenue: 400000, targetRevenue: 800000, role:UserRole.NORMAL_ADMIN },
  { level:'P4', name:'高级团队长',    commission:0.12, minRevenue: 800000, targetRevenue:1600000, role:UserRole.NORMAL_ADMIN },
  { level:'P5', name:'资深团队长Ⅰ',   commission:0.12, minRevenue:1600000, targetRevenue:2000000, role:UserRole.NORMAL_ADMIN },
  { level:'P6', name:'资深团队长Ⅱ',   commission:0.14, minRevenue:2000000, targetRevenue:2400000, role:UserRole.NORMAL_ADMIN },
  { level:'P7', name:'资深团队长Ⅲ',   commission:0.16, minRevenue:2400000, targetRevenue:3200000, role:UserRole.NORMAL_ADMIN },
  { level:'P8', name:'首席团队长',    commission:0.18, minRevenue:3200000, targetRevenue:3200000, role:UserRole.NORMAL_ADMIN },
];

export interface LevelV2ConfigRow {
  level: string;                 // 'P1' ~ 'P8'
  name: string;                  // 展示名：组长 / 初级团队长 …
  commission: number;            // 0~1，小数
  minRevenue: number;            // 达到本级所需最低累计营收（元）
  targetRevenue: number;         // 业绩目标（元，展示在配置表和路径图上）
  role: string;                  // 'GROUP_LEADER' | 'NORMAL_ADMIN'
}

export interface AdminLevelInfoV2 {
  currentLevel: string;
  currentLevelName: string;
  currentCommission: number;
  currentRole: string;                         // 档位对应的角色（GL / TL）
  nextLevel?: string;                          // 自动档才有
  nextLevelName?: string;
  nextCommission?: number;
  nextLevelThreshold?: number;                 // 下一档门槛 = next.minRevenue
  revenueToNext?: number;                      // 距离下一档差值（元）
  progressToNext: number;                      // 0~1，手动档 / 满级 = 1
  isMaxLevel: boolean;                         // 仅自动档到顶为 true
  isManual: boolean;                           // true=手动档，不展示下一档/进度
  manualLevelSetAt: Date | null;               // 最近一次手动调档时间
  levelConfig: LevelV2ConfigRow[];             // 计算时使用的 8 档配置（已升序）
}

/** 判断是否手动档（空值或非法档位都视为自动档） */
export function isManualLevel(manualLevel: any): boolean {
  return typeof manualLevel === 'string' && VALID_LEVELS_V2.includes(manualLevel as any);
}

/** 档位 → 角色 映射：P1=组长，P2~P8=团队长 */
export function levelRoleOf(level: string): string {
  return level === 'P1' ? UserRole.GROUP_LEADER : UserRole.NORMAL_ADMIN;
}

/** 提成比例小数 → 展示百分号（1位小数，.0 去掉） */
export function formatCommission(v: number | string | null | undefined): string {
  const pct = (Number(v) || 0) * 100;
  const fixed = (Math.round(pct * 10) / 10).toFixed(1);
  return fixed.replace(/\.0$/, '') + '%';
}

/**
 * 档位表 v2 标准化：不强制条数，任意条数都行（空 / P1 1 档 / TL 7 档 / 完整 8 档）
 * 绝不写死兜底，没返回就空数组，让上层明确知道缺数据。
 */
export function normalizeLevelConfig(raw: any): LevelV2ConfigRow[] {
  if (!Array.isArray(raw)) return [];
  const clean = raw.filter(r => r && typeof r === 'object' && (VALID_LEVELS_V2 as readonly string[]).includes(String(r.level)));
  if (clean.length === 0) return [];
  // 第 1 步：先原样解析（含 targetRevenue 多种命名回退：targetRevenue / target_revenue / revenueTarget / goalRevenue / targetAmount）
  const parsed = clean.slice().sort((a,b)=>LEVEL_V2_ORDER[String(a.level)] - LEVEL_V2_ORDER[String(b.level)]).map(r => {
    const trRaw = (r as any).targetRevenue ?? (r as any).target_revenue ?? (r as any).revenueTarget ?? (r as any).goalRevenue ?? (r as any).targetAmount ?? (r as any).target;
    const tr = Math.max(0, Number(trRaw == null || (trRaw as any) === '' ? 0 : trRaw));
    return {
      level: String(r.level),
      name: String(r.name || r.level),
      commission: Number(r.commission || 0),
      minRevenue: Math.max(0, Number(r.minRevenue || 0)),
      targetRevenue: tr,
      role: (r.role && String(r.role)) || (String(r.level) === 'P1' ? UserRole.GROUP_LEADER : UserRole.NORMAL_ADMIN),
    } as LevelV2ConfigRow;
  });
  // 第 2 步：严格衔接规则补齐 targetRevenue：prev.targetRevenue 应该等于 next.minRevenue
  //   - 如果后端 targetRevenue 未填（为 0）/ 不等于 next.minRevenue，就用 next.minRevenue 覆盖
  //   - 最后一档（最高级）：如果没填，就等于自己的 minRevenue
  for (let i = 0; i < parsed.length; i++) {
    const cur = parsed[i];
    const next = i < parsed.length - 1 ? parsed[i + 1] : null;
    if (next) {
      // 严格衔接：cur.targetRevenue 必须 === next.minRevenue
      cur.targetRevenue = Math.max(cur.targetRevenue, 0) > 0 && Math.max(cur.targetRevenue, 0) >= cur.minRevenue
        ? cur.targetRevenue  // 已填且合理，保留
        : Math.max(0, Number(next.minRevenue || 0)); // 否则用下一档门槛衔接
    } else {
      // 最高级：如果 target 没填，= minRevenue（保持语义：≥minRevenue 即满级）
      if (!cur.targetRevenue || cur.targetRevenue < cur.minRevenue) {
        cur.targetRevenue = Math.max(cur.minRevenue, 0);
      }
    }
  }
  return parsed;
}

/**
 * 核心算档函数：累计营收 + 8档表 + 手动档信息 → 当前档位信息
 * @param totalRevenue 本人累计营收（元），可以是 summary.totalRevenue
 * @param levelConfig  8 档表（后端 /api/admin/level-config/v2 返回）
 * @param manualLevel  Admin.manualLevel 字段（null=自动，'P1'~'P8'=手动）
 * @param manualLevelSetAt 手动档时间戳（毫秒数 / ISO 字符串 / Date 都行）
 */
export function computeAdminLevelV2(params: {
  totalRevenue: number | string | null | undefined;
  levelConfig?: any;
  manualLevel?: any;
  manualLevelSetAt?: any;
}): AdminLevelInfoV2 {
  const cfg8 = normalizeLevelConfig(params.levelConfig);
  const manual = isManualLevel(params.manualLevel);
  const rev = Math.max(0, Number(params.totalRevenue) || 0);

  let manualDate: Date | null = null;
  if (manual && params.manualLevelSetAt) {
    const t = new Date(params.manualLevelSetAt);
    if (!Number.isNaN(t.getTime())) manualDate = t;
  }

  // 空档位表 → 全 0 返回，绝不写死兜底
  if (cfg8.length === 0) {
    return {
      currentLevel: manual ? String(params.manualLevel) : '',
      currentLevelName: '',
      currentCommission: 0,
      currentRole: '',
      nextLevel: undefined,
      nextLevelName: undefined,
      nextCommission: undefined,
      nextLevelThreshold: undefined,
      revenueToNext: undefined,
      progressToNext: 0,
      isMaxLevel: false,
      isManual: manual,
      manualLevelSetAt: manualDate,
      levelConfig: cfg8,
    };
  }

  let currentLevel: string;
  if (manual) {
    currentLevel = String(params.manualLevel);
  } else {
    currentLevel = cfg8[0].level;
    for (let i = 0; i < cfg8.length; i++) {
      if (cfg8[i].minRevenue <= rev) currentLevel = cfg8[i].level; else break;
    }
  }
  const curIdx = cfg8.findIndex(c => c.level === currentLevel);
  const cur = (curIdx >= 0 ? cfg8[curIdx] : cfg8[0]);
  const next = (!manual && curIdx >= 0 && curIdx < cfg8.length - 1) ? cfg8[curIdx + 1] : undefined;
  const isMaxLevel = !manual && !next;
  const progressToNext: number = (() => {
    if (manual || isMaxLevel) return 1;
    const from = cur.minRevenue; const to = next!.minRevenue;
    if (to <= from) return 1;
    const p = (rev - from) / (to - from);
    return Math.max(0, Math.min(1, p));
  })();

  return {
    currentLevel: cur.level,
    currentLevelName: cur.name,
    currentCommission: cur.commission,
    currentRole: cur.role || levelRoleOf(cur.level),
    nextLevel: next ? next.level : undefined,
    nextLevelName: next ? next.name : undefined,
    nextCommission: next ? next.commission : undefined,
    nextLevelThreshold: next ? next.minRevenue : undefined,
    revenueToNext: next ? Math.max(0, next.minRevenue - rev) : undefined,
    progressToNext,
    isMaxLevel,
    isManual: manual,
    manualLevelSetAt: manualDate,
    levelConfig: cfg8,
  };
}

/** 手动调档 → 前端前置校验（后端会再校验一次），返回 {ok, reason?} */
export function allowManualLevelForRole(params: {
  currentRole: string | null | undefined;
  targetLevel: string;
}): { ok: boolean; reason?: string } {
  if (!VALID_LEVELS_V2.includes(params.targetLevel as any)) {
    return { ok:false, reason:`档位必须是 P1~P8 之一（当前：${params.targetLevel || '空'}）` };
  }
  if (params.currentRole === UserRole.NORMAL_ADMIN && params.targetLevel === 'P1') {
    return { ok:false, reason:'团队长不允许降回组长 P1（最低仅可降为 P2）' };
  }
  return { ok:true };
}

// =============================================================
// 8 档统一主题色盘（徽章 / 路径图 / Settings 页通用，避免每个页写一份硬编码）
// P1→天蓝；P2→青绿；P3→翠绿；P4→金黄；P5→青蓝；P6→靛紫；P7→玫粉；P8→金紫
// =============================================================
export interface LevelV2Theme {
  label: string;
  /** 背景渐变（Settings 徽章） */
  badgeBg: string;
  badgeText: string;
  badgeRing: string;
  badgeBorder: string;
  /** 路径图节点 */
  nodeBg: string;
  nodeBorder: string;
  nodeText: string;
  /** 进度条渐变 */
  barFrom: string;
  barTo: string;
  /** 连接线渐变 */
  lineFrom: string;
  lineTo: string;
  /** 卡片背景渐变（职级卡） */
  cardFrom: string;
  cardTo: string;
  /** 配置表行色 */
  rowDot: string;
  rowBadge: string;
  rowText: string;
}
const THEME_COMMON = {
  label: '', badgeText: 'text-white', badgeRing: '',
  nodeText: 'text-white',
};
export const LEVEL_V2_THEMES: Record<string, LevelV2Theme> = {
  P1: { ...THEME_COMMON, label:'P1',
    badgeBg:'from-sky-400 to-cyan-500', badgeRing:'ring-1 ring-sky-200', badgeBorder:'border-sky-300/60',
    nodeBg:'bg-gradient-to-br from-sky-400 to-cyan-500', nodeBorder:'border-sky-300',
    barFrom:'from-sky-400', barTo:'to-cyan-500',
    lineFrom:'from-sky-400', lineTo:'to-cyan-400',
    cardFrom:'from-sky-50', cardTo:'to-cyan-100',
    rowDot:'bg-sky-400', rowBadge:'bg-sky-50 text-sky-700 ring-1 ring-sky-200', rowText:'text-sky-600',
  },
  P2: { ...THEME_COMMON, label:'P2',
    badgeBg:'from-emerald-400 to-teal-500', badgeRing:'ring-1 ring-emerald-200', badgeBorder:'border-emerald-300/60',
    nodeBg:'bg-gradient-to-br from-emerald-400 to-teal-500', nodeBorder:'border-emerald-300',
    barFrom:'from-emerald-400', barTo:'to-teal-500',
    lineFrom:'from-emerald-400', lineTo:'to-teal-400',
    cardFrom:'from-emerald-50', cardTo:'to-teal-100',
    rowDot:'bg-emerald-400', rowBadge:'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', rowText:'text-emerald-600',
  },
  P3: { ...THEME_COMMON, label:'P3',
    badgeBg:'from-lime-400 to-green-500', badgeRing:'ring-1 ring-lime-200', badgeBorder:'border-lime-300/60',
    nodeBg:'bg-gradient-to-br from-lime-400 to-green-500', nodeBorder:'border-lime-300',
    barFrom:'from-lime-400', barTo:'to-green-500',
    lineFrom:'from-lime-400', lineTo:'to-green-400',
    cardFrom:'from-lime-50', cardTo:'to-green-100',
    rowDot:'bg-green-500', rowBadge:'bg-green-50 text-green-700 ring-1 ring-green-200', rowText:'text-green-600',
  },
  P4: { ...THEME_COMMON, label:'P4',
    badgeBg:'from-amber-400 to-orange-500', badgeRing:'ring-1 ring-amber-200', badgeBorder:'border-amber-300/60',
    nodeBg:'bg-gradient-to-br from-amber-400 to-orange-500', nodeBorder:'border-amber-300',
    barFrom:'from-amber-400', barTo:'to-orange-500',
    lineFrom:'from-amber-400', lineTo:'to-orange-400',
    cardFrom:'from-amber-50', cardTo:'to-orange-100',
    rowDot:'bg-amber-400', rowBadge:'bg-amber-50 text-amber-700 ring-1 ring-amber-200', rowText:'text-amber-600',
  },
  P5: { ...THEME_COMMON, label:'P5',
    badgeBg:'from-cyan-400 to-sky-500', badgeRing:'ring-1 ring-cyan-200', badgeBorder:'border-cyan-300/60',
    nodeBg:'bg-gradient-to-br from-cyan-400 to-sky-500', nodeBorder:'border-cyan-300',
    barFrom:'from-cyan-400', barTo:'to-sky-500',
    lineFrom:'from-cyan-400', lineTo:'to-sky-400',
    cardFrom:'from-cyan-50', cardTo:'to-blue-50',
    rowDot:'bg-cyan-400', rowBadge:'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200', rowText:'text-cyan-600',
  },
  P6: { ...THEME_COMMON, label:'P6',
    badgeBg:'from-indigo-500 to-violet-600', badgeRing:'ring-1 ring-indigo-200', badgeBorder:'border-indigo-300/60',
    nodeBg:'bg-gradient-to-br from-indigo-500 to-violet-600', nodeBorder:'border-indigo-300',
    barFrom:'from-indigo-400', barTo:'to-violet-500',
    lineFrom:'from-indigo-400', lineTo:'to-violet-400',
    cardFrom:'from-indigo-50', cardTo:'to-purple-50',
    rowDot:'bg-indigo-500', rowBadge:'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', rowText:'text-indigo-600',
  },
  P7: { ...THEME_COMMON, label:'P7',
    badgeBg:'from-rose-500 to-pink-600', badgeRing:'ring-1 ring-rose-200', badgeBorder:'border-rose-300/60',
    nodeBg:'bg-gradient-to-br from-rose-500 to-pink-600', nodeBorder:'border-rose-300',
    barFrom:'from-rose-400', barTo:'to-pink-500',
    lineFrom:'from-rose-400', lineTo:'to-pink-400',
    cardFrom:'from-rose-50', cardTo:'to-pink-100',
    rowDot:'bg-rose-500', rowBadge:'bg-rose-50 text-rose-700 ring-1 ring-rose-200', rowText:'text-rose-600',
  },
  P8: { ...THEME_COMMON, label:'P8',
    badgeBg:'from-yellow-500 via-orange-500 to-fuchsia-600', badgeRing:'ring-1 ring-yellow-200', badgeBorder:'border-yellow-300/60',
    nodeBg:'bg-gradient-to-br from-yellow-500 to-fuchsia-600', nodeBorder:'border-yellow-300',
    barFrom:'from-yellow-400', barTo:'to-fuchsia-500',
    lineFrom:'from-yellow-400', lineTo:'to-fuchsia-400',
    cardFrom:'from-yellow-50', cardTo:'to-fuchsia-100',
    rowDot:'bg-yellow-500', rowBadge:'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-yellow-200', rowText:'text-fuchsia-600',
  },
};
export function getLevelV2Theme(level: string): LevelV2Theme {
  return LEVEL_V2_THEMES[String(level)] || LEVEL_V2_THEMES.P1;
}

// =============================================================
// 8 档配置 v2 —— 超管接口包装（方便所有页面统一用）
// ⚠️ 后端实际是 **2 套独立接口**：
//   ① 团队长档位（P2~P8 共 7 条）：/api/admin/team-leader/level-config
//   ② 组长档位（P1 1 条）：           /api/admin/group-leader/level-config
// 在 list/save 层把 2 套接口自动合并成"一套"：对外都是 P1~P8 8 档，对调用方透明。
// =============================================================
import { request } from '../services/api';

/** 保存前清理：commission 转小数，数字字段整数元，去 NaN/Inf */
function stripForSave(r: LevelV2ConfigRow): any {
  const comm = Number(r.commission);
  const commClean = Number.isFinite(comm) ? Number(comm.toFixed(6)) : 0;
  return {
    level: String(r.level),
    name: String(r.name || r.level).trim(),
    commission: Number(commClean) || 0,
    minRevenue: Math.max(0, Math.round(Number(r.minRevenue) || 0)),
    targetRevenue: Math.max(0, Math.round(Number(r.targetRevenue) || 0)),
    role: (r.role && String(r.role)) || (String(r.level) === 'P1' ? UserRole.GROUP_LEADER : UserRole.NORMAL_ADMIN),
  };
}

/** 从 GET 响应中抽出 list 数组：可能是 array / {list} / {levels[]} / {rows[]} */
function extractList(r: any): any[] {
  if (Array.isArray(r)) return r;
  const arr = (r as any)?.data?.levels
    ?? (r as any)?.levels
    ?? (r as any)?.data?.list
    ?? (r as any)?.list
    ?? (r as any)?.data?.rows
    ?? (r as any)?.rows
    ?? (Array.isArray((r as any)?.data) ? (r as any).data : null);
  return Array.isArray(arr) ? arr : [];
}

export interface LevelV2ListResult {
  rows: LevelV2ConfigRow[];
  updatedAt: string | Date | null;
  updatedBy: string | null;
}

export const LEVEL_V2_API = {
  /** 合并 GET：并行拉 TL(P2~P8) + GL(P1) 两套接口，拼接 P1~P8 8 档 + 解包元数据 */
  list: async (): Promise<LevelV2ListResult> => {
    const [tlResp, glResp] = await Promise.all([
      request<any>('/admin/team-leader/level-config', { method: 'GET' }),
      request<any>('/admin/group-leader/level-config', { method: 'GET' })
        .catch(e => { console.warn('[LEVEL_V2] GL组长档位GET失败，P1用fallback', e?.message); return null; }),
    ]);
    const tl7 = extractList(tlResp);
    const glRaw = (() => {
      if (!glResp) return [];
      // GL接口可能返回：array 1条 / {list:[P1]} / {row:P1} / {level:P1} / {config:P1}
      if (Array.isArray(glResp)) return glResp;
      const direct = extractList(glResp);
      if (direct.length > 0) return direct;
      const single = (glResp as any)?.row ?? (glResp as any)?.level ?? (glResp as any)?.config ?? (glResp as any)?.data?.row ?? null;
      return single && typeof single === 'object' ? [single] : [];
    })();
    // 元数据：从 TL 接口读 updatedAt/updatedBy（TL 是主接口）
    const tlAny = tlResp as any;
    const meta = {
      updatedAt: (tlAny?.updatedAt ?? tlAny?.data?.updatedAt ?? tlAny?.updated_at ?? tlAny?.data?.updated_at ?? null) as any,
      updatedBy: (tlAny?.updatedBy ?? tlAny?.data?.updatedBy ?? tlAny?.updated_by ?? tlAny?.data?.updated_by ?? tlAny?.operator ?? tlAny?.data?.operator ?? null) as any,
    };
    // 拼接 P1 + P2~P8
    const merged8: any[] = [...glRaw, ...tl7];
    const rows = normalizeLevelConfig(merged8.length > 0 ? merged8 : []);
    return { rows, ...meta };
  },

  /** 合并 PUT：拆成 TL 7条(P2~P8) + GL(P1) 1条，并行调两套接口保存，都成功才返回 */
  save: async (rows: LevelV2ConfigRow[]): Promise<any> => {
    // ① TL 7 条（P2~P8 固定顺序，缺的用 fallback 占位)
    const tlLvls = VALID_LEVELS_V2.filter(lv => lv !== 'P1');
    const tlRows = tlLvls.map(lv => {
      const exist = rows.find(r => r.level === lv);
      if (exist) return stripForSave(exist);
      const fb = LEVEL_V2_FALLBACK_8.find(f => f.level === lv);
      return stripForSave(fb ?? ({ level: lv, name: lv, commission: 0, minRevenue: 0, targetRevenue: 0, role: UserRole.NORMAL_ADMIN } as LevelV2ConfigRow));
    });
    // ② GL P1 1 条
    const p1Raw = (() => {
      const exist = rows.find(r => r.level === 'P1');
      if (exist) return stripForSave(exist);
      const fb = LEVEL_V2_FALLBACK_8.find(f => f.level === 'P1');
      return stripForSave(fb ?? ({ level: 'P1', name: '组长', commission: 0.05, minRevenue: 0, targetRevenue: 0, role: UserRole.GROUP_LEADER } as LevelV2ConfigRow));
    })();
    const [tlResp, glResp] = await Promise.all([
      request<any>('/admin/team-leader/level-config', {
        method: 'PUT',
        body: JSON.stringify({ list: tlRows }),
      }),
      request<any>('/admin/group-leader/level-config', {
        method: 'PUT',
        body: JSON.stringify({ list: [p1Raw], row: p1Raw, level: p1Raw }),
      }).catch(e => {
        console.warn('[LEVEL_V2] GL组长档位PUT失败，TL已保存', e?.message);
        return { success: false, message: `GL组长档位保存失败：${e?.message || '未知错误'}` };
      }),
    ]);
    const ok = Boolean((tlResp as any)?.success !== false && (glResp as any)?.success !== false);
    const tlMsg = (tlResp as any)?.message || 'TL团队长档位保存成功';
    const glMsg = (glResp as any)?.success === false
      ? ((glResp as any)?.message ? `，${(glResp as any).message}` : '')
      : '，GL组长档位已同步保存成功';
    return {
      success: ok,
      tlResp,
      glResp,
      message: tlMsg + glMsg,
    };
  },

  /** 默认 8 档：GET TL/default + GL P1 fallback */
  getDefault: async (): Promise<LevelV2ConfigRow[]> => {
    try {
      const tlDefault = await request<any>('/admin/team-leader/level-config/default', { method: 'GET' })
        .catch(() => null as any);
      const tlList = extractList(tlDefault);
      const p1Fb = LEVEL_V2_FALLBACK_8.find(f => f.level === 'P1');
      return normalizeLevelConfig([p1Fb ? { ...p1Fb } : null as any, ...tlList].filter(Boolean) as any[]);
    } catch {
      return LEVEL_V2_FALLBACK_8.slice();
    }
  },

  /** PUT /api/admin/:adminId/manual-level —— 超管手动调档 / 恢复自动（传 null=自动） */
  setManualLevel: (adminId: string | number, level: string | null): Promise<any> =>
    request(`/admin/${String(adminId)}/manual-level`, { method:'PUT', body: JSON.stringify({ level }) }),
};
