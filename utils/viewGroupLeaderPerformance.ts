// utils/viewGroupLeaderPerformance.ts
// 纯函数：按钮显示条件 / 缓存 key / 请求 URL / 身份解析 —— 团队长点「看某组长业绩」链路全链路复用。
// 零依赖、可测。
import { UserRole } from '../types';

export type ViewGroupLeaderTarget = {
  groupLeaderId: string;       // 目标组长 userId（后端 resolveTargetAdmin 三选一任中其一都行，兜底用 group.id）
  groupLeaderName: string;     // 显示用面包屑名（组长名字；没拿到时兜底组名）
  fromGroupName: string;       // 显示用面包屑名（来自哪个组）
  /** 目标角色（GROUP_LEADER / NORMAL_ADMIN / SUPER_ADMIN），用于 App.tsx 分发到对应的业绩组件，保证 view-as-other 和本人底栏业绩页面 100% 一致 */
  groupLeaderRole?: string | null;
  /** 兜底角色识别：commission < 0.08 视为 GL（组长/P1），>= 0.08 视为 TL（团队长/P2+）；当 groupLeaderRole 缺失时 App.tsx 按 commission 兜底分发 */
  commission?: number | null;
  /** ID 袋：后端 resolveTargetAdmin 支持多种 ID 类型（ObjectId / Admin.userId / Employee.employeeId / UserGold.userId 等），
   *  view-as-other 模式下统一把所有候选 ID 同时作为 query 参数带上，后端"三任一命中"即可正确解析，
   *  杜绝「前端只传 employeeId 而后端按 Admin._id 查 → 全 0 数据」的 ID 口径不匹配问题 */
  idBag?: {
    userId?: string | null;
    adminId?: string | null;
    employeeId?: string | null;
    objectId?: string | null;
    groupId?: string | null;
  } | null;
};

export type GLPMode = 'self' | 'view-as-other';

/**
 * [A] 按钮显示条件。
 * 设计原则（产品明确要求）：
 *   - 只要当前登录人是 团队长(NORMAL_ADMIN) 或 超管(superadmin) + 组基本信息存在 → 永远显示
 *   - 不再依赖 `groupLeaderId/groupLeaderName` 是否存在（后端未上线、或字段还没打通的过渡期也要先有按钮入口）
 *     没拿到组长信息时，点击跳转后页面按 EMPTY_DATA 全 0 显示即可（request 层会兜底）
 *   - GROUP_LEADER / EMPLOYEE / 普通用户一律不显示
 */
export function shouldShowViewGroupLeaderButton(
  currentUserRole: UserRole | string | null | undefined,
  group: { id?: string | null; groupId?: string | null; name?: string | null; groupName?: string | null } | null | undefined,
): boolean {
  if (!group) return false;
  const hasBasicInfo = Boolean(
    String(group.id || group.groupId || '').trim() || String(group.name || group.groupName || '').trim()
  );
  if (!hasBasicInfo) return false;
  // 组长角色 / 员工角色不显示
  if (currentUserRole === UserRole.GROUP_LEADER) return false;
  if (currentUserRole === UserRole.EMPLOYEE) return false;
  return currentUserRole === UserRole.NORMAL_ADMIN || currentUserRole === 'superadmin' || currentUserRole === UserRole.SUPER_ADMIN || currentUserRole === UserRole.ADMIN_MANAGER;
}

/**
 * [A+] 点击按钮时构造 ViewGroupLeaderTarget。
 * 兜底逻辑（保证 onClick 永远能构造，不因为缺字段跳不过去）：
 *   - groupLeaderId 优先从组对象取 leader 相关字段；都没有就用 group.id/groupId 兜底
 *     （后端未上线时用 group.id 请求，返回空数据/404，前端 EMPTY_DATA 显示全 0，和产品约定一致）
 *   - groupLeaderName 优先真实组长名；没有就用组名兜底（最次兜底「未知组长」）
 *   - fromGroupName 用组名（最次兜底「未知组」）
 */
