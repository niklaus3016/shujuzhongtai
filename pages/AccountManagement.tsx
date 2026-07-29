import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft, UserPlus, Users, Search, ChevronRight,
  Shield, User, Crown, Star, ToggleLeft, ToggleRight, Trash2, Phone, MapPin, Users2, Edit2, ChevronDown, CheckCircle, Download,
  Wrench, Zap, Loader2, AlertTriangle
} from 'lucide-react';
import { request } from '../services/api';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { cacheManager } from '../services/cacheManager';
import {
  LEVEL_V2_API,
  LEVEL_V2_ORDER,
  formatCommission,
  getLevelV2Theme,
  VALID_LEVELS_V2,
  type LevelV2ConfigRow,
} from '../utils/levelV2Service';

interface Account {
  _id: string;
  username: string;
  password?: string;
  // Q8 超管专属：明文密码（仅 /admin/supervisor/* 接口在 SUPER_ADMIN 调用时返回）
  passwordPlain?: string;
  role: string;
  status: string;
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
  createdAt: string;
  parentName?: string;
  superior?: string;
  isGroupLeader?: boolean;
  groupLeaderId?: string;
  teamId?: string;
  // Q5 ① 手动档标识（来源 Admin.js 字段）
  manualLevel?: 'P1'|'P2'|'P3'|'P4'|'P5'|'P6'|'P7'|'P8' | string | null;
  manualLevelSetAt?: string | number | Date | null;
  managedTeamIds?: string[];
  // CSJ 设备数限制（仅员工账号使用）
  csjDeviceLimit?: number;
}

interface AccountManagementProps {
  onBack: () => void;
}

