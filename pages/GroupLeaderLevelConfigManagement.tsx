import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, RotateCcw, AlertTriangle, CheckCircle, Award, Info, Loader2, XCircle, Wrench, Zap, Search, Edit2, Users } from 'lucide-react';
import { request } from '../services/api';
import {
  LEVEL_V2_API,
  LEVEL_V2_FALLBACK_8,
  LEVEL_V2_ORDER,
  VALID_LEVELS_V2,
  formatCommission,
  getLevelV2Theme,
  normalizeLevelConfig,
  type LevelV2ConfigRow,
} from '../utils/levelV2Service';
import { UserRole } from '../types';

interface Props { onBack: () => void; }

/** 管理员账号类型（从 AccountManagement 引入的精简版） */
interface AdjustAccount {
  _id: string;
  username: string;
  password?: string;
  role: string;
  status?: string;
  teamName?: string;
  realName?: string;
  phone?: string;
  region?: string;
  parentId?: string;
  groupId?: string;
  groupName?: string;
  teamGroupId?: string;
  employeeId?: string;
  commission?: number;
  createdAt?: string;
  parentName?: string;
  superior?: string;
  isGroupLeader?: boolean;
  groupLeaderId?: string;
  // Q5 ① 手动档标识
  manualLevel?: 'P1'|'P2'|'P3'|'P4'|'P5'|'P6'|'P7'|'P8' | string | null;
  manualLevelSetAt?: string | number | Date | null;
}

type RowErrors = Partial<Record<keyof LevelV2ConfigRow | 'global' | 'role', string>>;

const THEME_FALLBACK = getLevelV2Theme('P1');

/** 千分位整数 */
const fmtInt = (n: number) => Number.isFinite(n) ? Math.round(n).toLocaleString('zh-CN') : '0';