export function normalizeViewGroupLeaderTarget(
  group: {
    id?: string | null;
    groupId?: string | null;
    name?: string | null;
    groupName?: string | null;
    groupLeaderId?: string | null;
    leaderId?: string | null;
    groupLeaderUserId?: string | null;
    adminUserId?: string | null;
    groupLeaderEmployeeId?: string | null;
    employeeId?: string | null;
    groupLeaderName?: string | null;
    leaderName?: string | null;
    groupLeader?: string | null;
    /** 角色（GROUP_LEADER / NORMAL_ADMIN / SUPER_ADMIN），有就直接透传到 target，供 App.tsx 分发业绩页面 */
    groupLeaderRole?: string | null;
    role?: string | null;
    /** 提成比例：< 0.08 → GL（组长/P1），>= 0.08 → TL（团队长/P2+）；role 缺失时作为兜底分发依据 */
    commission?: number | string | null;
    /** 兼容其他可能的提成字段命名 */
    groupLeaderCommission?: number | string | null;
    leaderCommission?: number | string | null;
    /** [扩展] 对象 ID：MongoDB ObjectId / Admin._id 主表主键 */
    _id?: string | null;
    objectId?: string | null;
    adminId?: string | null;
    /** [扩展] 组长本人的 Admin.userId（数字工号 / 纯数字或 emp_ 前缀） */
    userId?: string | null;
  } | null | undefined,
): ViewGroupLeaderTarget | null {
  if (!group) return null;
  const groupId = String(group.id || group.groupId || '').trim();
  const groupName = String(group.name || group.groupName || '').trim();

  // 所有候选 ID 分别抽取 + 入袋，给后端 resolveTargetAdmin 多参命中
  const rawObjectId = (
    String(group._id || '').trim() ||
    String(group.objectId || '').trim() ||
    String(group.adminId || '').trim() ||
    ''
  );
  // 注：Admin 表 userId 是数字工号（登录账号），与 Admin._id（ObjectId）不同
  const rawAdminUserId = (
    String(group.groupLeaderUserId || '').trim() ||
    String(group.adminUserId || '').trim() ||
    String(group.userId || '').trim() ||
    ''
  );
  // Employee.employeeId：员工工号（可能和 Admin.userId 是同一个数字）
  const rawEmployeeId = (
    String(group.groupLeaderEmployeeId || '').trim() ||
    String(group.employeeId || '').trim() ||
    ''
  );
  // 组长关联 ID：组表里记录的 groupLeaderId / leaderId（可能是 ObjectId 或 userId 或 employeeId 任意一种）
  const rawLeaderRefId = (
    String(group.groupLeaderId || '').trim() ||
    String(group.leaderId || '').trim() ||
    ''
  );

  const leaderId = (
    // ===== [Bug2 修复 2026-07-13] 主参数 ID 优先级调整 =====
    // 后端 resolveTargetAdmin 解析 userId 时，先拿 URL 里第一个出现的 userId 当 key 匹配。
    // 若第一个是 ObjectId（69af8e34...）当 userId 传 → Admin.userId 里查不到 → 404「目标组长不存在」→ 全 0
    // 必须把 Admin.userId（字符串 username=cuiding/huangzhenhui 这种）放第一个当主参数 → 才能正确命中。
    // 优先级：
    //   1) rawAdminUserId（Admin.userId/用户名/字符串，最优先）
    //   2) rawEmployeeId（员工工号，次优先）
    //   3) rawLeaderRefId（组表记录的关联 ID，第三）
    //   4) rawObjectId（MongoDB Admin._id/主键，兜底之一）
    //   5) groupId（组 id，最终兜底）
    rawAdminUserId ||
    rawEmployeeId ||
    rawLeaderRefId ||
    rawObjectId ||
    groupId  // 兜底用 groupId（后端没上线时也能发请求，走 EMPTY_DATA 全 0）
  );

  const leaderName = (
    String(group.groupLeaderName || '').trim() ||
    String(group.leaderName || '').trim() ||
    String(group.groupLeader || '').trim() ||
    groupName ||
    '未知组长'
  );
  const fromName = groupName || '未知组';
  const leaderRole =
    (group.groupLeaderRole != null && String(group.groupLeaderRole).trim()) ||
    (group.role != null && String(group.role).trim()) ||
    null;
  const cmRaw =
    (group.commission ?? null) ??
    (group.groupLeaderCommission ?? null) ??
    (group.leaderCommission ?? null) ??
    null;
  const commission =
    cmRaw == null || cmRaw === ''
      ? null
      : typeof cmRaw === 'number'
        ? cmRaw
        : Number(cmRaw);

  const idBag: ViewGroupLeaderTarget['idBag'] = {
    userId: rawAdminUserId || rawLeaderRefId || null,
    adminId: rawObjectId || rawLeaderRefId || null,
    employeeId: rawEmployeeId || rawLeaderRefId || null,
    objectId: rawObjectId || null,
    groupId: groupId || null,
  };

  return {
    groupLeaderId: leaderId,
    groupLeaderName: leaderName,
    fromGroupName: fromName,
    groupLeaderRole: leaderRole,
    commission: Number.isNaN(commission as number) ? null : commission,
    idBag,
  };
}

/** [B] 缓存 key：不同模式用不同前缀，不同登录人看同一目标命中同一份 key（后端已经按 targetUserId 做 key，这里我们按 target 分桶也完全匹配） */
export function makeGLPCacheKey(mode: GLPMode, selfId: string | null | undefined, targetId: string | null | undefined): string {
  if (mode === 'view-as-other') {
    const t = (targetId ?? '').trim();
    if (!t) throw new Error('makeGLPCacheKey: view-as-other need targetId');
    return 'gl_perf_view_' + t;
  }
  const s = (selfId ?? '').trim();
  if (!s) throw new Error('makeGLPCacheKey: self mode need selfId');
  return 'gl_perf_self_' + s;
}