const AccountManagement: React.FC<AccountManagementProps> = ({ onBack }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Account[]>([]);
  const scrollPositionRef = useRef<number>(0);
  const [groups, setGroups] = useState<{ _id: string; groupName: string; teamLeaderId: string; teamName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [addType, setAddType] = useState<'team' | 'employee' | 'group'>('employee');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // 高管账号管理状态
  const [adminManagers, setAdminManagers] = useState<Account[]>([]);
  // 高管编辑时选中的团队
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  
  // 数据缓存（使用全局 cacheManager）
  const getCachedData = useCallback((key: string) => {
    return cacheManager.get(key, 60000); // 1分钟缓存
  }, []);
  
  // 设置缓存数据
  const setCachedData = useCallback((key: string, data: any) => {
    cacheManager.set(key, data, 60000); // 1分钟缓存
  }, []);
  
  // 清除缓存
  const clearCache = useCallback(() => {
    cacheManager.clear();
  }, []);
  
  // 使用左滑返回hook
  const swipeRef = useSwipeBack({ onBack });
  
  const [formData, setFormData] = useState({
    teamName: '',
    realName: '',
    phone: '',
    region: '',
    username: '',
    password: '',
    employeeId: '',
    parentId: '',
    groupId: '',
    groupName: '',
    commissionRate: '',
    csjDeviceLimit: 1
  });

  // 获取当前登录用户信息
  const fetchCurrentUser = async () => {
    try {
      const userStr = localStorage.getItem('admin_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        const isSuper = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
        setIsSuperAdmin(isSuper);
        return user;
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    // 保存当前滚动位置
    const scrollPosition = window.scrollY || document.documentElement.scrollTop;
    const startTime = performance.now();
    try {
      clearCache();
      
      // 获取当前用户信息
      const user = await fetchCurrentUser();
      const isTeamLeader = user?.role === 'NORMAL_ADMIN';
      const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN';
      const teamName = user?.teamName;
      
      // ✅ Q8 新方案：并行 3 个 GET（2 条新 /admin/supervisor/* + 老员工接口），彻底去掉 130 行合并去重管线
      const [
        suTLRes,
        suGLRes,
        employeeResponse,
        suAMRes, // 高管列表
      ] = await Promise.all([
        request<any>('/admin/supervisor/team-leaders?pageSize=200', { method: 'GET' }).catch(e => (console.error('[supervisor] team-leaders ERR:', e), null)),
        request<any>('/admin/supervisor/group-leaders?pageSize=200', { method: 'GET' }).catch(e => (console.error('[supervisor] group-leaders ERR:', e), null)),
        request<any>('/admin/employee/list?pageSize=1000', { method: 'GET' }).catch(e => (console.error('员工接口 ERR:', e), null)),
        request<any>('/admin/supervisor/admin-managers?pageSize=200', { method: 'GET' }).catch(e => (console.error('[supervisor] admin-managers ERR:', e), null)),
      ]);

      // 团队长列表（优先走新接口；如果新接口挂了回退到老 /admin/account/list）
      let rawTeamAccounts: Account[] = [];
      if (suTLRes && Array.isArray(suTLRes?.data ? suTLRes.data : suTLRes)) {
        rawTeamAccounts = (suTLRes.data && !Array.isArray(suTLRes) ? suTLRes.data : suTLRes).map((x: any) => ({
          ...x,
          role: x.role || 'NORMAL_ADMIN',
        }));
      } else {
        // 兜底：老接口
        const old = await request<any>('/admin/account/list?pageSize=100', { method: 'GET' }).catch(() => null);
        rawTeamAccounts = old ? (Array.isArray(old) ? old : (old?.admins || [])).filter((a: any) => a.role === 'NORMAL_ADMIN') : [];
      }

      // 组长列表（优先走新接口；回退到老合并管线）
      let rawGroupLeaders: Account[] = [];
      if (suGLRes && Array.isArray(suGLRes?.data ? suGLRes.data : suGLRes)) {
        rawGroupLeaders = (suGLRes.data && !Array.isArray(suGLRes) ? suGLRes.data : suGLRes).map((x: any) => ({
          ...x,
          role: x.role || 'GROUP_LEADER',
          isGroupLeader: true,
          parentId: x.teamId || x.parentId,  // 兼容老代码里的 parentId 引用（战队下拉）
          teamGroupId: x.groupId || x.teamGroupId || x._id,
        }));
      } else {
        // 兜底：老合并管线
        const oldAcc = await request<any>('/admin/account/list?pageSize=100', { method: 'GET' }).catch(() => null);
        const oldEmp = employeeResponse ? (Array.isArray(employeeResponse) ? employeeResponse : employeeResponse.data || []) : [];
        const acc = oldAcc ? (Array.isArray(oldAcc) ? oldAcc : (oldAcc.admins || [])) : [];
        const empLeaders = oldEmp.filter((e: any) => e.isGroupLeader || e.role === 'group_leader' || e.role === 'GROUP_LEADER' || (e.groupId && e.groupId !== ''));
        const accLeaders = acc.filter((a: any) => a.role === 'GROUP_LEADER' || a.role === 'group_leader');
        const m = new Map();
        [...empLeaders, ...accLeaders].forEach(l => {
          const k = `${l.realName}-${l.teamName}`;
          if (!k) return;
          const e = m.get(k);
          if (!e) { m.set(k, l); return; }
          const isA = (l.username && l.username !== l.realName);
          const eIsA = (e.username && e.username !== e.realName);
          m.set(k, {
            ...e, ...(Object.keys(l).length > Object.keys(e).length ? l : {}),
            ...(isA ? { _id: l._id, username: l.username, password: l.password } : {}),
            ...(eIsA ? { _id: e._id, username: e.username, password: e.password } : {}),
            groupName: l.groupName || e.groupName,
            commission: l.commission !== undefined ? l.commission : e.commission,
            isGroupLeader: true,
          });
        });
        rawGroupLeaders = Array.from(m.values());
      }

      // 如果是团队长，只显示自己团队的数据
      let employeeAccounts: any[] = employeeResponse ? (Array.isArray(employeeResponse) ? employeeResponse : (employeeResponse?.data || [])) : [];
      if (isTeamLeader && teamName) {
        employeeAccounts = employeeAccounts.filter((e: any) => {
          const et = e.parentName || e.teamName || e.superior || '';
          return et === teamName;
        });
      }

      // 员工扣掉已经是组长的（避免重复）
      // ⚠️ 旧逻辑用「realName-teamName」字符串模糊去重，会误伤真实员工（如员工 5555 范洁 / 鼎盛战队，
      //   跟组长范洁的 realName-teamName 撞 key 就被误删）。
      //   新策略：只按「精确 employeeId 匹配」或员工自标识组长标志（isGroupLeader / group_leader / GROUP_LEADER / groupId非空）剔除，
      //   绝不因为 realName-teamName 重合就误删；可登录员工身份一律保留。
      const groupLeaderEmpIdSet = new Set<string>();
      rawGroupLeaders.forEach(g => {
        if (g.employeeId) groupLeaderEmpIdSet.add(String(g.employeeId));
      });
      const nonLeaderEmployees = employeeAccounts.filter((e: any) => {
        const isLeaderOld = e.isGroupLeader || e.role === 'group_leader' || e.role === 'GROUP_LEADER' || (e.groupId && e.groupId !== '');
        if (isLeaderOld) return false;
        if (e.employeeId && groupLeaderEmpIdSet.has(String(e.employeeId))) return false;
        return true;
      });

      // setTeamLeaders（团队长 tab 下拉用）
      setTeamLeaders(rawTeamAccounts);

      // groups 下拉框数据（组长 tab 编辑弹窗的「选择组别」用，直接从 rawGroupLeaders 映射，保证和新接口一致）
      const newGroups = rawGroupLeaders.map(g => ({
        _id: g.groupId || g.teamGroupId || g._id || '',
        groupName: g.groupName || '',
        teamLeaderId: g.teamId || g.parentId || '',
        teamName: g.teamName || g.parentName || '',
      })).filter(g => !!g._id && !!g.groupName);
      setGroups(newGroups);

      // 全量 accounts（tab 过滤 useMemo 从这里分）
      const allAccounts: Account[] = [
        ...rawTeamAccounts,
        ...rawGroupLeaders,
        ...nonLeaderEmployees,
      ];
      setAccounts(allAccounts);

      // 高管列表（单独存储，不合并到 allAccounts）
      let rawAdminManagers: Account[] = [];
      if (suAMRes && Array.isArray(suAMRes?.data ? suAMRes.data : suAMRes)) {
        rawAdminManagers = (suAMRes.data && !Array.isArray(suAMRes) ? suAMRes.data : suAMRes).map((x: any) => ({
          ...x,
          role: x.role || 'ADMIN_MANAGER',
        }));
      }
      setAdminManagers(rawAdminManagers);

      console.log(`[fetchAccounts] 新管线：团队长=${rawTeamAccounts.length}，组长=${rawGroupLeaders.length}，员工=${nonLeaderEmployees.length}，高管=${rawAdminManagers.length}，合计=${allAccounts.length}，耗时=${(performance.now() - startTime).toFixed(0)}ms`);
    } catch (e: any) {
      console.error('Error in fetchAccounts (supervisor pipeline):', e);
      setAccounts([]);
      setTeamLeaders([]);
      setGroups([]);
    } finally {
      setLoading(false);
      setTimeout(() => window.scrollTo(0, scrollPosition), 0);
    }
  }, [getCachedData, setCachedData]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);



  const handleAddAccount = async () => {
    setError(null);
    
    if (addType === 'team') {
      if (!formData.teamName || !formData.realName || !formData.phone || !formData.region || !formData.username || !formData.password) {
        setError('请填写所有必填字段');
        return;
      }
    } else if (addType === 'group') {
      if (!formData.parentId || !formData.realName || !formData.phone || !formData.username || !formData.password || !formData.groupName) {
        setError('请填写所有必填字段');
        return;
      }
    } else {
      if (!formData.parentId || !formData.realName || !formData.phone || !formData.region) {
        setError('请填写所有必填字段');
        return;
      }
    }

    setSaving(true);
    try {
      if (addType === 'team') {
        // ✅ 新接口：/admin/supervisor/team-leaders（团队长新建）
        const TL_DEFAULT_COMM = 0.08; // 老数据里 6/10 个 TL 都是 0.08，作为默认值
        const commission = formData.commissionRate
          ? (parseFloat(formData.commissionRate) / 100)
          : TL_DEFAULT_COMM;
        await request<any>('/admin/supervisor/team-leaders', {
          method: 'POST',
          body: JSON.stringify({
            teamName: formData.teamName,
            realName: formData.realName,
            phone: formData.phone,
            // 员工/团队长/组长的地区字段：前端 region；新接口用 phone/teamName/realName，没有必填 region；也顺带传一份
            region: formData.region,
            username: formData.username,
            passwordPlain: formData.password,  // 新接口 passwordPlain（老代码写的是 password）
            commission,
          })
        });
      } else if (addType === 'group') {
        // ✅ 新接口：/admin/supervisor/group-leaders（组长新建=自动开通，无中间态）
        // commission 使用默认值 0.08（前端不再让用户输入）
        const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
        const commission = 0.08;
        const payload = {
          realName: formData.realName,
          username: formData.username,
          passwordPlain: formData.password,
          phone: formData.phone,
          teamId: formData.parentId,
          teamName: selectedTeam?.teamName || '',
          groupName: formData.groupName,
          commission,
        };
        console.log('创建组长 payload:', JSON.stringify(payload, null, 2));
        console.log('teamLeaders:', JSON.stringify(teamLeaders.map(t => ({_id: t._id, teamName: t.teamName})), null, 2));
        await request<any>('/admin/supervisor/group-leaders', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else {
        // 普通员工（保留老接口）
        const selectedGroup = groups.find(g => g._id === formData.groupId);
        const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
        await request<any>('/admin/employee/create', {
          method: 'POST',
          body: JSON.stringify({
            parentId: formData.parentId,
            realName: formData.realName,
            phone: formData.phone,
            region: formData.region,
            teamGroupId: formData.groupId || '',
            groupName: selectedGroup?.groupName || '',
            teamName: selectedTeam?.teamName || '',
          })
        });
      }
    
      setShowAddModal(false);
      setFormData({
        teamName: '',
        realName: '',
        phone: '',
        region: '',
        username: '',
        password: '',
        employeeId: '',
        parentId: '',
        groupId: '',
        groupName: '',
        commissionRate: '',
        csjDeviceLimit: 1
      });
      
      clearCache();
      fetchAccounts();
    } catch (error: any) {
      console.error('Error adding account (supervisor pipeline):', error);
      console.error('Error stack:', error.stack);
      setError(error.message || '添加账号失败（请检查用户名是否重复或密码是否过短）');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount) return;
    
    setError(null);
    
    if (editingAccount.role === 'employee' || editingAccount.employeeId) {
      if (!formData.realName || !formData.phone || !formData.region) {
        setError('请填写所有必填字段');
        return;
      }
    } else {
      if (!formData.realName) {
        setError('请填写所有必填字段');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingAccount.role === 'employee' || editingAccount.employeeId) {
        // 员工（保留老接口）
        const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
        const selectedGroup = groups.find(g => g._id === formData.groupId);
        const employeeBody: any = {
          realName: formData.realName,
          phone: formData.phone,
          region: formData.region,
          employeeId: formData.employeeId,
          parentId: formData.parentId || editingAccount.parentId,
          groupId: formData.groupId || editingAccount.groupId,
          groupName: selectedGroup?.groupName || editingAccount.groupName,
          teamName: selectedTeam?.teamName || editingAccount.teamName,
          superior: selectedTeam?.teamName || editingAccount.teamName
        };
        // CSJ 设备数限制：仅超管和高管可修改
        if (isSuperAdmin || currentUser?.role === 'ADMIN_MANAGER') {
          employeeBody.csjDeviceLimit = formData.csjDeviceLimit;
        }
        await request<any>(`/admin/employee/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify(employeeBody)
        });
      } else if (editingAccount.role === 'NORMAL_ADMIN') {
        // ✅ 新接口：PUT /admin/supervisor/team-leaders/:id（编辑团队长）
        //    commission 不提交！按你要求「分成比例不允许手动编辑」，传了后端也会忽略
        const body: any = {
          realName: formData.realName,
          phone: formData.phone,
        };
        // username / passwordPlain / teamName / status：只有用户填了/非默认才传
        if (formData.username && formData.username !== editingAccount.username) body.username = formData.username;
        if (formData.password) body.passwordPlain = formData.password; // 空=不改密码
        if (formData.teamName) body.teamName = formData.teamName;
        // 状态：如果老代码有改 status 的需求（目前只有切换按钮，但这里也支持）
        const formOrigStatus = editingAccount.status;
        if (formOrigStatus && ['active','inactive'].includes(formOrigStatus)) body.status = formOrigStatus;
        await request<any>(`/admin/supervisor/team-leaders/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else if (editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader) {
        // ✅ 新接口：PUT /admin/supervisor/group-leaders/:id（id = TeamGroup._id = editingAccount._id / groupId）
        const tgId = editingAccount.groupId || editingAccount.teamGroupId || editingAccount._id;
        const selectedTeam = teamLeaders.find(t => t._id === (formData.parentId || editingAccount.teamId || editingAccount.parentId));
        const body: any = {
          realName: formData.realName,
          phone: formData.phone,
        };
        if (formData.username && formData.username !== editingAccount.username) body.username = formData.username;
        if (formData.password) body.passwordPlain = formData.password; // 空=不改
        if (formData.parentId || editingAccount.teamId) body.teamId = formData.parentId || editingAccount.teamId;
        if (selectedTeam?.teamName || editingAccount.teamName) body.teamName = selectedTeam?.teamName || editingAccount.teamName;
        if (formData.groupName) body.groupName = formData.groupName;
        // ❌ commission 故意不传！「分成比例不允许手动编辑」
        const origStatus = editingAccount.status;
        if (origStatus && ['active','inactive'].includes(origStatus)) body.status = origStatus;
        await request<any>(`/admin/supervisor/group-leaders/${tgId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else if (editingAccount.role === 'ADMIN_MANAGER') {
        // ✅ 新接口：PUT /admin/supervisor/admin-managers/:id（编辑高管，直接传 managedTeamIds）
        const body: any = {
          realName: formData.realName,
          phone: formData.phone,
          managedTeamIds: selectedTeamIds, // 直接包含团队分配
        };
        if (formData.username && formData.username !== editingAccount.username) body.username = formData.username;
        if (formData.password) body.passwordPlain = formData.password; // 空=不改
        await request<any>(`/admin/supervisor/admin-managers/${editingAccount._id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        // 其他未知管理员（兜底老接口）
        const updateData: any = { realName: formData.realName, phone: formData.phone, region: formData.region };
        if (editingAccount.role === 'NORMAL_ADMIN') updateData.teamName = formData.teamName;
        if (formData.username) updateData.username = formData.username;
        if (formData.password) updateData.password = formData.password;
        await request<any>(`/admin/account/${editingAccount._id}`, { method: 'PUT', body: JSON.stringify(updateData) });
      }
      
      setShowEditModal(false);
      setEditingAccount(null);
      setFormData({
        teamName: '', realName: '', phone: '', region: '',
        username: '', password: '', employeeId: '',
        parentId: '', groupId: '', groupName: '', commissionRate: '',
        csjDeviceLimit: 1
      });
      
      clearCache();
      fetchAccounts();
    } catch (error: any) {
      console.error('Error editing account (supervisor pipeline):', error);
      setError(error.message || '编辑账号失败（请检查用户名是否重复）');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    setSaving(true);
    try {
      const isTL = deletingAccount.role === 'NORMAL_ADMIN' && !deletingAccount.employeeId;
      const isGL = deletingAccount.role === 'GROUP_LEADER' || deletingAccount.role === 'group_leader' || deletingAccount.isGroupLeader;
      if (isTL) {
        // ✅ 新接口：DELETE /admin/supervisor/team-leaders/:id（级联：删admins，保留TG/员工，归属清空）
        await request<any>(`/admin/supervisor/team-leaders/${deletingAccount._id}`, { method: 'DELETE' });
      } else if (isGL) {
        // ✅ 新接口：DELETE /admin/supervisor/group-leaders/:id（id = TeamGroup._id = groupId / _id / teamGroupId）
        const tgId = deletingAccount.groupId || deletingAccount.teamGroupId || deletingAccount._id;
        await request<any>(`/admin/supervisor/group-leaders/${tgId}`, { method: 'DELETE' });
      } else if (deletingAccount.role === 'employee' || deletingAccount.employeeId) {
        // 员工（保留老接口）
        await request<any>(`/admin/employee/${deletingAccount._id}`, { method: 'DELETE' });
      } else {
        // 其他管理员（兜底老接口）
        await request<any>(`/admin/account/${deletingAccount._id}`, { method: 'DELETE' });
      }
    } catch (error: any) {
      console.error('Error deleting account (supervisor pipeline):', error);
      setError(error.message || '删除账号失败');
    } finally {
      cacheManager.delete('accounts_all');
      setShowDeleteModal(false);
      setDeletingAccount(null);
      setSaving(false);
      fetchAccounts();
    }
  };

  const handleToggleStatus = async (account: Account, event?: React.MouseEvent) => {
    // 阻止默认行为和事件冒泡
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 移除焦点，防止浏览器自动滚动
    if (event?.currentTarget) {
      (event.currentTarget as HTMLElement).blur();
    }
    
    try {
      const newStatus = account.status === 'active' ? 'inactive' : 'active';
      
      // 保存当前滚动位置到ref
      scrollPositionRef.current = window.scrollY || document.documentElement.scrollTop;
      console.log('保存滚动位置:', scrollPositionRef.current);
      
      if (account.role === 'employee' || account.employeeId) {
        // 员工状态切换必须用专门的 /status 子路径 + enabled/disabled 枚举：
        //   - 编辑实体 PUT /admin/employee/${_id} 会把 status 字段过滤掉（HTTP 200 但不落库）
        //   - /status 子路径若传 active/inactive 会被后端 400 "无效的状态值" 拒绝
        const empNewStatus = account.status === 'enabled' ? 'disabled' : 'enabled';
        await request<any>(`/admin/employee/${account._id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: empNewStatus })
        });
        // newStatus 变量是团队长分支的 active/inactive，这里员工实际走的是 empNewStatus
        // 更新本地 state 时用 empNewStatus（否则 UI 显示 active/inactive 会和后端 enabled/disabled 不一致导致刷新跳变）
        (function refreshLocalStateAfterEmpToggle() {
          setAccounts(prev => prev.map(a => a._id === account._id ? { ...a, status: empNewStatus } : a));
        })();
        // 然后直接 return，不要走下面统一的 setAccounts（它会把 status 写成团队长那套 active/inactive）
        // 再恢复滚动位置
        [0, 50, 100, 200, 300, 500].forEach(delay => {
          setTimeout(() => {
            if (scrollPositionRef.current > 0) {
              window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
              console.log(`已恢复滚动位置(${delay}ms):`, scrollPositionRef.current);
              if (delay === 500) scrollPositionRef.current = 0;
            }
          }, delay);
        });
        return; // ✅ 员工分支在这里结束，不进下面的团队长分支 active/inactive 刷新逻辑
      } else {
        // 使用更新账号的API来切换状态，而不是专门的状态切换API
        // 团队长/组长账号集合 status 枚举 = active / inactive
        await request<any>(`/admin/account/${account._id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      }
      
      // 更新本地状态（团队长/组长分支才会走到这里：上面员工分支已经 return 了）
       setAccounts(prevAccounts => {
         const newAccounts = prevAccounts.map(a => 
           a._id === account._id ? { ...a, status: newStatus } : a
         );
         console.log('状态已更新，准备恢复滚动位置:', scrollPositionRef.current);
         return newAccounts;
       });
       
       // 使用多个setTimeout确保在DOM更新后恢复滚动位置
       [0, 50, 100, 200, 300, 500].forEach(delay => {
         setTimeout(() => {
           if (scrollPositionRef.current > 0) {
             window.scrollTo({ top: scrollPositionRef.current, behavior: 'auto' });
             console.log(`已恢复滚动位置(${delay}ms):`, scrollPositionRef.current);
             if (delay === 500) {
               scrollPositionRef.current = 0;
             }
           }
         }, delay);
       });
    } catch (error: any) {
      console.error('Error toggling status:', error);
      alert(error.message || '切换状态失败');
    }
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      teamName: account.teamName || '',
      realName: account.realName || '',
      phone: account.phone || '',
      region: account.region || '',
      username: account.username || '',
      password: '',
      employeeId: account.employeeId || '',
      parentId: account.parentId || '',
      groupId: account.groupId || account.teamGroupId || '',
      groupName: account.groupName || '',
      commissionRate: account.commission ? (Math.round(account.commission * 100 * 100) / 100).toString() : '',
      csjDeviceLimit: account.csjDeviceLimit || 1
    });
    // 初始化高管团队选择
    if (account.role === 'ADMIN_MANAGER') {
      setSelectedTeamIds(account.managedTeamIds || []);
    } else {
      setSelectedTeamIds([]);
    }
    setShowEditModal(true);
  };

  const openDeleteModal = (account: Account) => {
    setDeletingAccount(account);
    setShowDeleteModal(true);
  };

  const [activeTab, setActiveTab] = useState<'team-leader' | 'group-leader' | 'employee' | 'admin-manager'>('team-leader');

  // 导出员工账号功能
  const handleExportEmployees = () => {
    // 过滤出员工账号（排除组长）
    const employeeAccounts = accounts.filter(a => 
      a.employeeId && !(a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== ''))
    );
    
    if (employeeAccounts.length === 0) {
      alert('暂无员工账号可导出');
      return;
    }

    // 生成CSV内容
    const headers = ['员工号', '姓名', '手机号', '地区', '团队', '组名', '状态', '创建时间'];
    const rows = employeeAccounts.map(account => [
      account.employeeId || '',
      account.realName || '',
      account.phone || '',
      account.region || '',
      account.teamName || account.parentName || '',
      account.groupName || '',
      (account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? '启用' : '禁用',
      new Date(account.createdAt).toLocaleString('zh-CN')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `员工账号列表_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 统一排序：启用的放前面，禁用的放最后；3 个 tab（团队长/组长/员工）都用同一套规则
  const sortDisabledToBottom = <T extends { status?: string | null | undefined }>(list: T[]) => {
    return [...list].sort((a, b) => {
      const isDisabled = (s: T['status']) => s === 'inactive' || s === 'disabled';
      return Number(isDisabled(a.status)) - Number(isDisabled(b.status));
    });
  };

  // 过滤账号列表
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    // 根据当前标签页过滤
    if (activeTab === 'team-leader') {
      filtered = accounts.filter(a =>
        !a.employeeId && a.role === 'NORMAL_ADMIN'
      );
    } else if (activeTab === 'group-leader') {
      // 过滤组长账号
      filtered = accounts.filter(a =>
        a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== '')
      );
    } else if (activeTab === 'admin-manager') {
      // 过滤高管账号
      filtered = adminManagers;
    } else {
        // 过滤非组长员工
        filtered = accounts.filter(a =>
          a.employeeId && !(a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== ''))
        );
      }

    // 根据搜索关键词过滤
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(a =>
        (a.realName && a.realName.toLowerCase().includes(keyword)) ||
        (a.username && a.username.toLowerCase().includes(keyword)) ||
        (a.phone && a.phone.includes(keyword)) ||
        (a.employeeId && a.employeeId.includes(keyword))
      );
    }

    // ✅ 排序：禁用的全部放到最后（TL / GL / EMP 同逻辑）
    filtered = sortDisabledToBottom(filtered);

    console.log('过滤后的账号列表:', filtered);
    return filtered;
  }, [accounts, activeTab, searchKeyword]);

  // 计算团队长账号数量
  const teamLeaderCount = useMemo(() => {
    return accounts.filter(a => 
      !a.employeeId && a.role === 'NORMAL_ADMIN'
    ).length;
  }, [accounts]);

  // 计算组长账号数量
  const groupLeaderCount = useMemo(() => {
    return accounts.filter(a => 
      a.role === 'GROUP_LEADER' || a.role === 'group_leader' || a.isGroupLeader || (a.groupId && a.groupId !== '')
    ).length;
  }, [accounts]);

  // 计算员工账号数量
  const employeeCount = useMemo(() => {
    return accounts.filter(a => a.employeeId).length;
  }, [accounts]);

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB]">
      {/* 头部 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-gray-400 active:text-gray-900 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <User className="text-[#1E40AF] mr-2" size={24} />
              帐号管理
            </h1>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            <UserPlus size={20} />
          </button>
        </div>
        
        {/* 搜索框 */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索姓名、手机号、工号..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
      </header>

      {/* 标签页 */}
      <div className="px-4 py-3 bg-white border-b flex space-x-2">
        <button
          onClick={() => setActiveTab('team-leader')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'team-leader'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          团队长账号 ({teamLeaderCount})
        </button>
        <button
          onClick={() => setActiveTab('group-leader')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'group-leader'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          组长账号 ({groupLeaderCount})
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'employee'
              ? 'bg-[#1E40AF] text-white'
              : 'bg-white text-gray-500 border border-gray-100'
          }`}
        >
          员工账号 ({employeeCount})
        </button>
        {/* 超管专属：高管账号标签 */}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('admin-manager')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'admin-manager'
                ? 'bg-[#1E40AF] text-white'
                : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            高管账号 ({adminManagers.length})
          </button>
        )}
        <button
          onClick={handleExportEmployees}
          className="px-3 py-2 text-xs font-bold bg-green-500 text-white rounded-xl transition-all hover:bg-green-600 flex items-center space-x-1"
        >
          <Download size={12} />
          <span>导出</span>
        </button>
      </div>

      {/* 账号列表 */}
      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9FAFB]">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-20 text-center">
            <User className="mx-auto text-gray-200 mb-2" size={48} />
            <p className="text-xs text-gray-400 font-bold">
              {activeTab === 'team-leader' ? '暂无团队长账号' : 
               activeTab === 'group-leader' ? '暂无组长账号' :
               activeTab === 'admin-manager' ? '暂无高管账号' : '暂无员工账号'}
            </p>
          </div>
        ) : (
          <div className="space-y-3" style={{ overflowAnchor: 'none' }}>
            {filteredAccounts.map((account) => (
              <div key={account._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      account.role === 'ADMIN_MANAGER'
                        ? 'bg-red-100 text-red-600'
                        : account.role === 'NORMAL_ADMIN' 
                          ? 'bg-purple-100 text-purple-600'
                          : account.role === 'GROUP_LEADER' || account.role === 'group_leader'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-blue-100 text-blue-600'
                    }`}>
                      {account.role === 'ADMIN_MANAGER' ? (
                        <Shield size={20} />
                      ) : account.role === 'NORMAL_ADMIN' ? (
                        <Crown size={20} />
                      ) : account.role === 'GROUP_LEADER' || account.role === 'group_leader' ? (
                        <Star size={20} />
                      ) : (
                        <User size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* 组长账号的显示逻辑 */}
                      {(account.role === 'GROUP_LEADER' || account.role === 'group_leader' || account.isGroupLeader) ? (
                        <>
                          {account.teamName && (
                            <p className="text-base text-[#1E40AF] font-bold">
                              {account.teamName}
                            </p>
                          )}
                          <p className="text-sm text-orange-500 font-bold flex items-center">
                            组名：{account.groupName || '无'}
                          </p>
                          <h3 className="text-sm text-[#1E40AF] font-bold">
                            组长：{account.realName || '无'}
                          </h3>
                          {account.username && (
                            <p className="text-xs text-gray-500">
                              用户名：{account.username}
                            </p>
                          )}
                          {/* ✅ 超管可见明文密码：只要有 username 就显示；历史账号 passwordPlain 为空显示默认密码 */}
                          {account.username && (
                            <p className="text-xs text-gray-500">
                              密码：<span className="font-mono">{account.passwordPlain || account.password || '11112222（默认）'}</span>
                            </p>
                          )}
                          {/* 组长卡片：手机号（有值显示，空留空占位，无图标）强制一行显示 */}
                          <p className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                            手机号：{account.phone || ''}
                          </p>
                        </>
                      ) : account.role === 'ADMIN_MANAGER' ? (
                        /* ====== 高管账号卡片 ====== */
                        <>
                          <p className="text-base text-red-600 font-bold">
                            {account.realName || '高管'}
                          </p>
                          <p className="text-sm text-[#1E40AF] font-bold">
                            高管
                          </p>
                          {account.username && (
                            <p className="text-xs text-gray-500">
                              用户名：{account.username}
                            </p>
                          )}
                          {account.username && (
                            <p className="text-xs text-gray-500">
                              密码：<span className="font-mono">{account.passwordPlain || account.password || '11112222（默认）'}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                            手机号：{account.phone || ''}
                          </p>
                          {/* 管理的团队数量 */}
                          {account.managedTeamIds && account.managedTeamIds.length > 0 && (
                            <p className="text-xs text-gray-500">
                              管理团队数：{account.managedTeamIds.length} 个
                            </p>
                          )}
                        </>
                      ) : (
                        /* 团队长和员工账号的显示逻辑 */
                        <>
                          {account.role === 'NORMAL_ADMIN' && !account.employeeId ? (
                            /* ====== 团队长卡片统一抬头 ====== */
                            <>
                              {/* 战队名（有空兜底） */}
                              {account.teamName ? (
                                <p className="text-base text-[#1E40AF] font-bold">
                                  {account.teamName}
                                </p>
                              ) : (
                                <p className="text-base text-gray-400 font-bold">
                                  战队：未命名
                                </p>
                              )}
                              {/* 团队长：realName 为空则显示 username，保证 mgl_* 这类自动建的账号也能显示 */}
                              <h3 className="text-sm font-bold text-[#1E40AF]">
                                团队长：{account.realName || account.username || '未命名'}
                              </h3>
                            </>
                          ) : (
                            <>
                              {account.teamName && (
                                <p className="text-sm text-[#1E40AF] font-bold">
                                  {account.teamName}
                                </p>
                              )}
                              <h3 className="text-sm font-bold text-gray-900">
                                {account.realName || '无'}
                                {account.employeeId && <span className="ml-2 text-[#1E40AF]">({account.employeeId})</span>}
                              </h3>
                            </>
                          )}
                          <div className="space-y-0.5">
                            {/* 团队长显示用户名 + 明文密码（有 username 就显示密码；历史账号 passwordPlain 为空显示默认密码） */}
                            {account.role === 'NORMAL_ADMIN' && !account.employeeId && account.username && (
                              <p className="text-xs text-gray-500">
                                用户名：{account.username}
                              </p>
                            )}
                            {account.role === 'NORMAL_ADMIN' && !account.employeeId && account.username && (
                              <p className="text-xs text-gray-500">
                                密码：<span className="font-mono">{account.passwordPlain || account.password || '11112222（默认）'}</span>
                              </p>
                            )}
                            {/* 团队长卡片：手机号（有值显示，空留空占位，无图标）强制一行显示 */}
                            {account.role === 'NORMAL_ADMIN' && !account.employeeId && (
                              <p className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                                手机号：{account.phone || ''}
                              </p>
                            )}
                            {account.username && !account.employeeId && account.role !== 'NORMAL_ADMIN' && (
                              <p className="text-xs text-gray-500">
                                用户名：{account.username}
                              </p>
                            )}
                            {/* 共用区块：员工账号显示手机号（不误伤 TL/GL），强制一行显示 */}
                            {!(account.role === 'NORMAL_ADMIN' || account.role === 'group_leader' || account.role === 'GROUP_LEADER' || account.isGroupLeader) && account.phone && (
                              <p className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                                <Phone size={10} className="mr-1 flex-shrink-0" />
                                {account.phone}
                              </p>
                            )}

                            {account.region && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <MapPin size={10} className="mr-1 flex-shrink-0" />
                                {account.region}
                              </p>
                            )}
                            {account.employeeId && (
                              <p className="text-xs text-[#1E40AF] flex items-center">
                                团队：{account.parentName || account.teamName || account.superior || '无'}
                              </p>
                            )}
                            {account.employeeId && (
                              <p className="text-xs text-orange-500 flex items-center">
                                组别：{account.groupName || '无'}
                              </p>
                            )}
                            {/* CSJ 设备数限制：仅超管和高管可见 */}
                            {account.employeeId && (isSuperAdmin || currentUser?.role === 'ADMIN_MANAGER') && (
                              <p className="text-xs text-green-600 flex items-center">
                                CSJ设备数：{account.csjDeviceLimit || 1}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {account.createdAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex items-center space-x-2">

                      <button
                        onClick={() => openEditModal(account)}
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => openDeleteModal(account)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? '启用' : '禁用'}
                      </span>
                      <button
                        onClick={(e) => handleToggleStatus(account, e)}
                        className={`w-10 h-6 rounded-full p-0.5 transition-all ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${(account.status === 'active' || account.status === 'enabled' || account.status === '1' || !account.status) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加账号弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">添加账号</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError(null);
                  setFormData({
                    teamName: '',
                    realName: '',
                    phone: '',
                    region: '',
                    username: '',
                    password: '',
                    employeeId: '',
                    parentId: '',
                    groupId: '',
                    groupName: '',
                    commissionRate: '',
                    csjDeviceLimit: 1
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 账号类型选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  账号类型
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* ✅ 暂时隐藏：不允许直接添加团队长账号 */}
                  {/* <button
                    onClick={() => setAddType('team')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'team'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    团队长
                  </button> */}
                  <button
                    onClick={() => setAddType('group')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'group'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    组长
                  </button>
                  <button
                    onClick={() => setAddType('employee')}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      addType === 'employee'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    员工
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* 表单字段 */}
              <div className="space-y-4">
                {addType === 'group' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName || team.realName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        组名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="请输入组名"
                        value={formData.groupName}
                        onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}

                {addType === 'employee' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => {
                          setFormData({...formData, parentId: e.target.value, groupId: ''});
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属组
                      </label>
                      <select
                        value={formData.groupId}
                        onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">无</option>
                        {groups.filter(group => {
                          if (!formData.parentId) return true;
                          // 首先尝试通过 teamLeaderId 匹配
                          if (group.teamLeaderId === formData.parentId) return true;
                          // 然后尝试通过团队名称匹配
                          const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
                          return selectedTeam && group.teamName === selectedTeam.teamName;
                        }).map(group => (
                          <option key={group._id} value={group._id}>
                            {group.groupName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {addType === 'team' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        团队名称 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="请输入团队名称"
                        value={formData.teamName}
                        onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                    {/* ✅ 新建团队长加分项比例（%）：POST /supervisor/team-leaders 需要 commission */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        分成比例 (%) <span className="text-red-500">*</span>
                        <span className="ml-2 text-gray-400 font-normal text-[11px]">默认 8%，创建后不可修改</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="8（默认 8%，创建后不可修改）"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({...formData, commissionRate: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="请输入姓名"
                    value={formData.realName}
                    onChange={(e) => setFormData({...formData, realName: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                {(addType === 'team' || addType === 'employee' || addType === 'group') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        手机号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="请输入手机号"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                    {/* 所属地区：团队长和员工显示，组长隐藏 */}
                    {addType !== 'group' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          所属地区 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="请输入所属地区"
                          value={formData.region}
                          onChange={(e) => setFormData({...formData, region: e.target.value})}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                        />
                      </div>
                    )}
                    
                    {addType === 'employee' && (
                      <p className="text-xs text-blue-600 mt-1">
                        *员工号添加后，由系统自动生成4位随机数字
                      </p>
                    )}
                  </>
                )}

                {(addType === 'team' || addType === 'group') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        登录账号 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="请输入登录账号"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="请输入密码"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleAddAccount}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑账号弹窗 */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">编辑账号</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAccount(null);
                  setError(null);
                  setFormData({
                    teamName: '',
                    realName: '',
                    phone: '',
                    region: '',
                    username: '',
                    password: '',
                    employeeId: '',
                    parentId: '',
                    groupId: '',
                    groupName: '',
                    commissionRate: '',
                    csjDeviceLimit: 1
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {(editingAccount.role === 'employee' || editingAccount.employeeId) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属团队
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => {
                          setFormData({...formData, parentId: e.target.value, groupId: ''});
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择团队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属组
                      </label>
                      <select
                        value={formData.groupId}
                        onChange={(e) => setFormData({...formData, groupId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">无</option>
                        {groups.filter(group => {
                          if (!formData.parentId) return true;
                          // 首先尝试通过 teamLeaderId 匹配
                          if (group.teamLeaderId === formData.parentId) return true;
                          // 然后尝试通过团队名称匹配
                          const selectedTeam = teamLeaders.find(t => t._id === formData.parentId);
                          return selectedTeam && group.teamName === selectedTeam.teamName;
                        }).map(group => (
                          <option key={group._id} value={group._id}>
                            {group.groupName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {(editingAccount.role === 'NORMAL_ADMIN') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        团队名称
                      </label>
                      <input
                        type="text"
                        value={formData.teamName}
                        onChange={(e) => setFormData({...formData, teamName: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* 超管团队长编辑界面：分成比例已按要求隐藏（仅后端配置决定） */}
                  </>
                )}

                {/* ====== 高管编辑：团队分配 ====== */}
                {editingAccount.role === 'ADMIN_MANAGER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      分配管理团队 <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {teamLeaders.map(team => (
                        <label
                          key={team._id}
                          className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedTeamIds.includes(team._id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTeamIds.includes(team._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTeamIds([...selectedTeamIds, team._id]);
                              } else {
                                setSelectedTeamIds(selectedTeamIds.filter(id => id !== team._id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-700">
                            {team.teamName || team.realName || team.username}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      已选择 {selectedTeamIds.length} 个团队
                    </p>
                  </div>
                )}

                {(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        所属战队
                      </label>
                      <select
                        value={formData.parentId || editingAccount.teamId || editingAccount.parentId || ''}
                        onChange={(e) => {
                          setFormData({...formData, parentId: e.target.value, groupId: ''});
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      >
                        <option value="">请选择战队</option>
                        {teamLeaders.map(team => (
                          <option key={team._id} value={team._id}>
                            {team.teamName || team.realName || team._id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        组名
                      </label>
                      <input
                        type="text"
                        value={formData.groupName}
                        onChange={(e) => setFormData({...formData, groupName: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.realName}
                    onChange={(e) => setFormData({...formData, realName: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    手机号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                  />
                </div>

                {/* 所属地区：仅员工编辑界面显示；团队长和组长编辑界面隐藏 */}
                {(editingAccount.role === 'employee' || (editingAccount.employeeId && !(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader))) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所属地区 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={(e) => setFormData({...formData, region: e.target.value})}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                    />
                  </div>
                )}
                
                {(editingAccount.role === 'employee' || (editingAccount.employeeId && !(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader))) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        工号
                      </label>
                      <input
                        type="text"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* CSJ 设备数限制：仅超管和高管可编辑 */}
                    {(isSuperAdmin || currentUser?.role === 'ADMIN_MANAGER') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CSJ 每日设备数限制
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={formData.csjDeviceLimit}
                          onChange={(e) => setFormData({...formData, csjDeviceLimit: Math.max(1, Math.min(20, parseInt(e.target.value) || 1))})}
                          className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">该员工每日在 CSJ 系统可登录的最大设备数（默认1）</p>
                      </div>
                    )}
                  </>
                )}

                {!(editingAccount.role === 'employee' || (editingAccount.employeeId && !(editingAccount.role === 'GROUP_LEADER' || editingAccount.role === 'group_leader' || editingAccount.isGroupLeader))) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        账号
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码 (留空则不修改)
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNNS43IDUuM2wtNS01Ii8+PHBhdGggZD0iTTUuNy01LjNsNSA1Ii8+PC9zdmc+')] bg-no-repeat bg-right-3 bg-center"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleEditAccount}
                disabled={saving}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '确认修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-500 mb-6">
                确定要删除账号 "{deletingAccount.realName || deletingAccount.username}" 吗？此操作不可恢复。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingAccount(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