/** ISO → 北京时间 YYYY-MM-DD HH:mm:ss，支持 updatedBy 附加 */
function fmtBeijing(iso?: string | Date | null, by?: string | null): string {
  const timeStr = (() => {
    if (!iso) return '从未修改（使用默认档位）';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())} ${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}:${p(bj.getUTCSeconds())}`;
    } catch { return String(iso); }
  })();
  return by ? `${timeStr} · ${by}` : timeStr;
}

// =============================================================
// 校验：严格对齐后端 verification.js 关于 v2 8 档的 10 条硬规则
//   1) 恰好 8 档，按 P1→P8 顺序
//   2) level 必须 ∈ VALID_LEVELS_V2
//   3) 不重复
//   4) name 非空
//   5) commission ∈ (0,1]（不能为 0，否则订单计算出现 0 提成漏洞）
//   6) minRevenue ≥ 0 整数
//   7) targetRevenue ≥ minRevenue
//   8) P1 minRevenue === 0
//   9) commission 严格递增
//  10) 严格衔接：cur.minRevenue === prev.targetRevenue
//  11) targetRevenue 严格递增
// =============================================================
function validateV2(list: LevelV2ConfigRow[]): { perRow: Record<string, RowErrors>; global: string[]; valid: boolean } {
  const perRow: Record<string, RowErrors> = {};
  const global: string[] = [];
  if (!Array.isArray(list)) return { perRow, global: ['list 必须为数组'], valid: false };
  if (list.length !== 8) return { perRow, global: [`必须恰好配置 8 档（${VALID_LEVELS_V2.join('/')}）`], valid: false };

  list.forEach(r => { perRow[r.level] = {}; });

  const lvSet = new Set<string>();
  list.forEach((row, i) => {
    const errs: RowErrors = perRow[row.level] || {};
    const i1 = i + 1;
    if (!VALID_LEVELS_V2.includes(row.level as any)) {
      errs.level = `第${i1}条档位仅支持 ${VALID_LEVELS_V2.join('/')}（当前：${row.level || '空'}）`;
    } else {
      if (lvSet.has(row.level)) errs.level ||= `档位名重复：${row.level}`;
      lvSet.add(row.level);
    }
    if (typeof row.name !== 'string' || row.name.trim().length === 0) errs.name = `第${i1}条 name 不能为空`;
    const c = Number(row.commission);
    if (!Number.isFinite(c) || c <= 0 || c > 1) errs.commission = `第${i1}条提成比例必须在 (0%, 100%] 之间`;
    const mr = Number(row.minRevenue);
    if (!Number.isFinite(mr) || mr < 0 || (mr | 0) !== mr) errs.minRevenue = `第${i1}条升级门槛必须是 ≥ 0 的整数`;
    const tr = Number(row.targetRevenue);
    if (!Number.isFinite(tr) || tr < 0 || (tr | 0) !== tr) errs.targetRevenue = `第${i1}条目标业绩必须是 ≥ 0 的整数`;
    else if (Number.isFinite(mr) && tr < mr) errs.targetRevenue = `第${i1}条目标业绩不能小于升级门槛`;
    // role 必须和档位一致（P1→GROUP_LEADER，P2~P8→NORMAL_ADMIN），否则后端会抛
    const expectedRole = row.level === 'P1' ? UserRole.GROUP_LEADER : UserRole.NORMAL_ADMIN;
    if (row.role && row.role !== expectedRole) errs.role = `档位 ${row.level} 的角色必须为 ${expectedRole}（当前：${row.role}）`;
    perRow[row.level] = errs;
  });

  const ordered = [...list].sort((a, b) => LEVEL_V2_ORDER[a.level] - LEVEL_V2_ORDER[b.level]);

  const P1 = ordered.find(r => r.level === 'P1');
  if (P1 && Number(P1.minRevenue) !== 0) {
    (perRow.P1 ||= {}).minRevenue = 'P1（最低档）升级门槛必须 = 0';
  }

  for (let k = 1; k < ordered.length; k++) {
    const prev = ordered[k - 1];
    const cur = ordered[k];
    const slot = perRow[cur.level] || {};
    if (Number(cur.commission) <= Number(prev.commission)) {
      slot.commission ||= `提成必须严格递增：${prev.level} ${formatCommission(prev.commission)} < ${cur.level} ${formatCommission(cur.commission)} 不成立`;
    }
    if (Number(prev.targetRevenue) !== Number(cur.minRevenue)) {
      slot.minRevenue ||= `区间必须严格衔接：${prev.level}.目标(${fmtInt(prev.targetRevenue)}) === ${cur.level}.门槛(${fmtInt(cur.minRevenue)})`;
    }
    // 目标业绩递增校验：只校验 P1~P7 之间的非顶级；顶级 P8 不再要求 target 比 P7 更大
    //   （因为 P8 是满级，P8.target 可以 = P8.min = P7.target，允许等于 P7.target）
    if (k < ordered.length - 1) {
      if (Number(cur.targetRevenue) <= Number(prev.targetRevenue)) {
        slot.global ||= `目标业绩必须递增：${prev.level}.target(${fmtInt(prev.targetRevenue)}) < ${cur.level}.target(${fmtInt(cur.targetRevenue)}) 不成立`;
      }
    }
    perRow[cur.level] = slot;
  }

  let valid = global.length === 0;
  Object.values(perRow).forEach(e => { if (e && Object.keys(e).length) valid = false; });
  return { perRow, global, valid };
}

const GroupLeaderLevelConfigManagement: React.FC<Props> = ({ onBack }) => {
  // ========== 档位配置 Tab 的 state ==========
  const [rows, setRows] = useState<LevelV2ConfigRow[]>(() => LEVEL_V2_FALLBACK_8.map(r => ({ ...r })));
  const [updatedAt, setUpdatedAt] = useState<string | Date | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaulting, setDefaulting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<{ type:'ok'|'err'|'info'; msg: string } | null>(null);

  // ========== 子 Tab：档位配置 / 职级调整 ==========
  type SubTab = 'config' | 'adjust';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('config');

  // ========== 职级调整 Tab 的 state ==========
  const [admins, setAdmins] = useState<AdjustAccount[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminKeyword, setAdminKeyword] = useState('');

  // 调档弹窗
  const [editingManualLevelAccount, setEditingManualLevelAccount] = useState<AdjustAccount | null>(null);
  const [manualLevelForm, setManualLevelForm] = useState<{
    level: string | null;
    initLevel: string | null;
    saving: boolean;
    error: string | null;
    success: string | null;
  }>({
    level: null,
    initLevel: null,
    saving: false,
    error: null,
    success: null,
  });

  const MANUAL_LEVEL_OPTIONS: Array<{ value: string | null; label: string }> = [
    { value: null, label: '自动档（按累计营收升降，只升不降）' },
    ...VALID_LEVELS_V2.map(lv => ({ value: lv, label: `手动指定 · ${lv}` })),
  ];

  // ========== 统一 toast ==========
  const validation = useMemo(() => validateV2(rows), [rows]);
  const { perRow, global, valid } = validation;

  const showToast = useCallback((type:'ok'|'err'|'info', msg:string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ======= 加载 v2 8 档生效配置 =======
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, updatedAt, updatedBy } = await LEVEL_V2_API.list();
      setRows(rows);
      setUpdatedAt(updatedAt);
      setUpdatedBy(updatedBy);
      setDirty(false);
      setTouched(false);
    } catch (e: any) {
      showToast('err', e?.message || '加载配置失败');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ======= 单元格编辑 =======
  const patchRow = (level: string, patch: Partial<LevelV2ConfigRow>) => {
    setRows(prev => prev.map(r => r.level === level ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const onChangeName = (lv: string, v: string) => patchRow(lv, { name: v });

  const onChangeCommissionPct = (lv: string, raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    if (cleaned === '') { patchRow(lv, { commission: NaN as any }); return; }
    const dec = Number((Number(cleaned) / 100).toFixed(6));
    patchRow(lv, { commission: Number.isFinite(dec) ? dec : NaN as any });
  };

  const onChangeMinRevenue = (lv: string, raw: string) => {
    if (lv === 'P1') return; // P1 固定 0 不许改
    const cleaned = raw.replace(/[^\d]/g, '');
    patchRow(lv, { minRevenue: cleaned === '' ? NaN as any : Number(cleaned) });
  };

  const onChangeTargetRevenue = (lv: string, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '');
    patchRow(lv, { targetRevenue: cleaned === '' ? NaN as any : Number(cleaned) });
  };

  // ======= 保存 v2 8 档 =======
  const onSave = async () => {
    setTouched(true);
    await new Promise(r => setTimeout(r, 0));
    if (!validateV2(rows).valid) { showToast('err', '表单校验未通过，请检查红色提示行'); return; }
    setSaving(true);
    try {
      const body = rows.map(r => ({
        level: r.level,
        name: String(r.name || r.level).trim(),
        commission: Number(Number(r.commission).toFixed(6)),
        minRevenue: Math.round(Number(r.minRevenue || 0)),
        targetRevenue: Math.round(Number(r.targetRevenue || 0)),
        role: r.level === 'P1' ? UserRole.GROUP_LEADER : UserRole.NORMAL_ADMIN,
      }));
      const resp: any = await LEVEL_V2_API.save(body as any);
      const msg = (resp && (resp.message || resp.msg)) || '保存成功，所有人员职级按新档位实时刷新';
      showToast('ok', msg);
      await loadConfig();
    } catch (e: any) {
      showToast('err', e?.message || '保存失败');
    } finally { setSaving(false); }
  };

  // ======= 恢复默认 =======
  const onRequestReset = () => {
    if (loading || saving || defaulting) return;
    setShowResetConfirm(true);
  };
  const onConfirmReset = async () => {
    setShowResetConfirm(false);
    setDefaulting(true); setSaving(true);
    try {
      // v2 有 /default 接口（可无，catch 兜底用 LEVEL_V2_FALLBACK_8 回填 state）
      let defaults = LEVEL_V2_FALLBACK_8;
      try { defaults = normalizeLevelConfig(await LEVEL_V2_API.getDefault()); } catch { /* keep local fallback */ }
      // 真正写后端：PUT v2 list=defaults
      const body = defaults.map(r => ({
        level: r.level,
        name: r.name,
        commission: Number(Number(r.commission).toFixed(6)),
        minRevenue: Math.round(r.minRevenue),
        targetRevenue: Math.round(r.targetRevenue),
        role: r.role,
      }));
      const resp: any = await LEVEL_V2_API.save(body as any);
      const msg = (resp && (resp.message || resp.msg)) || '已恢复默认档位';
      showToast('ok', msg);
      await loadConfig();
    } catch (e: any) {
      showToast('err', e?.message || '恢复默认失败');
    } finally { setDefaulting(false); setSaving(false); }
  };

  const anyRowHasError = (lv: string) => touched && perRow[lv] && Object.keys(perRow[lv]!).length > 0;

  // ======= 职级调整：加载账号列表（GL/TL） =======
  const fetchAdmins = useCallback(async () => {
    setAdminLoading(true);
    try {
      const [teamResponse, employeeResponse] = await Promise.all([
        request<any>('/admin/account/list?pageSize=200', { method: 'GET' }).catch(e => { console.warn('list admins err', e); return null; }),
        request<any>('/admin/employee/list?pageSize=2000', { method: 'GET' }).catch(e => { console.warn('list employees err', e); return null; }),
      ]);
      const rawTeamAccounts: any[] =
        (Array.isArray(teamResponse) ? teamResponse : (teamResponse?.admins || teamResponse?.list || [])) || [];
      const rawEmployees: any[] =
        (Array.isArray(employeeResponse) ? employeeResponse : (employeeResponse?.data || employeeResponse?.list || [])) || [];

      // 从团队账号提 GL/TL
      const teamGL = rawTeamAccounts.filter(a => /group_?leader/i.test(a.role || ''));
      const teamTL = rawTeamAccounts.filter(a => /normal_admin/i.test(a.role || '') || /team_?leader/i.test(a.role || ''));
      // 从员工账号提有 groupId 或 isGroupLeader 的组长
      const empGL = rawEmployees.filter((e: any) =>
        e.isGroupLeader || /group_?leader/i.test(e.role || '') ||
        ((e.groupId || e.teamGroupId) && (e.groupId || e.teamGroupId) !== '')
      );

      // 合并 + 去重（按 _id）
      const seen = new Set<string>();
      const merged: AdjustAccount[] = [];
      for (const src of [teamTL, teamGL, empGL] as any[][]) {
        for (const a of src) {
          const id = String(a._id || a.id || a.employeeId || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push({
            _id: id,
            username: String(a.username || a.employeeId || '未知账号'),
            role: String(a.role || ''),
            status: a.status,
            teamName: a.teamName || a.parentName || a.superior || '',
            realName: a.realName || a.name || a.username || '',
            phone: a.phone,
            region: a.region,
            parentId: a.parentId,
            groupId: a.groupId || a.teamGroupId,
            groupName: a.groupName,
            teamGroupId: a.teamGroupId,
            employeeId: a.employeeId,
            commission: Number(a.commission),
            createdAt: a.createdAt,
            parentName: a.parentName,
            superior: a.superior,
            isGroupLeader: a.isGroupLeader,
            groupLeaderId: a.groupLeaderId,
            manualLevel:
              a.manualLevel && typeof a.manualLevel === 'string' && /^P[1-8]$/.test(a.manualLevel)
                ? a.manualLevel
                : (a.manualLevel as any) ?? null,
            manualLevelSetAt: a.manualLevelSetAt || null,
          });
        }
      }
      // 按档位 + 手动/自动排序：手动在前，档位高在前
      merged.sort((a, b) => {
        const ma = a.manualLevel != null ? 0 : 1;
        const mb = b.manualLevel != null ? 0 : 1;
        if (ma !== mb) return ma - mb;
        const la = LEVEL_V2_ORDER[String(a.manualLevel ?? 'P0')] || 0;
        const lb = LEVEL_V2_ORDER[String(b.manualLevel ?? 'P0')] || 0;
        return lb - la;
      });

      // ========== 只保留团队长（实际档位 P2+），过滤组长 GL（P1）==========
      // 用户需求：职级调整只给团队长调档；组长（P1）晋升 TL 由后端自动机制处理
      const onlyTL = merged.filter(a => {
        const role = (a.role || '').toUpperCase();
        // 1) 角色明确是团队长 TL
        if (role === 'NORMAL_ADMIN' || /TEAM_?LEADER/i.test(a.role || '')) return true;
        // 2) 手动档 P2~P8（接口晋升后 role 未及时刷新的兜底）
        if (a.manualLevel && /^P[2-8]$/.test(String(a.manualLevel))) return true;
        // 3) 按 commission 反推实际档位 ≥ P2
        const c = Number(a.commission);
        if (Number.isFinite(c)) {
          const P2 = rows.find(r => r.level === 'P2');
          if (P2 && Number.isFinite(Number(P2.commission)) && c >= Number(P2.commission) - 1e-6) return true;
          // 兜底：团队长最低提成 8%（P2 默认）
          if (c >= 0.08 - 1e-6) return true;
        }
        return false;
      });

      setAdmins(onlyTL);
    } catch (e: any) {
      console.error('fetch admins err', e);
      setAdmins([]);
      showToast('err', '加载账号列表失败');
    } finally { setAdminLoading(false); }
  }, [rows, showToast]);

  // 切到职级调整 tab 时自动拉一次
  useEffect(() => {
    if (activeSubTab === 'adjust' && admins.length === 0 && !adminLoading) {
      fetchAdmins();
    }
  }, [activeSubTab, admins.length, adminLoading, fetchAdmins]);

  // ======= 职级调整：打开弹窗 =======
  const handleOpenAdjustModal = useCallback((a: AdjustAccount) => {
    // Q5 ①：manualLevel ≠ null → 手动档
    const cur: string | null =
      a.manualLevel && typeof a.manualLevel === 'string' && /^P[1-8]$/.test(a.manualLevel)
        ? a.manualLevel
        : null;
    setEditingManualLevelAccount(a);
    setManualLevelForm({
      level: cur,
      initLevel: cur,
      saving: false,
      error: null,
      success: null,
    });
  }, []);

  const handleCloseAdjustModal = useCallback(() => {
    setEditingManualLevelAccount(null);
    setManualLevelForm({ level: null, initLevel: null, saving: false, error: null, success: null });
  }, []);

  /**
   * 推导账号当前实际档位 Px：
   * 1) 手动档 → 直接用 manualLevel；
   * 2) 自动档 → 用 Admin.commission 反查 rows 中匹配的档位（精确或最近）；
   * 3) 兜底 → TL=P2，GL/其他=P1。
   */
  const deriveCurrentLevel = useCallback((a: AdjustAccount): string => {
    if (a.manualLevel && /^P[1-8]$/.test(String(a.manualLevel))) {
      return String(a.manualLevel);
    }
    const c = Number(a.commission);
    if (Number.isFinite(c) && c > 0) {
      // 精确匹配（浮点误差容差）
      const exact = rows.find(r => Math.abs(Number(r.commission) - c) < 1e-6);
      if (exact) return exact.level;
      // 找 commission 最接近的档
      let best: LevelV2ConfigRow | null = null;
      let bestDiff = Infinity;
      rows.forEach(r => {
        const rc = Number(r.commission);
        if (!Number.isFinite(rc)) return;
        const diff = Math.abs(rc - c);
        if (diff < bestDiff) { bestDiff = diff; best = r; }
      });
      if (best) return best.level;
    }
    // 兜底：按角色
    const role = (a.role || '').toUpperCase();
    const isTL = role === 'NORMAL_ADMIN' || /TEAM_?LEADER/i.test(role);
    if (isTL) return 'P2';
    return 'P1';
  }, [rows]);

  // ======= 职级调整：PUT /admin/:id/manual-level =======
  const handleApplyManualLevel = useCallback(async () => {
    if (!editingManualLevelAccount) return;
    const role = (editingManualLevelAccount.role || '').toUpperCase();
    const isTL = role === 'NORMAL_ADMIN' || /TEAM_?LEADER/i.test(role);
    const isGL =
      role === 'GROUP_LEADER' || /group_?leader/i.test(role) ||
      editingManualLevelAccount.isGroupLeader === true ||
      (editingManualLevelAccount.groupId != null && String(editingManualLevelAccount.groupId) !== '');

    // Q5 ④：TL 不允许降回 P1
    if (isTL && manualLevelForm.level === 'P1') {
      setManualLevelForm(s => ({ ...s, error: 'TL 不允许降回组长 P1；最低仅可降为 TL P2（8%）', success: null }));
      return;
    }
    if (manualLevelForm.level === manualLevelForm.initLevel) {
      setManualLevelForm(s => ({ ...s, error: null, success: '未修改，无需保存' }));
      return;
    }
    setManualLevelForm(s => ({ ...s, saving: true, error: null, success: null }));
    try {
      const res = await LEVEL_V2_API.setManualLevel(editingManualLevelAccount._id, manualLevelForm.level);
      const msg =
        (res && (res.message || res.msg)) ||
        (manualLevelForm.level == null
          ? '已恢复自动按累计营收升降档位'
          : `已手动指定为 ${manualLevelForm.level}（不自动升降）`);
      // 同步本地列表
      setAdmins(prev => prev.map(a => a._id === editingManualLevelAccount._id
        ? { ...a, manualLevel: manualLevelForm.level, manualLevelSetAt: new Date() }
        : a
      ));
      setManualLevelForm(s => ({ ...s, initLevel: manualLevelForm.level, saving: false, error: null, success: msg }));
      showToast('ok', msg);
    } catch (e: any) {
      setManualLevelForm(s => ({
        ...s,
        saving: false,
        success: null,
        error: (e && (e.message || e.msg)) || '调档失败，请稍后重试',
      }));
    }
  }, [editingManualLevelAccount, manualLevelForm.level, manualLevelForm.initLevel, showToast]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-300 pb-48">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white px-4 py-4 border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-gray-600 active:bg-gray-100">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex items-center">
            <Award className="mr-2 text-indigo-500" size={22} />
            职级管理
          </h1>
          {/* 红框位置：快速切换到「职级调整」tab 的小按钮 */}
          <button
            type="button"
            onClick={() => setActiveSubTab(activeSubTab === 'adjust' ? 'config' : 'adjust')}
            className={`px-3 h-9 rounded-xl text-[11px] font-black flex items-center space-x-1 transition active:scale-[0.97] ${
              activeSubTab === 'adjust'
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-200 ring-1 ring-orange-200'
                : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100'
            }`}
            title={activeSubTab === 'adjust' ? '返回档位配置' : '快速进入职级调整（给具体人调档）'}
          >
            <Wrench size={13} />
            <span>{activeSubTab === 'adjust' ? '档位配置' : '职级调整'}</span>
          </button>
        </div>

        {/* 下方水平分段 tab（更明显，主切换控件） */}
        <div className="mt-4 grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100/80 ring-1 ring-gray-200">
          {([
            { k: 'config' as SubTab, label: '档位配置', hint: '8 档门槛/比例', icon: Award },
            { k: 'adjust' as SubTab, label: '职级调整', hint: '按人手动调档', icon: Wrench },
          ]).map(({ k, label, hint, icon: I }) => {
            const active = activeSubTab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActiveSubTab(k)}
                className={`relative h-11 rounded-xl flex flex-col items-center justify-center space-y-0.5 transition-all duration-200 ${
                  active
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <I size={15} className={active ? 'text-indigo-500' : 'text-gray-400'} />
                  <span className="text-[13px] font-black tracking-wide">{label}</span>
                </div>
                <span className={`text-[9.5px] ${active ? 'text-indigo-400 font-semibold' : 'text-gray-400'}`}>{hint}</span>
                {active && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-[90%]">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' :
            toast.type === 'err' ? 'bg-rose-600 text-white' :
            'bg-gray-800 text-white'}`}>
            {toast.type === 'ok' && <CheckCircle size={18} />}
            {toast.type === 'err' && <XCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span className="text-sm font-medium whitespace-pre-wrap break-words">{toast.msg}</span>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* ============== Tab 1：档位配置（v2 统一 8 档） ============== */}
        {activeSubTab === 'config' && (
          <>
            {/* 说明卡：v2 统一 8 档 */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 border border-violet-100 p-4 text-slate-700">
              <div className="flex items-start space-x-3">
                <Info className="mt-0.5 flex-shrink-0 text-violet-500" size={20} />
                <div className="text-[13px] leading-relaxed">
                  <div className="font-semibold text-slate-900 mb-1">v2 统一职级配置 · 配置说明（P1=组长，P2~P8=团队长）</div>
                  共 <strong>8 档</strong> 联动一张表：超管改 P2 的门槛会直接决定 <strong>组长自动晋升团队长的阈值</strong>。
                  <br />
                  <span className="text-violet-600">保存或恢复默认后，后端会立即清所有业绩缓存，刷新页面即可按新档位实时算职级。</span>
                  <br />
                  <span className="text-slate-500">严格衔接规则：上一档的 <em>目标业绩</em> 必须等于下一档的 <em>升级门槛</em>。</span>
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                <Loader2 className="animate-spin mb-2 text-indigo-500" size={26} />
                <div className="text-sm">加载 8 档职级配置中...</div>
              </div>
            )}

            {touched && global.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-start space-x-2">
                <AlertTriangle className="text-rose-500 mt-0.5 flex-shrink-0" size={18} />
                <ul className="text-rose-700 text-sm space-y-0.5">
                  {global.map((g,i)=>(<li key={i}>• {g}</li>))}
                </ul>
              </div>
            )}

            {/* 8 档编辑表（P1 显示『组长』标识，P2~P8 显示『团队长』标识） */}
            {!loading && (
              <div className="space-y-3">
                {VALID_LEVELS_V2.map(lv => {
                  const row = rows.find(r => r.level === lv) || normalizeLevelConfig(rows).find(r=>r.level===lv)!;
                  const theme = getLevelV2Theme(lv) || THEME_FALLBACK;
                  const err = perRow[lv];
                  const hasErr = anyRowHasError(lv);
                  const borderClass = hasErr ? 'border-rose-300 ring-1 ring-rose-200' : 'border-gray-100';
                  const commPct = Number.isFinite(Number(row.commission))
                    ? Number(Number(row.commission * 100).toFixed(4))
                    : (NaN as any);
                  const isGL = lv === 'P1';
                  return (
                    <div key={lv} className={`rounded-2xl bg-white shadow-sm border p-4 space-y-3 ${borderClass}`}>
                      {/* 档位标题行 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${theme.rowBadge}`}>职级{lv}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isGL ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100' : 'bg-violet-50 text-violet-600 ring-1 ring-violet-100'
                          }`}>
                            {isGL ? '组长·GL' : '团队长·TL'}
                          </span>
                        </div>
                        <div className={`flex items-center space-x-1.5 text-[11px] ${theme.rowText}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${theme.rowDot}`} />
                          <span>
                            {lv !== 'P8'
                              ? `业绩 ≥ ${fmtInt(row.minRevenue)} 元 升级`
                              : `顶级（≥ ${fmtInt(row.targetRevenue)} 元 满级）`}
                          </span>
                        </div>
                      </div>

                      {/* 2 列 2 行编辑 */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* 提成比例（百分比） */}
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">提成比例</label>
                          <div className="relative">
                            <input
                              type="text" inputMode="decimal"
                              value={Number.isFinite(commPct) ? String(commPct) : ''}
                              onChange={e => onChangeCommissionPct(lv, e.target.value)}
                              className={`w-full px-3 py-2 pr-8 text-sm rounded-xl border outline-none transition-all
                                ${hasErr && err?.commission
                                  ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                  : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}`}
                              placeholder={isGL ? '6' : '12'}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">%</span>
                          </div>
                          {hasErr && err?.commission && <p className="mt-1 text-[11px] text-rose-600">{err.commission}</p>}
                        </div>

                        {/* minRevenue */}
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">升级门槛 <span className="text-gray-400">（元，≥ 即进入本级）</span></label>
                          <input
                            type="text" inputMode="numeric"
                            disabled={lv === 'P1'}
                            value={Number.isFinite(Number(row.minRevenue)) ? String(Math.round(Number(row.minRevenue))) : ''}
                            onChange={e => onChangeMinRevenue(lv, e.target.value)}
                            className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all
                              ${lv === 'P1'
                                ? 'bg-gray-50 border-gray-200 text-gray-500'
                                : hasErr && err?.minRevenue
                                  ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                  : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}`}
                            placeholder={lv === 'P1' ? '0（固定）' : '400000'}
                          />
                          {hasErr && err?.minRevenue && <p className="mt-1 text-[11px] text-rose-600">{err.minRevenue}</p>}
                        </div>

                        {/* targetRevenue */}
                        <div className="col-span-2">
                          <label className="block text-[11px] text-gray-500 mb-1">
                            档位目标业绩 <span className="text-gray-400">（元）—— 用于路径图进度 & 顶级判定 & 下一档衔接</span>
                          </label>
                          <input
                            type="text" inputMode="numeric"
                            value={Number.isFinite(Number(row.targetRevenue)) ? String(Math.round(Number(row.targetRevenue))) : ''}
                            onChange={e => onChangeTargetRevenue(lv, e.target.value)}
                            className={`w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all
                              ${hasErr && err?.targetRevenue
                                ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}`}
                            placeholder={isGL ? '100000' : '400000'}
                          />
                          {hasErr && err?.targetRevenue && <p className="mt-1 text-[11px] text-rose-600">{err.targetRevenue}</p>}
                          {hasErr && err?.role && <p className="mt-1 text-[11px] text-rose-600">{err.role}</p>}
                        </div>

                        {hasErr && err?.global && (
                          <div className="col-span-2 flex items-start space-x-1.5 text-[11px] text-rose-600 rounded-lg bg-rose-50 px-2.5 py-1.5">
                            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                            <span>{err.global}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 最近保存 */}
            {!loading && (
              <div className="rounded-xl bg-white border border-gray-100 px-4 py-3 flex items-center justify-between text-[12px] text-gray-500">
                <span className="flex items-center"><Info size={14} className="mr-1.5 text-gray-400" />最近保存于</span>
                <span className="font-medium text-gray-700">{fmtBeijing(updatedAt as any, updatedBy as any)}</span>
              </div>
            )}
          </>
        )}

        {/* ============== Tab 2：职级调整（给具体人调档） ============== */}
        {activeSubTab === 'adjust' && (
          <>
            {/* 顶部说明 + 搜索 + 刷新 */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100 p-4 text-slate-700">
              <div className="flex items-start space-x-3">
                <Wrench className="mt-0.5 flex-shrink-0 text-amber-500" size={20} />
                <div className="text-[13px] leading-relaxed">
                  <div className="font-semibold text-slate-900 mb-1">职级调整 · 对人调档（Q5 ①~⑥ 规则）</div>
                  • 「自动档」（默认）：按累计营收自动升降，<span className="text-amber-700 font-medium">只升不降</span>。<br />
                  • 「手动 · Px」：强制指定档位，不自动升降；可点「恢复自动计算」。<br />
                  • 手动指定 <strong>P2~P8 给组长（GL）</strong> 时，接口内部自动触发晋升，<span className="text-amber-700 font-medium">无需再调「晋升接口」</span>。<br />
                  • <strong>团队长（TL）最低 P2（8%）</strong>，禁止手动设为 P1 组长。
                </div>
              </div>
            </div>

            {/* 搜索 + 刷新 */}
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={adminKeyword}
                  onChange={e => setAdminKeyword(e.target.value)}
                  placeholder="搜姓名 / 账号 / 团队 / 小组"
                  className="w-full pl-9 pr-3 h-11 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchAdmins()}
                disabled={adminLoading}
                className="h-11 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 text-[12px] font-bold flex items-center justify-center space-x-1 active:bg-gray-50 disabled:opacity-60"
              >
                {adminLoading ? <Loader2 size={14} className="animate-spin text-amber-500" /> : <RotateCcw size={14} className="text-amber-500" />}
                <span>刷新</span>
              </button>
            </div>

            {/* loading 空态 */}
            {adminLoading && admins.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-gray-500">
                <Loader2 className="animate-spin mb-3 text-amber-500" size={28} />
                <div className="text-sm font-semibold">加载组长/团队长账号列表中…</div>
                <div className="text-xs text-gray-400 mt-1">后端未上线时显示 0 条属正常</div>
              </div>
            )}

            {/* 账号列表 */}
            {!adminLoading && admins.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400 space-y-2">
                <Users size={40} className="opacity-20" />
                <div className="text-sm font-semibold">暂无账号</div>
                <div className="text-[11px]">点右上「刷新」重试；或先去账号管理开设组长/团队长</div>
              </div>
            )}

            {!adminLoading && admins.length > 0 && (
              <div className="space-y-2.5">
                {(() => {
                  const kw = adminKeyword.trim();
                  const list = kw
                    ? admins.filter(a => {
                        const s = `${a.realName}|${a.username}|${a.teamName}|${a.groupName}|${a.phone}|${a.employeeId}`.toLowerCase();
                        return s.includes(kw.toLowerCase());
                      })
                    : admins;
                  if (kw && list.length === 0) {
                    return (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        没有匹配「{kw}」的账号
                      </div>
                    );
                  }
                  return list.map(a => {
                    const role = (a.role || '').toUpperCase();
                    const isTL = role === 'NORMAL_ADMIN' || /TEAM_?LEADER/i.test(role);
                    const isGL =
                      role === 'GROUP_LEADER' || /group_?leader/i.test(role) ||
                      a.isGroupLeader === true ||
                      (a.groupId != null && String(a.groupId) !== '');
                    const roleTag = isTL
                      ? { txt: '团队长·TL', cls: 'bg-violet-50 text-violet-700 ring-violet-100' }
                      : isGL
                        ? { txt: '组长·GL', cls: 'bg-sky-50 text-sky-700 ring-sky-100' }
                        : { txt: '账号', cls: 'bg-gray-50 text-gray-600 ring-gray-100' };
                    const isManual = a.manualLevel != null;
                    const currentLv = deriveCurrentLevel(a);
                    const displayLevel = isManual ? String(a.manualLevel) : currentLv;
                    // 主题色（用当前档位 Px，不再用 commission 兜底猜）
                    const levelThemeKey = /^P[1-8]$/.test(currentLv) ? currentLv : (isTL ? 'P2' : 'P1');
                    const t = getLevelV2Theme(levelThemeKey as any) || THEME_FALLBACK;
                    const fmtAt = (() => {
                      if (!isManual || !a.manualLevelSetAt) return null;
                      try {
                        const d = new Date(a.manualLevelSetAt);
                        if (Number.isNaN(d.getTime())) return null;
                        const pad = (n: number) => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      } catch { return null; }
                    })();
                    return (
                      <div
                        key={a._id}
                        className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3.5 flex items-start gap-3"
                      >
                        {/* 头像占位 */}
                        <div className={`w-11 h-11 rounded-2xl ${t.rowBadge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-[13px] font-black">
                            {(a.realName || a.username || '?').slice(0, 1).toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* 姓名 + 档位 badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-black text-gray-900 leading-tight truncate">
                              {a.realName || a.username || '未命名'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${roleTag.cls}`}>
                              {roleTag.txt}
                            </span>
                            {/* Q5 ①：手动/自动标识 + Px 档位 */}
                            {isManual ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-100/80 text-amber-800 text-[10px] font-black ring-1 ring-amber-200">
                                <Wrench size={10} />
                                <span>手动 · {displayLevel}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-black ring-1 ring-sky-100">
                                <Zap size={10} />
                                <span>自动 · {displayLevel}</span>
                              </span>
                            )}
                          </div>

                          {/* 账号 + 提成 */}
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-gray-500">
                            <span className="truncate">
                              <span className="text-gray-400 mr-1">账号</span>
                              {a.username}
                            </span>
                            {Number.isFinite(Number(a.commission)) && (
                              <span>
                                <span className="text-gray-400 mr-1">提成</span>
                                <span className={`font-black ${t.badgeText}`}>{formatCommission(a.commission)}</span>
                              </span>
                            )}
                            {a.teamName && (
                              <span className="truncate">
                                <span className="text-gray-400 mr-1">团队</span>
                                {a.teamName}
                              </span>
                            )}
                            {a.groupName && (
                              <span className="truncate">
                                <span className="text-gray-400 mr-1">小组</span>
                                {a.groupName}
                              </span>
                            )}
                          </div>

                          {fmtAt && (
                            <div className="text-[10.5px] text-amber-700/80 font-medium">
                              · 最近手动调整于 {fmtAt}
                            </div>
                          )}
                        </div>

                        {/* 右侧：调整职级按钮 */}
                        <button
                          type="button"
                          onClick={() => handleOpenAdjustModal(a)}
                          className="flex-shrink-0 h-9 px-3 rounded-xl text-[11.5px] font-black inline-flex items-center space-x-1 transition active:scale-[0.97] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-orange-200 ring-1 ring-orange-200/50 hover:shadow-md hover:from-amber-500 hover:to-orange-600"
                        >
                          <Edit2 size={12} />
                          <span>调整职级</span>
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部按钮栏：只在档位配置 Tab 显示（职级调整无批量保存） */}
      {activeSubTab === 'config' && (
      <div className="fixed left-0 right-0 z-30 max-w-md mx-auto" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 py-3 bg-white/95 backdrop-blur border-t border-gray-100 flex items-center space-x-3">
          <button
            disabled={saving || loading || defaulting}
            onClick={onRequestReset}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold flex items-center justify-center space-x-1.5 active:bg-gray-50 disabled:opacity-50"
          >
            {defaulting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            <span>恢复默认</span>
          </button>
          <button
            disabled={saving || loading || defaulting || !dirty || (touched && !valid)}
            onClick={() => { setTouched(true); setTimeout(() => onSave(), 0); }}
            className={`flex-[1.4] h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center space-x-1.5 shadow-md active:shadow-none disabled:shadow-none disabled:cursor-not-allowed transition-all
              bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-600 shadow-indigo-500/20 active:from-indigo-600 active:via-violet-600 active:to-fuchsia-700 disabled:from-gray-300 disabled:via-gray-400 disabled:to-gray-400`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? '保存中...' : (dirty ? '保存 8 档配置' : '暂无改动')}</span>
          </button>
        </div>
      </div>
      )}

      {/* 恢复默认确认弹框 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">确认恢复 v2 默认 8 档？</h3>
                <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                  将覆盖你当前修改，恢复为系统默认档位。
                  <br />
                  <span className="text-amber-600 font-medium">
                    确认后，所有组长/团队长的职级会立即按默认档位刷新。
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 pt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold active:bg-gray-50"
              >取消</button>
              <button
                onClick={onConfirmReset}
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold shadow-sm active:bg-amber-600 flex items-center justify-center space-x-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                <span>确认恢复默认</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 职级调整：调档弹窗 ========== */}
      {editingManualLevelAccount && (() => {
        const a = editingManualLevelAccount;
        const role = (a.role || '').toUpperCase();
        const isTL = role === 'NORMAL_ADMIN' || /TEAM_?LEADER/i.test(role);
        const isGL =
          role === 'GROUP_LEADER' || /group_?leader/i.test(role) ||
          a.isGroupLeader === true ||
          (a.groupId != null && String(a.groupId) !== '');
        const isManual = manualLevelForm.level != null;
        const curLevel = manualLevelForm.level;
        const actualPx = deriveCurrentLevel(a);
        const formPx = isManual ? (curLevel || actualPx) : actualPx;
        // 展示当前档位对应的提成（优先编辑表单选中的档位对应的 v2 8 档配置，兜底用账号本身的 commission）
        const selectedCfgRow = curLevel
          ? rows.find(r => r.level === curLevel)
          : null;
        const displayCommission =
          (selectedCfgRow && Number.isFinite(Number(selectedCfgRow.commission)))
            ? Number(selectedCfgRow.commission)
            : Number.isFinite(Number(a.commission)) ? Number(a.commission) : NaN;
        return (
          <div className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center sm:p-4" onClick={handleCloseAdjustModal}>
            <div
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* 标题栏 */}
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-black text-gray-900 flex items-center space-x-1.5">
                    <Wrench size={17} className="text-orange-500" />
                    <span>调整职级档位</span>
                  </h3>
                  <p className="text-[12px] text-gray-500 mt-1 truncate">
                    {a.realName || a.username || '未命名'}（{isTL ? '团队长·TL' : isGL ? '组长·GL' : a.role || '账号'}）
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  className="w-9 h-9 -mr-1 -mt-1 rounded-xl text-gray-400 hover:bg-white/80 hover:text-gray-700 flex items-center justify-center"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto hide-scrollbar">
                {/* 当前档位摘要卡 */}
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-3.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-gray-500">当前：自动/手动</span>
                      {isManual ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-100/90 text-amber-800 text-[10.5px] font-black ring-1 ring-amber-200">
                          <Wrench size={10} />
                          <span>手动 · {formPx}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-700 text-[10.5px] font-black ring-1 ring-sky-100">
                          <Zap size={10} />
                          <span>自动 · {formPx}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-600">
                      该账号当前提成比例
                      {Number.isFinite(displayCommission) ? (
                        <span className="ml-1 font-black text-orange-700">{formatCommission(displayCommission)}</span>
                      ) : (
                        <span className="ml-1 text-gray-400">（来源 Admin.commission 字段）--%</span>
                      )}
                    </div>
                  </div>
                  {isGL && isManual && /^P[2-8]$/.test(curLevel || '') && (
                    <div className="mt-2 rounded-xl bg-white/70 border border-white ring-1 ring-dashed ring-amber-300 px-2.5 py-1.5 text-[10.5px] text-amber-700 font-semibold flex items-start space-x-1.5">
                      <span aria-hidden>✨</span>
                      <span>手动指定 P2~P8 给组长时，接口内部会自动触发晋升事务，无需再调「晋升接口」。</span>
                    </div>
                  )}
                </div>

                {/* 档位选择器 */}
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-2">
                    选择档位 <span className="text-gray-400 font-medium ml-1">（选「自动档」恢复自动计算）</span>
                  </label>
                  <div className="relative">
                    <select
                      value={curLevel == null ? '__AUTO__' : curLevel}
                      onChange={e => {
                        const v = e.target.value;
                        setManualLevelForm(s => ({
                          ...s,
                          level: v === '__AUTO__' ? null : v,
                          error: null,
                          success: null,
                        }));
                      }}
                      disabled={manualLevelForm.saving}
                      className="w-full h-11 px-3.5 pr-9 rounded-xl bg-white border border-gray-200 text-[13.5px] font-semibold text-gray-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-60 appearance-none"
                    >
                      {MANUAL_LEVEL_OPTIONS.map(opt => (
                        <option key={opt.value == null ? '__AUTO__' : String(opt.value)} value={opt.value == null ? '__AUTO__' : String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronRight
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Q5 ④：TL 禁选 P1 */}
                {isTL && manualLevelForm.level === 'P1' && (
                  <div className="flex items-start space-x-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] text-rose-700 font-semibold">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-rose-500" />
                    <span>TL 不允许降回组长 P1；最低仅可降为 TL P2（8%）</span>
                  </div>
                )}

                {/* 错误 / 成功提示 */}
                {manualLevelForm.error && (
                  <div className="flex items-start space-x-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-[11.5px] text-rose-700 font-semibold">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-rose-500" />
                    <span>{manualLevelForm.error}</span>
                  </div>
                )}
                {manualLevelForm.success && !manualLevelForm.error && (
                  <div className="flex items-start space-x-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11.5px] text-emerald-700 font-semibold">
                    <CheckCircle size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                    <span>{manualLevelForm.success}</span>
                  </div>
                )}
              </div>

              {/* 底部按钮 */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  disabled={manualLevelForm.saving}
                  className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-gray-700 text-[13px] font-bold active:bg-gray-50 disabled:opacity-50"
                >关闭</button>
                <button
                  type="button"
                  onClick={handleApplyManualLevel}
                  disabled={
                    manualLevelForm.saving ||
                    (isTL && manualLevelForm.level === 'P1')
                  }
                  className={`flex-[1.4] h-11 rounded-xl text-white text-[13px] font-black flex items-center justify-center space-x-1.5 shadow-md active:shadow-none disabled:shadow-none disabled:opacity-60 disabled:cursor-not-allowed transition-all
                    bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 shadow-orange-500/20 active:from-amber-600 active:via-orange-600 active:to-rose-600`}
                >
                  {manualLevelForm.saving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>{manualLevelForm.saving ? '应用中…' : '应用档位设置'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GroupLeaderLevelConfigManagement;