/** [C] 请求目标身份解析：返回 { targetUserId, roleMode } */
export function resolvePerformanceIdentity(
  mode: GLPMode,
  jwtUser: { id: string | number } | null | undefined,
  target: ViewGroupLeaderTarget | null | undefined,
): { targetUserId: string; roleMode: GLPMode } {
  if (!jwtUser || !String(jwtUser.id).trim()) {
    throw new Error('resolvePerformanceIdentity: jwtUser empty');
  }
  if (mode === 'view-as-other') {
    const tid = (target?.groupLeaderId ?? '').trim();
    if (!tid) throw new Error('resolvePerformanceIdentity: view-as-other missing target.groupLeaderId');
    return { targetUserId: tid, roleMode: 'view-as-other' };
  }
  return { targetUserId: String(jwtUser.id), roleMode: 'self' };
}

/** [D-] 通用：把主 targetId + idBag 中的所有候选 ID 拼成多参数 query string
 * 后端 resolveTargetAdmin 支持多参数"三任一命中"，前端统一全部带上，杜绝 ID 口径不匹配导致全 0 数据
 * 已存在 ?userId=xxx 的也会被多参数覆盖（按最后一个值或后端任一命中都行，query 重复不影响后端）
 */
export function buildMultiIdQuery(
  primaryTargetId: string | null | undefined,
  idBag: ViewGroupLeaderTarget['idBag'] | null | undefined,
): string {
  const parts: Array<[string, string]> = [];
  const push = (k: string, v: any) => {
    const s = v == null ? '' : String(v).trim();
    if (!s) return;
    // 同一个 key 允许重复（后端 OR 命中即可）；相同值的重复直接去重减少 URL 长度
    if (!parts.some(([ek, ev]) => ek === k && ev === s)) parts.push([k, s]);
  };
  // 主参数：userId 作为 resolveTargetAdmin 的主入口
  push('userId', primaryTargetId);
  // idBag 所有候选
  if (idBag) {
    push('userId', idBag.userId);
    push('adminId', idBag.adminId);
    push('employeeId', idBag.employeeId);
    push('objectId', idBag.objectId);
    push('groupId', idBag.groupId);
  }
  // 兜底别名：确保 3 种常见写法（后端有时读 _id / id）
  if (idBag?.objectId) {
    push('_id', idBag.objectId);
    push('id', idBag.objectId);
  }
  return parts.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/** [D] 请求 URL 组装：view 模式下带 userId + 多候选 ID 参数，确保后端任一命中即可 */
export function makeGLPRequestUrl(
  mode: GLPMode,
  targetUserId: string | null | undefined,
  idBag?: ViewGroupLeaderTarget['idBag'] | null,
): string {
  const base = '/group-leader/performance';
  if (mode === 'view-as-other') {
    const qs = buildMultiIdQuery(targetUserId, idBag);
    if (!qs) throw new Error('makeGLPRequestUrl: view mode need targetUserId');
    return base + '?' + qs;
  }
  return base;
}

/** [D-TL] 团队长业绩接口 URL 组装：view 模式同样带多参数；供 TeamLeaderPerformance / GroupLeaderPerformance(拿档位) 复用 */
export function makeTLPRequestUrl(
  mode: GLPMode,
  targetUserId: string | null | undefined,
  idBag?: ViewGroupLeaderTarget['idBag'] | null,
): string {
  const base = '/team-leader/performance';
  if (mode === 'view-as-other') {
    const qs = buildMultiIdQuery(targetUserId, idBag);
    if (!qs) throw new Error('makeTLPRequestUrl: view mode need targetUserId');
    return base + '?' + qs;
  }
  return base;
}

// —— 全局跳转事件（解决 GroupManagement 被嵌入时 prop 可选导致点击不跳的问题）
// 点击按钮的优先级：1) onViewGroupLeaderPerformance 回调 prop；2) window CustomEvent dispatch 通知 App 顶层；
// App.tsx mount 时注册一次性监听 → 直接 setViewingGroupLeader 打开副页。
export const VIEW_GROUP_LEADER_PERF_EVENT = 'app:view-group-leader-performance' as const;
export type ViewGroupLeaderPerfEvent = CustomEvent<ViewGroupLeaderTarget>;

/** 发全局事件，通知 App 打开该组长业绩副页 */
export function dispatchViewGroupLeaderPerformanceEvent(target: ViewGroupLeaderTarget): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ev = new CustomEvent<ViewGroupLeaderTarget>(VIEW_GROUP_LEADER_PERF_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: target,
    });
    return window.dispatchEvent(ev);
  } catch {
    return false;
  }
}

/** 注册顶层监听，返回解绑函数（供 App.tsx useEffect 用） */
export function addViewGroupLeaderPerfListener(
  handler: (target: ViewGroupLeaderTarget) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (ev: Event) => {
    const ce = ev as ViewGroupLeaderPerfEvent;
    if (ce?.detail?.groupLeaderId) handler(ce.detail);
  };
  window.addEventListener(VIEW_GROUP_LEADER_PERF_EVENT, wrapped as EventListener);
  return () => window.removeEventListener(VIEW_GROUP_LEADER_PERF_EVENT, wrapped as EventListener);
}
