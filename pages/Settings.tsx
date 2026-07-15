
import React, { useState, useEffect, useCallback } from 'react';
import {
  LogOut, ChevronRight, UserCircle2, Key, Loader2, RefreshCw,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { authService } from '../services/authService';
import { request } from '../services/api';
import { UserRole } from '../types';
import { cacheManager } from '../services/cacheManager';
import {
  LEVEL_V2_API,
  LEVEL_V2_FALLBACK_8,
  VALID_LEVELS_V2,
  computeAdminLevelV2,
  formatCommission,
  getLevelV2Theme,
  normalizeLevelConfig as normalizeLevelConfigV2,
  type AdminLevelInfoV2,
  type LevelV2ConfigRow,
} from '../utils/levelV2Service';

interface SettingsProps {
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout }) => {
  // Q5 ⑤：currentUser 放 state，每次刷新重新拉（role 可能从 GROUP_LEADER → NORMAL_ADMIN，晋升后 teamGroupId 变 null 属正常）
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCurrentUser());
  useEffect(() => {
    // 初次加载也从 localStorage 读最新的（防 role 缓存老的 GROUP_LEADER）
    const fresh = authService.getCurrentUser();
    if (fresh) setCurrentUser({ ...fresh });
  }, []);

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
    // 如果都没有，直接返回用户名作为团队名称
    return currentUser?.username || '团队';
  };
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawRecordModal, setShowWithdrawRecordModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState({ lastPushTime: '', lastPushTitle: '', commitVersion: '' });
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayName, setAlipayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawRecords, setWithdrawRecords] = useState<any[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [withdrawEnabled, setWithdrawEnabled] = useState(false);
  const [showAllWithdrawRecords, setShowAllWithdrawRecords] = useState(false);

  // 收益数据状态
  const [earnings, setEarnings] = useState({
    today: 0,
    month: 0,
    lastMonth: 0,
    total: 0,
    availableBalance: 0
  });

  // Q5：职级 v2 统一 state（P1 组长 / P2~P8 团队长）。所有数字/主题全从 levelV2Service + 接口读，不写死。
  interface MyLevelInfo {
    currentLevel: string;            // 'P1' ~ 'P8'
    currentLevelName: string;        // 接口返回的中文名称
    currentCommission: number;       // Q5 ② = Admin.commission（小数 0.06=6%），晋升/调档已写入
    isManual: boolean;               // Q5 ① manualLevel != null
    manualLevelLabel?: string | null;// 展示「手动 · P7」
    manualLevelSetAt?: Date | null;  // Q5 ① 最近手动调档时间
    nextLevel?: string;              // 仅自动档且非 P8
    nextCommission?: number;
    nextLevelThreshold?: number;
    revenueToNext?: number;
    progressToNext?: number;
    isMaxLevel: boolean;
    belowWarning?: string | null;    // TL 被手动设为 P1 的提示（理论上后端 400 拦截，这里前端兜底）
  }
  const [myLevelInfo, setMyLevelInfo] = useState<MyLevelInfo | null>(null);
  const [restoringAuto, setRestoringAuto] = useState(false); // 恢复自动计算 loading

  // 兼容 role 大小写（后端可能返回 normal_admin / GROUP_LEADER / superadmin）
  const roleUpper = String(currentUser?.role || '').toUpperCase().replace(/_/g, '_');
  const isGroupLeaderV2 =
    roleUpper === UserRole.GROUP_LEADER.toUpperCase() ||
    roleUpper === 'GROUP_LEADER' ||
    // Q5 ⑤：晋升后 role 若还是 GROUP_LEADER 但有 teamId 等，也兼容
    (currentUser && currentUser.groupId != null && currentUser.teamGroupId != null);
  const isTeamLeaderV2 =
    roleUpper === UserRole.NORMAL_ADMIN.toUpperCase() ||
    roleUpper === 'NORMAL_ADMIN';
  const isSuperAdminV2 =
    roleUpper === UserRole.SUPER_ADMIN.toUpperCase() ||
    roleUpper === 'SUPER_ADMIN' ||
    roleUpper === 'SUPERADMIN';
  const isAdminManagerV2 =
    roleUpper === UserRole.ADMIN_MANAGER.toUpperCase() ||
    roleUpper === 'ADMIN_MANAGER';
  // 覆盖旧的 isTeamLeader / isGroupLeader / isSuperAdmin（保持老代码引用兼容）
  const isTeamLeader = isTeamLeaderV2;
  const isGroupLeader = isGroupLeaderV2;
  const isSuperAdmin = isSuperAdminV2;
  void isGroupLeader;
  void isTeamLeader;
  void isSuperAdmin;

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [loadingWithdraw, setLoadingWithdraw] = useState(true);
  const [loadingWithdrawStatus, setLoadingWithdrawStatus] = useState(true);

  // 获取缓存数据
  const getCachedData = (key: string, cacheTime: number = 300000) => { // 默认5分钟缓存
    return cacheManager.get(key, cacheTime);
  };

  // 设置缓存数据
  const setCachedData = (key: string, data: any, cacheTime: number = 300000) => { // 默认5分钟缓存
    cacheManager.set(key, data, cacheTime);
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 6) {
      alert('密码长度不能少于6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致，请重新输入');
      return;
    }
    setIsUpdating(true);
    try {
      await authService.updatePassword(oldPassword, newPassword);
      setIsUpdating(false);
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('密码修改成功');
    } catch (error) {
      setIsUpdating(false);
      alert('密码修改失败，请稍后重试');
      console.error('Error updating password:', error);
    }
  };

  // 获取版本信息（直接硬编码）
  const fetchVersionInfo = async () => {
    setIsLoadingVersion(true);
    try {
      // 直接设置最新一次推送的时间、标题和Commit版本号
      setVersionInfo({
        lastPushTime: '2026-03-22 18:20:00',
        lastPushTitle: '超管、团队长、组长测试通过',
        commitVersion: '8bfa2a0'
      });
    } catch (error) {
      console.error('获取版本信息失败:', error);
    } finally {
      setIsLoadingVersion(false);
    }
  };

  const handleWithdraw = async () => {
    if (!employeeId || !alipayAccount || !alipayName) {
      alert('请填写员工号、支付宝帐号和姓名');
      return;
    }
    if (!withdrawEnabled) {
      alert('提现功能已关闭');
      return;
    }
    if (earnings.lastMonth <= 0) {
      alert('提现金额必须大于0');
      return;
    }
    setIsWithdrawing(true);
    try {
      // 计算提现金额
      const amount = earnings.lastMonth; // 上月收益（元）

      // 提交提现申请
      // 团队长和组长使用管理员提现接口
      if (isTeamLeader || isGroupLeader) {
        const withdrawData = {
          amount: amount,
          alipayAccount: alipayAccount,
          alipayName: alipayName,
          employeeId: employeeId,
          lastMonthCommission: earnings.lastMonth
        };
        console.log('提交提现请求参数:', withdrawData);
        await request<any>('/withdraw/admin/submit', {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(withdrawData)
        });
      } else {
        // 普通员工使用原接口
        const goldAmount = amount * 1000; // 1元=1000金币
        await request<any>('/withdraw/submit', {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            userId: currentUser?.id || '',
            employeeId: currentUser?.id || '',
            amount: amount,
            goldAmount: goldAmount,
            alipayAccount: alipayAccount,
            alipayName: alipayName
          })
        });
      }
      
      setIsWithdrawing(false);
      setWithdrawSuccess(true);
      // 3秒后自动关闭弹窗
      setTimeout(() => {
        setShowWithdrawModal(false);
        setWithdrawSuccess(false);
        setAlipayAccount('');
        setAlipayName('');
      }, 3000);
      // 触发强制刷新，与点击刷新按钮效果一致
      handleRefresh();
    } catch (error) {
      setIsWithdrawing(false);
      alert('网络错误，请稍后重试');
      console.error('Error submitting withdraw request:', error);
    }
  };

  // 获取收益数据
  const fetchEarnings = useCallback(async (isRefresh = false) => {
    // 检查用户是否登录
    if (!currentUser) {
      setLoadingEarnings(false);
      return;
    }
    
    if (!isRefresh) {
      // 检查缓存
      const cacheKey = `earnings_${currentUser?.id || 'unknown'}_${isTeamLeader ? 'team' : isGroupLeader ? 'group' : isAdminManagerV2 ? 'manager' : 'admin'}`;
      const cachedEarnings = getCachedData(cacheKey);
      if (cachedEarnings) {
        setEarnings(cachedEarnings);
        setLoadingEarnings(false);
        return;
      }
    }
    
    try {
      // ==============================================
      // 统一解析：TL / GL 两接口结构已 100% 对齐（后端方案 A 上线）
      //   - URL 仅按角色切换
      //   - 解析逻辑完全复用同一段
      //   - 命中顺序：扁平 today/month/lastMonth → 别名 Commission/Earnings → last_month 下划线 → 老嵌套 today.totalCommission → detail.*.totalCommission
      //   - 超管保持独立 kpi 逻辑不变
      // ==============================================
      const earningsUrl: string | null = (() => {
        if (isTeamLeader) return '/admin/dashboard/team-leader/commission';
        if (currentUser?.role === UserRole.GROUP_LEADER) return '/group-leader/commission-stats';
        if (isAdminManagerV2) return '/admin/dashboard/super/dividend-summary';
        return null;
      })();

      if (earningsUrl) {
        // TL / GL 共用同一段解析
        const raw = await request<any>(earningsUrl, { method: 'GET' });

        if (isTeamLeader) {
          console.log('[Settings] 团队长收益接口返回数据:', raw);
          console.log('[Settings] 接口返回字段:', Object.keys(raw || {}));
        } else {
          console.log('[Settings] 组长收益接口返回数据:', raw);
        }

        // ====== 通用解析：扁平优先 → 别名 → 老嵌套兼容 ======
        const readVal = (
          flatKey: string,
          aliases: string[],
          oldDetailKey: string,
        ): number => {
          // 1) 扁平字段直接取（today / month / lastMonth / total / availableBalance）
          if (typeof (raw as any)?.[flatKey] === 'number' && !Number.isNaN((raw as any)[flatKey])) {
            return Number((raw as any)[flatKey]);
          }
          // 2) 各种别名（todayCommission / todayEarnings / monthCommission 等）
          for (const a of aliases) {
            if (typeof (raw as any)?.[a] === 'number' && !Number.isNaN((raw as any)[a])) {
              return Number((raw as any)[a]);
            }
          }
          // 3) last_month 下划线（lastMonth 特有）
          if (flatKey === 'lastMonth' && typeof (raw as any)?.last_month === 'number' && !Number.isNaN((raw as any).last_month)) {
            return Number((raw as any).last_month);
          }
          // 4) 老嵌套：response.today.totalCommission / response[oldDetailKey].totalCommission
          if (oldDetailKey) {
            const nested1 = (raw as any)?.[oldDetailKey]?.totalCommission;
            if (typeof nested1 === 'number' && !Number.isNaN(nested1)) return Number(nested1);
            // 5) detail 兼容：后端 detail.*.totalCommission
            const nested2 = (raw as any)?.detail?.[oldDetailKey]?.totalCommission;
            if (typeof nested2 === 'number' && !Number.isNaN(nested2)) return Number(nested2);
            // 6) 高管接口嵌套格式：response.today.dividendTotal / response.month.dividendTotal
            const nested3 = (raw as any)?.[oldDetailKey]?.dividendTotal;
            if (typeof nested3 === 'number' && !Number.isNaN(nested3)) return Number(nested3);
          }
          return 0;
        };

        const todayEarnings     = readVal('today',     ['todayCommission',     'todayEarnings'],     'today');
        const monthEarnings     = readVal('month',     ['monthCommission',     'monthEarnings'],     'month');
        const lastMonthEarnings = readVal('lastMonth', ['lastMonthCommission', 'lastMonthEarnings'], 'lastMonth');

        // total：优先读后端返回的开业至今累计 → 没有就 month + lastMonth 兜底
        const totalFromBackend = readVal('total', ['totalCommission', 'totalEarnings'], '');
        const totalEarnings = totalFromBackend > 0
          ? totalFromBackend
          : (monthEarnings + lastMonthEarnings);

        // availableBalance：优先读后端真实可提现 → 没给就 lastMonth 兜底
        const availableBalanceRaw = readVal('availableBalance', [], '');
        const availableBalance = availableBalanceRaw > 0 || availableBalanceRaw === 0
          ? availableBalanceRaw
          : lastMonthEarnings;

        const earningsData = {
          today: todayEarnings,
          month: monthEarnings,
          lastMonth: lastMonthEarnings,
          total: totalEarnings,
          availableBalance,
        };

        console.log('[Settings] 收益最终解析结果:', earningsData);

        setEarnings(earningsData);
        const cacheKey = `earnings_${currentUser?.id || 'unknown'}_${isTeamLeader ? 'team' : isGroupLeader ? 'group' : 'manager'}`;
        setCachedData(cacheKey, earningsData);
      } else {
        // 超级管理员获取全局数据
        const todayResponse = await request<any>('/admin/dashboard/kpi?range=today', {
          method: 'GET'
        });
        
        const monthResponse = await request<any>('/admin/dashboard/kpi?range=month', {
          method: 'GET'
        });
        
        // 获取上月累计金币
        const lastMonthResponse = await request<any>('/admin/dashboard/kpi?range=lastMonth', {
          method: 'GET'
        });

        // 获取累计金币
        const totalResponse = await request<any>('/admin/dashboard/kpi?range=all', {
          method: 'GET'
        });

        console.log('Admin responses:', { todayResponse, monthResponse, lastMonthResponse, totalResponse });
        const todayUserShare = Number(todayResponse?.coins || 0) / 1000;
        const monthUserShare = Number(monthResponse?.coins || 0) / 1000;
        const lastMonthUserShare = Number(lastMonthResponse?.coins || 0) / 1000;
        const totalUserShare = Number(totalResponse?.coins || 0) / 1000;
        console.log('Calculated admin coins:', { todayUserShare, monthUserShare, lastMonthUserShare, totalUserShare });

        const earningsData = {
          today: todayUserShare * 0.2,
          month: monthUserShare * 0.2,
          lastMonth: lastMonthUserShare * 0.2,
          total: totalUserShare * 0.2,
          availableBalance: lastMonthUserShare * 0.2
        };
        
        setEarnings(earningsData);
        
        // 缓存数据
        const cacheKey = `earnings_${currentUser?.id || 'unknown'}_admin`;
        setCachedData(cacheKey, earningsData);
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      // 保持当前数据，不设置为0，避免数据闪烁
    } finally {
      setLoadingEarnings(false);
    }
  }, [isTeamLeader, currentUser, isGroupLeader, isAdminManagerV2]);

  // Q5：统一获取我的职级信息（P1 组长 / P2~P8 团队长）。
  //   - 只读缓存，绝不写入（避免污染业绩页缓存结构导致白屏）
  //   - 兼容 v2（levelConfigV2 8 档）和旧缓存（levelConfig 4 档）
  //   - 手动档：按 manualLevel 强制档位，标 isManual=true，提供恢复自动入口
  const fetchMyLevelInfo = useCallback(async (isRefresh = false) => {
    if (!currentUser) return;
    const isGL = isGroupLeaderV2;
    const isTL = isTeamLeaderV2;
    if (!isGL && !isTL) return; // 超管不展示职级徽章

    try {
      const cacheKey = isGL
        ? `gl_perf_${currentUser.id || 'unknown'}`
        : `tl_perf_${currentUser.id || 'unknown'}`;

      let data: any = null;
      let totalRevenue = 0;
      let cfg8: LevelV2ConfigRow[] = normalizeLevelConfigV2(LEVEL_V2_FALLBACK_8);
      let manualLevel: any = null;
      let manualLevelSetAt: any = null;
      let serverCommission: number | null = null;

      if (!isRefresh) {
        const cached = getCachedData(cacheKey, 5 * 60 * 1000);
        if (cached) {
          // 只认 levelConfig + summary.totalRevenue 都完整的缓存
          const hasV2 =
            Array.isArray((cached as any).levelConfigV2) &&
            (cached as any).levelConfigV2.length === 8 &&
            (cached as any).levelConfigV2.every(
              (c: any) => c && typeof c.level === 'string' && typeof c.commission === 'number',
            );
          const hasOld4 =
            !hasV2 &&
            Array.isArray((cached as any).levelConfig) &&
            (cached as any).levelConfig.length === 4;
          const hasRevenue =
            (cached as any).summary &&
            typeof Number((cached as any).summary?.totalRevenue) === 'number' &&
            !Number.isNaN(Number((cached as any).summary?.totalRevenue));
          if ((hasV2 || hasOld4) && hasRevenue) data = cached;
        }
      }

      if (data) {
        // ============== 归一化缓存（v2 8档 或 旧4档） ==============
        totalRevenue = Number(data?.summary?.totalRevenue ?? 0);
        if (Array.isArray((data as any).levelConfigV2) && (data as any).levelConfigV2.length === 8) {
          cfg8 = normalizeLevelConfigV2((data as any).levelConfigV2);
        } else {
          cfg8 = normalizeLevelConfigV2(LEVEL_V2_FALLBACK_8);
        }
        const L = data.level || {};
        manualLevel = L.manualLevel ?? data.manualLevel ?? null;
        manualLevelSetAt = L.manualLevelSetAt ?? data.manualLevelSetAt ?? null;
        if (typeof L.currentCommission === 'number') serverCommission = L.currentCommission;
      } else {
        // ============== 直接打业绩接口（只读，不写缓存） ==============
        try {
          const url = isGL ? '/group-leader/performance' : '/team-leader/performance';
          const resp = await request<any>(url, { method: 'GET' });
          const payload =
            resp && (resp.success === true || resp.success === undefined)
              ? resp.data ?? resp
              : null;
          if (!payload) {
            console.warn('[Settings] 业绩接口未返回有效数据，职级暂不展示');
            return;
          }
          totalRevenue = Number(payload?.summary?.totalRevenue ?? 0);

          const fromResp = normalizeLevelConfigV2((payload as any).levelConfig);
          if (fromResp.length === 8) cfg8 = fromResp;
          else {
            const fromL = normalizeLevelConfigV2((payload as any).level?.levelList);
            if (fromL.length === 8) cfg8 = fromL;
          }

          manualLevel = payload?.manualLevel ?? payload?.level?.manualLevel ?? null;
          manualLevelSetAt = payload?.manualLevelSetAt ?? payload?.level?.manualLevelSetAt ?? null;
          if (typeof payload?.level?.currentCommission === 'number') {
            serverCommission = payload.level.currentCommission;
          } else if (typeof currentUser?.commission === 'number') {
            serverCommission = currentUser.commission;
          }
        } catch (err) {
          console.warn('[Settings] 职级接口失败，不展示职级徽章:', err);
          return;
        }
      }

      // ============== ✅ 最简方案：数据可疑时直接不展示，绝不 set 假 P2 ==============
      //   TL 自动档 + totalRevenue===0 + commission>=0.10（P3及以上比例）→ 说明
      //   totalRevenue 拿的是空/不完整缓存，serverCommission/admin.commission 才是真
      //   → 不要夹取 P2 误导，直接 return，标签和提成比例都不显示，等下一次刷新。
      const effectiveCommission =
        typeof serverCommission === 'number' && !Number.isNaN(serverCommission)
          ? serverCommission
          : Number(currentUser?.commission ?? NaN);
      if (
        isTL &&
        !manualLevel &&
        totalRevenue === 0 &&
        !Number.isNaN(effectiveCommission) &&
        effectiveCommission >= 0.10 - 1e-9 // >= P3(10%) 就认为 totalRevenue 肯定不可能是 0
      ) {
        setMyLevelInfo(null);
        return;
      }

      // ============== 算档 v2 ==============
      let v2Info: AdminLevelInfoV2 = computeAdminLevelV2({
        totalRevenue,
        levelConfig: cfg8,
        manualLevel,
        manualLevelSetAt,
      });

      // TL 手动档被设为 P1：强制兜底到 P2 并标 belowWarning（理论后端400，这里避免白屏）
      let belowWarning: string | null = null;
      if (isTL && v2Info.isManual && v2Info.currentLevel === 'P1') {
        const p2Cfg = cfg8.find((c) => c.level === 'P2') || cfg8[1];
        belowWarning = 'TL 档位已按最低 P2 展示（后端不允许 P1）';
        v2Info = {
          ...v2Info,
          currentLevel: 'P2',
          currentLevelName: p2Cfg?.name || '初级团队长',
          currentCommission: typeof p2Cfg?.commission === 'number' ? p2Cfg.commission : v2Info.currentCommission,
          isMaxLevel: false,
        };
      }

      // ============== 按角色强制夹取有效档位范围 ==============
      let effectiveLevel = v2Info.currentLevel;
      if (isGL && effectiveLevel !== 'P1') {
        // GL 被手动设为 P2+：夹取 P1 + warning
        const p1 = cfg8.find((c) => c.level === 'P1') || cfg8[0];
        belowWarning = belowWarning || `组长职级已夹取到 P1（当前被指定 ${effectiveLevel}，请联系超管恢复自动）`;
        effectiveLevel = 'P1';
        v2Info = {
          ...v2Info,
          currentLevel: effectiveLevel,
          currentLevelName: p1?.name || v2Info.currentLevelName || '组长',
          currentCommission: typeof p1?.commission === 'number' ? p1.commission : v2Info.currentCommission,
        };
      }
      // TL 自动档 + currentLevel==='P1'（totalRevenue<P2.minRevenue 真·起步期）：挂 P2，
      // 但保留 commission=admin 真实值（不要硬改成 0.08，不然出现 P2+10% 的矛盾）。
      if (isTL && !manualLevel && effectiveLevel === 'P1') {
        const p2 = cfg8.find((c) => c.level === 'P2') || cfg8[1];
        effectiveLevel = 'P2';
        v2Info = {
          ...v2Info,
          currentLevel: effectiveLevel,
          currentLevelName: p2?.name || '初级团队长',
          progressToNext: 0,
          isMaxLevel: false,
        };
      }
      // TL 手动档 = P1：上面已经拦截过，这里防御一下
      else if (isTL && manualLevel && effectiveLevel === 'P1') {
        const p2 = cfg8.find((c) => c.level === 'P2') || cfg8[1];
        effectiveLevel = 'P2';
        v2Info = {
          ...v2Info,
          currentLevel: effectiveLevel,
          currentLevelName: p2?.name || '初级团队长',
          currentCommission: typeof p2?.commission === 'number' ? p2.commission : v2Info.currentCommission,
          progressToNext: 1,
          isMaxLevel: false,
        };
      }

      const commission =
        typeof serverCommission === 'number' && !Number.isNaN(serverCommission)
          ? serverCommission
          : v2Info.currentCommission;

      const result: MyLevelInfo = {
        currentLevel: effectiveLevel,
        currentLevelName: v2Info.currentLevelName || cfg8.find((c) => c.level === effectiveLevel)?.name || '',
        currentCommission: commission,
        isManual: v2Info.isManual,
        manualLevelLabel: v2Info.isManual ? (manualLevel || effectiveLevel) : null,
        manualLevelSetAt: v2Info.manualLevelSetAt,
        nextLevel: v2Info.isManual ? undefined : v2Info.nextLevel,
        nextCommission: v2Info.isManual ? undefined : v2Info.nextCommission,
        nextLevelThreshold: v2Info.isManual ? undefined : v2Info.nextLevelThreshold,
        revenueToNext: v2Info.isManual ? undefined : v2Info.revenueToNext,
        progressToNext: v2Info.isManual ? 1 : v2Info.progressToNext,
        isMaxLevel: v2Info.isManual ? effectiveLevel === 'P8' : v2Info.isMaxLevel,
        belowWarning,
      };
      setMyLevelInfo(result);
    } catch (e) {
      console.warn('[Settings] 职级信息解析出错:', e);
      setMyLevelInfo(null);
    }
  }, [isGroupLeaderV2, isTeamLeaderV2, currentUser]);

  // Q5 ⑥：点击「恢复自动计算」→ PUT /admin/:adminId/manual-level { level: null }
  const handleRestoreAutoLevel = useCallback(async () => {
    if (!currentUser?.id || !myLevelInfo?.isManual) return;
    setRestoringAuto(true);
    try {
      await LEVEL_V2_API.setManualLevel(currentUser.id, null);
      // 成功后清空缓存并重新拉
      cacheManager.delete(`gl_perf_${currentUser.id || 'unknown'}`);
      cacheManager.delete(`tl_perf_${currentUser.id || 'unknown'}`);
      await fetchMyLevelInfo(true);
      alert('已恢复自动按累计营收升降档位');
    } catch (e: any) {
      alert('恢复自动失败：' + (e?.message || '请稍后重试'));
    } finally {
      setRestoringAuto(false);
    }
  }, [currentUser, myLevelInfo?.isManual, fetchMyLevelInfo]);
  void VALID_LEVELS_V2;

  // 获取提现记录
  const fetchWithdrawRecords = useCallback(async (isRefresh = false) => {
    if (!currentUser?.username) {
      setLoadingWithdraw(false);
      return;
    }
    
    if (!isRefresh) {
      // 检查缓存
      const cacheKey = `withdraw_records_${currentUser.username}`;
      const cachedRecords = getCachedData(cacheKey, 60000); // 1分钟缓存
      if (cachedRecords) {
        setWithdrawRecords(cachedRecords);
        setLoadingWithdraw(false);
        return;
      }
    }
    
    setIsLoadingRecords(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`https://wfqmaepvjkdd.sealoshzh.site/api/withdraw/list?userId=${currentUser.username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setWithdrawRecords(result.data || []);
        
        // 缓存数据
        const cacheKey = `withdraw_records_${currentUser.username}`;
        setCachedData(cacheKey, result.data || [], 60000); // 1分钟缓存
      } else {
        setWithdrawRecords([]);
      }
    } catch (error) {
      console.error('Error fetching withdraw records:', error);
      setWithdrawRecords([]);
    } finally {
      setIsLoadingRecords(false);
      setLoadingWithdraw(false);
    }
  }, [currentUser?.username]);

  // 加载提现开关状态（使用后端实际接口）
  useEffect(() => {
    if (!currentUser) {
      setLoadingWithdrawStatus(false);
      return;
    }
    
    // 使用缓存，避免频繁请求
    const cacheKey = `withdraw_status`;
    const cached = getCachedData(cacheKey);
    if (cached !== null) {
      setWithdrawEnabled(cached);
      setLoadingWithdrawStatus(false);
      return;
    }
    
    const fetchStatus = async () => {
      try {
        const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/settings/withdraw-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        const result = JSON.parse(text);
        const enabledValue = result?.enabled?.enabled ?? result?.enabled ?? result?.status;
        const isEnabled = enabledValue === true || enabledValue === 'true' || enabledValue === 1 || enabledValue === '1' || enabledValue === 'enabled';
        setWithdrawEnabled(isEnabled);
        setCachedData(cacheKey, isEnabled, 1800000); // 30分钟缓存
      } catch (err) {
        console.error('获取提现状态失败:', err);
        setWithdrawEnabled(true);
      } finally {
        setLoadingWithdrawStatus(false);
      }
    };
    
    fetchStatus();
  }, [currentUser]);
  


  useEffect(() => {
    if (currentUser) {
      // 重置加载状态
      setLoading(true);
      setLoadingEarnings(true);
      setLoadingWithdraw(true);
      setLoadingWithdrawStatus(true);
      
      // 并行执行所有数据获取操作，提高加载速度
      Promise.allSettled([
        fetchEarnings(),
        fetchWithdrawRecords(),
        fetchMyLevelInfo(),
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [currentUser, fetchMyLevelInfo]);



  // 刷新数据
  const handleRefresh = useCallback(async () => {
    // 重置加载状态
    setLoading(true);
    setLoadingEarnings(true);
    setLoadingWithdraw(true);

    // 清空缓存
    cacheManager.clear();
    // Q5 ⑤：刷新时重新拉个人信息（role 可能从 GROUP_LEADER → NORMAL_ADMIN）
    const fresh = authService.getCurrentUser();
    if (fresh) setCurrentUser({ ...fresh });

    // 重新请求所有数据
    await Promise.allSettled([
      fetchEarnings(true),
      fetchWithdrawRecords(true),
      fetchMyLevelInfo(true),
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchEarnings, fetchWithdrawRecords, fetchMyLevelInfo, currentUser, authService]);

  const sections = [
    {
      title: '账户管理',
      items: [
        { label: '修改密码', icon: Key, color: 'text-blue-500 bg-blue-50', onClick: () => setShowPasswordModal(true) },
        ...(isSuperAdmin ? [{ label: '关于版本', icon: ChevronRight, color: 'text-gray-500 bg-gray-50', onClick: async () => { await fetchVersionInfo(); setShowVersionModal(true); } }] : [])
      ]
    }
  ];

  return (
    <div className="pb-6">
      <div className="bg-[#1E40AF] pt-12 pb-16 px-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl overflow-hidden">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 size={40} className="text-white" />
                )}
            </div>
            <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                    <h2 className="text-xl font-black truncate">{currentUser?.username || 'Admin Pro'}</h2>
                    {!isGroupLeaderV2 && !isTeamLeaderV2 && (
                      <span className="text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full backdrop-blur-sm border border-white/20 uppercase shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                        {isSuperAdmin ? '超级管理员' : isAdminManagerV2 ? '高级管理员' : '普通管理员'}
                      </span>
                    )}
                </div>
                {/* Q5 ② 当前提成比例 + 最近调整时间（来自 Admin.commission，晋升/调档立即写入） */}
                {myLevelInfo && (
                  <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-blue-100/90 font-semibold">
                    <span>
                      当前提成比例{' '}
                      <span className="font-black text-white tracking-wide">
                        {formatCommission(myLevelInfo.currentCommission)}
                      </span>
                    </span>
                    {myLevelInfo.isManual && myLevelInfo.manualLevelSetAt && (
                      <span className="inline-flex items-center text-amber-200/95">
                        · 最近调整于{' '}
                        {(() => {
                          const d = new Date(myLevelInfo.manualLevelSetAt!);
                          if (Number.isNaN(d.getTime())) return '--';
                          const p = (n: number) => String(n).padStart(2, '0');
                          return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
                        })()}
                      </span>
                    )}
                    {myLevelInfo.belowWarning && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-500/80 text-white font-black ring-1 ring-red-300/40">
                        ⚠ {myLevelInfo.belowWarning}
                      </span>
                    )}
                  </div>
                )}
            </div>
          </div>
          
          {/* 刷新按钮 - 所有角色统一显示（TL/GL 也要刷新职级/收益缓存） */}
          <button
            onClick={handleRefresh}
            className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"
            disabled={loading}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-6">
        {/* 我的收益/分红板块 */}
        {!isSuperAdmin && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
            <div className="flex items-center justify-center gap-2 mb-4">
              <h3 className="text-sm font-black text-gray-900">我的{isAdminManagerV2 ? '分红' : '收益'}（元）</h3>
              <button
                onClick={() => {
                  handleRefresh();
                }}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center"
                title="刷新数据"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">今日预估{isAdminManagerV2 ? '分红' : '收益'}</div>
                <div className="text-xl font-black text-blue-600">¥{earnings.today.toFixed(2)}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">本月预估{isAdminManagerV2 ? '分红' : '收益'}</div>
                <div className="text-xl font-black text-green-600">¥{earnings.month.toFixed(2)}</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">上月{isAdminManagerV2 ? '分红' : '收益'}</div>
                  <button
                    onClick={() => {
                      if (withdrawEnabled) {
                        setShowWithdrawModal(true);
                      }
                    }}
                    disabled={!withdrawEnabled}
                    className={`px-2 py-1 text-[9px] font-bold rounded-lg transition-all border flex items-center gap-1 ${
                      withdrawEnabled
                        ? 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 border-blue-500/30 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    提现
                  </button>
                </div>
                <div className="text-xl font-black text-purple-600">¥{earnings.lastMonth.toFixed(2)}</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">累计成功提现</div>
                <div className="text-xl font-black text-orange-600">¥{withdrawRecords.filter(record => record.status === 1).reduce((sum, record) => sum + (record.amount || 0), 0).toFixed(2)}</div>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-sm col-span-2 flex items-center justify-between">
                <div className="text-2xl font-black text-white">总{isAdminManagerV2 ? '分红' : '收益'}</div>
                <div className="text-2xl font-black text-white">¥{(earnings.month + earnings.lastMonth + withdrawRecords.filter(record => record.status === 1).reduce((sum, record) => sum + (record.amount || 0), 0)).toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 提现记录板块 - 仅对团队长和组长显示 */}
        {!isSuperAdmin && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
            <h3 className="text-sm font-black text-gray-900 mb-4">提现记录</h3>
            {isLoadingRecords ? (
              <div className="p-4 text-center">
                <Loader2 size={16} className="animate-spin inline-block text-gray-400" />
                <span className="ml-2 text-[10px] text-gray-400">加载中...</span>
              </div>
            ) : withdrawRecords.length > 0 ? (
              <div className="space-y-3">
                {(showAllWithdrawRecords ? withdrawRecords : withdrawRecords.slice(0, 2)).map((record, index) => {
                  const statusStyle = (() => {
                    switch (record.status) {
                      case 0:
                        return { text: '待打款', className: 'text-amber-600 bg-amber-50', amountColor: 'text-amber-600' };
                      case 1:
                        return { text: '已打款', className: 'text-emerald-600 bg-emerald-50', amountColor: 'text-emerald-600' };
                      case 2:
                        return { text: '已拒绝', className: 'text-red-600 bg-red-50', amountColor: 'text-red-600' };
                      default:
                        return { text: record.statusText || '未知状态', className: 'text-gray-600 bg-gray-50', amountColor: 'text-gray-600' };
                    }
                  })();
                  return (
                    <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                      <div className="flex-1">
                        <div className="text-[10px] text-gray-500 mb-1">支付宝：{record.alipayAccount}</div>
                        <div className="text-[10px] text-gray-500 mb-1">姓名：{record.alipayName}</div>
                        <div className="text-[10px] text-gray-400">{new Date(record.createTime).toLocaleString('zh-CN')}</div>
                        {record.goldAmount > 0 && (
                          <div className="mt-1 text-[10px] text-gray-400">扣除金币：{record.goldAmount} 金币</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4">
                        <div className={`text-sm font-bold ${statusStyle.amountColor}`}>¥{record.amount.toFixed(2)}</div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.className}`}>
                          {statusStyle.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {withdrawRecords.length > 2 && (
                  <button
                    onClick={() => setShowAllWithdrawRecords(!showAllWithdrawRecords)}
                    className="w-full py-3 bg-gray-50 text-[11px] font-bold text-[#1E40AF] hover:text-[#1E3A8A] transition-colors"
                  >
                    {showAllWithdrawRecords ? '收起' : `查看全部（${withdrawRecords.length}条）`}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-gray-300 mb-2">暂无提现记录</div>
                <div className="text-[10px] text-gray-400">点击上月{isAdminManagerV2 ? '分红' : '收益'}的提现按钮申请提现</div>
              </div>
            )}
          </div>
        )}

        {/* Menu Sections */}
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-[10px] font-black text-gray-400 px-2 uppercase tracking-widest">{section.title}</h3>
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50">
                {section.items.map((item, itemIdx) => (
                  <button 
                    key={itemIdx} 
                    onClick={item.onClick}
                    className={`w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors ${
                        itemIdx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${item.color}`}>
                            <item.icon size={18} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}

        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-500 rounded-3xl shadow-sm border border-gray-100 active:bg-red-50 active:border-red-100 transition-all font-black text-sm mt-4"
        >
            <LogOut size={20} className="mr-2" />
            退出当前账号
        </button>
        
        <div className="text-center py-6">
            <p className="text-[10px] text-gray-300 font-medium">© 2026 光年智慧中台</p>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">修改登录密码</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">旧密码</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请输入旧密码"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">新密码</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">确认新密码</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="请再次输入新密码"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button 
                  onClick={() => {
                    setShowPasswordModal(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 rounded-2xl active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdating}
                  className="flex-1 py-3 text-xs font-black text-white bg-[#1E40AF] rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isUpdating ? <Loader2 size={16} className="animate-spin" /> : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center">
              申请提现
            </h3>
            <div className="space-y-5">
              {withdrawSuccess ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">提现申请已提交</h4>
                  <p className="text-sm text-gray-500">财务将在3个工作日内处理</p>
                </div>
              ) : (
                <>
                  {/* 可提现金额 */}
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-2xl shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">可提现金额</div>
                    <div className="text-3xl font-bold text-purple-700">¥{earnings.availableBalance.toFixed(2)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">平台帐号</label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入平台帐号"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">支付宝帐号</label>
                    <input
                      type="text"
                      value={alipayAccount}
                      onChange={(e) => setAlipayAccount(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入支付宝账号"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">支付宝姓名</label>
                    <input
                      type="text"
                      value={alipayName}
                      onChange={(e) => setAlipayName(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-3 focus:ring-purple-100 focus:border-purple-200 transition-all"
                      placeholder="请输入支付宝实名姓名"
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center">提现申请将在1～3个工作日内处理</p>
                </>
              )}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawSuccess(false);
                    setEmployeeId('');
                    setAlipayAccount('');
                    setAlipayName('');
                  }}
                  className="flex-1 py-4 text-sm font-semibold text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all duration-200"
                >
                  {withdrawSuccess ? '关闭' : '取消'}
                </button>
                {!withdrawSuccess && (
                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !employeeId.trim() || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0}
                    className={`flex-1 py-4 text-sm font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center ${
                      isWithdrawing || !employeeId.trim() || !alipayAccount.trim() || !alipayName.trim() || earnings.lastMonth <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:shadow-lg'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : '提交提现申请'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Record Modal */}
      {showWithdrawRecordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              提现记录
            </h3>
            <div className="space-y-4">
              {isLoadingRecords ? (
                <div className="p-8 text-center">
                  <Loader2 size={20} className="animate-spin inline-block text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">加载中...</span>
                </div>
              ) : withdrawRecords.length > 0 ? (
                <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
                  {withdrawRecords.map((record, index) => {
                    const statusStyle = (() => {
                      switch (record.status) {
                        case 0:
                          return { text: '提现成功', className: 'text-emerald-600 bg-emerald-50' };
                        case 1:
                          return { text: '已通过', className: 'text-blue-600 bg-blue-50' };
                        case 2:
                          return { text: '已拒绝', className: 'text-red-600 bg-red-50' };
                        default:
                          return { text: record.statusText || '未知状态', className: 'text-gray-600 bg-gray-50' };
                      }
                    })();
                    return (
                      <div key={record._id || index} className="p-4 bg-gray-50 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-bold text-gray-900">¥{record.amount.toFixed(2)}</div>
                          <div className={`text-xs font-bold px-3 py-1 rounded-full ${statusStyle.className}`}>
                            {statusStyle.text}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                          <div>扣除金币：{record.goldAmount} 金币</div>
                          <div>申请时间：{new Date(record.createTime).toLocaleString('zh-CN')}</div>
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-sm text-gray-500">
                          <div>支付宝：{record.alipayAccount}</div>
                          <div>姓名：{record.alipayName}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">暂无提现记录</h4>
                  <p className="text-sm text-gray-500">点击上月{isAdminManagerV2 ? '分红' : '收益'}的提现按钮申请提现</p>
                </div>
              )}
              <div className="pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawRecordModal(false);
                  }}
                  className="w-full py-4 text-sm font-semibold text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 active:scale-95 transition-all duration-200"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Info Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">关于版本</h3>
            <div className="space-y-4">
              {isLoadingVersion ? (
                <div className="p-8 text-center">
                  <Loader2 size={16} className="animate-spin inline-block text-gray-400" />
                  <span className="ml-2 text-[10px] text-gray-400">加载中...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">最近推送时间</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.lastPushTime}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">推送标题</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.lastPushTitle}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-2">Commit版本号</div>
                    <div className="text-sm font-black text-gray-900">{versionInfo.commitVersion}</div>
                  </div>
                </div>
              )}
              <div className="pt-4">
                <button
                  onClick={() => {
                    setShowVersionModal(false);
                  }}
                  className="w-full py-3 text-xs font-bold text-white bg-[#1E40AF] rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center justify-center"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
