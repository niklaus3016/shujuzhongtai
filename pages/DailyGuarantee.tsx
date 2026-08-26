import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Gift, Settings, List, Check, X,
  Filter, ChevronRight, ChevronLeft as ChevronLeftIcon,
  User, Coins, Clock, AlertCircle, Edit3, BarChart3, Calendar, TrendingUp, Save,
  Power, ZapOff
} from 'lucide-react';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { request } from '../services/api';

interface DailyGuaranteeProps {
  onBack: () => void;
}

interface StageConfig {
  stage: number;
  thresholdViews: number;
  thresholdGold: number;
}

interface GuaranteeConfig {
  enabled: boolean;
  stages: StageConfig[];
  thresholdViews: number;
  thresholdGold: number;
  source: 'DB' | 'DEFAULT' | 'DEFAULT(pending_effective)' | 'DB(legacy_single)';
  effectiveFromDateStr: string;
  updatedAt: string;
  updatedBy: string;
  remark: string;
}

interface GuaranteeOverview {
  date: string;
  scope: 'ALL' | 'TEAM' | 'GROUP' | 'NONE';
  totalClaimedCount: number;
  totalClaimedGold: number;
  totalViewsSnapshot: number;
  stages: Array<{
    stage: number;
    totalClaimedCount: number;
    totalClaimedGold: number;
    totalViewsSnapshot: number;
  }>;
  topClaims: Array<{
    employeeId: string;
    dateStr: string;
    stage: number;
    gapGold: number;
    viewsAtClaim: number;
    goldAtClaim: number;
    virtualWeeklyAtClaim: number;
    claimedAt: string;
  }>;
}

interface GuaranteeClaim {
  employeeId: string;
  userId: string;
  dateStr: string;
  stage: number;
  thresholdViews: number;
  thresholdGold: number;
  viewsAtClaim: number;
  goldAtClaim: number;
  virtualWeeklyAtClaim: number;
  totalGoldForGuaranteeAtClaim: number;
  gapGold: number;
  claimedAt: string;
  employee: {
    name: string;
    phone: string;
    username: string;
    teamName: string;
    groupName: string;
  };
}

interface ClaimsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ClaimsResponse {
  success: boolean;
  scope: 'ALL' | 'TL' | 'GL' | 'NONE';
  _scopeWarning?: string;
  list: GuaranteeClaim[];
  pagination: ClaimsPagination;
  summary: {
    totalClaimedCount: number;
    totalClaimedGold: number;
  };
}

const DEFAULT_STAGES: StageConfig[] = [
  { stage: 1, thresholdViews: 2000, thresholdGold: 50000 },
  { stage: 2, thresholdViews: 3000, thresholdGold: 100000 }
];

const DailyGuarantee: React.FC<DailyGuaranteeProps> = ({ onBack }) => {
  const swipeRef = useSwipeBack({ onBack });
  const [activeTab, setActiveTab] = useState<'config' | 'overview' | 'claims'>('config');

  // Config state
  const [config, setConfig] = useState<GuaranteeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    stages: [...DEFAULT_STAGES],
    effectiveFromDateStr: '',
    remark: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  // Overview state
  const [overviewDate, setOverviewDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [overview, setOverview] = useState<GuaranteeOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Claims state
  const [claims, setClaims] = useState<GuaranteeClaim[]>([]);
  const [claimsPagination, setClaimsPagination] = useState<ClaimsPagination>({
    page: 1, pageSize: 20, total: 0, totalPages: 0
  });
  const [claimsSummary, setClaimsSummary] = useState({ totalClaimedCount: 0, totalClaimedGold: 0 });
  const [claimsScope, setClaimsScope] = useState<'ALL' | 'TL' | 'GL' | 'NONE'>('ALL');
  const [scopeWarning, setScopeWarning] = useState('');
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsPage, setClaimsPage] = useState(1);
  const [claimsPageSize] = useState(20);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [filterStage, setFilterStage] = useState<'' | '1' | '2'>('');
  const [filterMinGap, setFilterMinGap] = useState('');
  const [filterMaxGap, setFilterMaxGap] = useState('');
  const [sortBy, setSortBy] = useState<'claimedAt' | 'gapGold' | 'dateStr'>('claimedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Fetch config
  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const data = await request<GuaranteeConfig>('/welfare/daily-guarantee/config', {
        method: 'GET'
      });
      if (!data.stages || data.stages.length === 0) {
        data.stages = [{ stage: 1, thresholdViews: data.thresholdViews, thresholdGold: data.thresholdGold }];
      }
      if (typeof data.enabled !== 'boolean') data.enabled = true;
      setConfig(data);
    } catch (err: any) {
      setConfigError(err.message || '获取配置失败');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Validate stages
  const validateStages = (stages: StageConfig[]): string | null => {
    if (!stages || stages.length < 2) return '需要至少配置两段';
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (!s.stage || !Number.isInteger(s.stage)) return `第${i + 1}段 stage 必须是正整数`;
      if (!s.thresholdViews || !Number.isInteger(s.thresholdViews) || s.thresholdViews < 1) return `第${i + 1}段 条数门槛必须是 ≥1 的整数`;
      if (!s.thresholdGold || !Number.isInteger(s.thresholdGold) || s.thresholdGold < 1) return `第${i + 1}段 保底金币必须是 ≥1 的整数`;
    }
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].stage !== stages[i - 1].stage + 1) return 'stage 必须按 1,2,3… 严格递增';
      if (stages[i].thresholdViews <= stages[i - 1].thresholdViews) return `第${i + 1}段 条数门槛必须大于第${i}段`;
      if (stages[i].thresholdGold <= stages[i - 1].thresholdGold) return `第${i + 1}段 保底金币必须大于第${i}段`;
    }
    return null;
  };

  // Save config
  const saveConfig = useCallback(async () => {
    const stagesParsed: StageConfig[] = editForm.stages.map(s => ({
      stage: Number(s.stage),
      thresholdViews: Number(s.thresholdViews),
      thresholdGold: Number(s.thresholdGold)
    }));
    const validationError = validateStages(stagesParsed);
    if (validationError) {
      setConfigError(validationError);
      return;
    }
    setSaveLoading(true);
    setConfigError('');
    setConfigSuccess('');
    try {
        const body: any = {
          enabled: config?.enabled ?? true,
          stages: stagesParsed,
          effectiveFromDateStr: editForm.effectiveFromDateStr || null,
          remark: editForm.remark || ''
        };
        await request<any>('/welfare/daily-guarantee/config', {
          method: 'POST',
          headers: new Headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body)
        });
      setConfigSuccess('保存成功！');
      setIsEditing(false);
      fetchConfig();
      setTimeout(() => setConfigSuccess(''), 3000);
    } catch (err: any) {
      setConfigError(err.message || '保存失败');
    } finally {
      setSaveLoading(false);
    }
  }, [editForm, fetchConfig]);

  // Fetch overview
  const fetchOverview = useCallback(async (date: string) => {
    setOverviewLoading(true);
    try {
      const data = await request<GuaranteeOverview>(`/welfare/daily-guarantee/overview?date=${date}`, {
        method: 'GET'
      });
      setOverview(data);
    } catch (err: any) {
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // Fetch claims
  const fetchClaims = useCallback(async () => {
    setClaimsLoading(true);
    setScopeWarning('');
    try {
      const params = new URLSearchParams();
      params.append('page', String(claimsPage));
      params.append('pageSize', String(claimsPageSize));
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      if (filterDate) {
        params.append('date', filterDate);
      } else {
        if (filterDateFrom) params.append('dateFrom', filterDateFrom);
        if (filterDateTo) params.append('dateTo', filterDateTo);
      }
      if (filterEmployeeId) params.append('employeeId', filterEmployeeId);
      if (filterStage) params.append('stage', filterStage);
      if (filterMinGap) params.append('minGapGold', filterMinGap);
      if (filterMaxGap) params.append('maxGapGold', filterMaxGap);

      const data = await request<ClaimsResponse>(`/welfare/daily-guarantee/claims?${params.toString()}`, {
        method: 'GET'
      });
      setClaims(data.list || []);
      setClaimsPagination(data.pagination);
      setClaimsSummary(data.summary);
      setClaimsScope(data.scope);
      if (data._scopeWarning) setScopeWarning(data._scopeWarning);
    } catch (err: any) {
      setClaims([]);
      setScopeWarning(err.message || '获取领取记录失败');
    } finally {
      setClaimsLoading(false);
    }
  }, [claimsPage, claimsPageSize, sortBy, sortOrder, filterDate, filterDateFrom, filterDateTo, filterEmployeeId, filterStage, filterMinGap, filterMaxGap]);

  // Initial load based on active tab
  useEffect(() => {
    if (activeTab === 'config') {
      fetchConfig();
    } else if (activeTab === 'overview') {
      fetchOverview(overviewDate);
    } else if (activeTab === 'claims') {
      fetchClaims();
    }
  }, [activeTab, fetchConfig, fetchOverview, fetchClaims]);

  // Retry fetch when filters change (for claims tab)
  useEffect(() => {
    if (activeTab === 'claims') {
      setClaimsPage(1);
      fetchClaims();
    }
  }, [filterDate, filterDateFrom, filterDateTo, filterEmployeeId, filterStage, filterMinGap, filterMaxGap, sortBy, sortOrder]);

  // Start editing
  const startEditing = () => {
    if (!config) return;
    setEditForm({
      stages: (config.stages && config.stages.length > 0 ? [...config.stages] : [...DEFAULT_STAGES]).map(s => ({ ...s })),
      effectiveFromDateStr: config.effectiveFromDateStr || '',
      remark: config.remark || ''
    });
    setConfigError('');
    setConfigSuccess('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setConfigError('');
  };

  // Quick toggle enabled switch
  const toggleEnabled = useCallback(async () => {
    if (!config) return;
    setToggleLoading(true);
    setConfigError('');
    setConfigSuccess('');
    const nextEnabled = !config.enabled;
    try {
      await request<any>('/welfare/daily-guarantee/config/enabled', {
        method: 'PATCH',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled: nextEnabled })
      });
      setConfigSuccess(nextEnabled ? '保底福袋已开启' : '保底福袋已关闭');
      setConfig({ ...config, enabled: nextEnabled });
      setTimeout(() => setConfigSuccess(''), 3000);
    } catch (err: any) {
      setConfigError(err.message || (nextEnabled ? '开启失败' : '关闭失败'));
    } finally {
      setToggleLoading(false);
    }
  }, [config]);

  const resetFilters = () => {
    setFilterDate('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterEmployeeId('');
    setFilterStage('');
    setFilterMinGap('');
    setFilterMaxGap('');
  };

  const totalPages = claimsPagination.totalPages || 1;

  const formatNumber = (num: number) => {
    if (num == null || isNaN(num)) return '0';
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'DB': return '数据库配置';
      case 'DEFAULT': return '默认配置';
      case 'DEFAULT(pending_effective)': return '待生效配置';
      case 'DB(legacy_single)': return '兼容单段配置';
      default: return source || '-';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'DB': return 'bg-blue-100 text-blue-600';
      case 'DEFAULT': return 'bg-gray-100 text-gray-600';
      case 'DEFAULT(pending_effective)': return 'bg-orange-100 text-orange-600';
      case 'DB(legacy_single)': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStageBadge = (stage: number) => {
    if (stage === 1) return 'bg-green-100 text-green-700 border-green-200';
    if (stage === 2) return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getStageLabel = (stage: number) => {
    if (stage === 1) return '一段';
    if (stage === 2) return '二段';
    return `第${stage}段`;
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-[#F9FAFB] animate-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="sticky top-0 bg-white z-40 px-4 py-4 flex items-center border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 active:text-gray-900">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">保底福袋管理</h1>
      </header>

      {/* Tabs */}
      <div className="sticky top-[57px] bg-white z-30 border-b border-gray-100">
        <div className="flex">
          {[
            { id: 'config' as const, label: '配置管理', icon: Settings },
            { id: 'overview' as const, label: '发放总览', icon: BarChart3 },
            { id: 'claims' as const, label: '领取历史', icon: List }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 transition-all ${
                activeTab === tab.id
                  ? 'text-[#1E40AF] border-b-2 border-[#1E40AF] font-bold'
                  : 'text-gray-400'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            {configLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF]"></div>
              </div>
            ) : config ? (
              <>
                {/* Current Config Display */}
                {!isEditing ? (
                  <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                    config.enabled ? 'border-gray-100' : 'border-red-200 bg-red-50/30'
                  }`}>
                    {/* Enabled Status + Switch */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          config.enabled
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {config.enabled ? <Power size={18} /> : <ZapOff size={18} />}
                        </div>
                        <div>
                          <div className="text-base font-bold text-gray-900">保底福袋功能</div>
                          <div className={`text-[10px] font-bold ${
                            config.enabled ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {config.enabled ? '● 运行中 - 员工可正常领取' : '● 已关闭 - 所有员工无法领取'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={toggleEnabled}
                        disabled={toggleLoading}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all ${
                          config.enabled ? 'bg-green-500' : 'bg-gray-300'
                        } ${toggleLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                            config.enabled ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center">
                        <Gift size={20} className="mr-2 text-pink-500" />
                        当前保底配置
                      </h2>
                      <button
                        onClick={startEditing}
                        className="p-2 text-[#1E40AF] bg-blue-50 rounded-lg active:bg-blue-100"
                      >
                        <Edit3 size={18} />
                      </button>
                    </div>

                    {/* Disabled Warning Banner */}
                    {!config.enabled && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
                        <div className="flex items-center text-red-600 text-xs font-bold mb-1">
                          <ZapOff size={14} className="mr-1" />
                          功能已关闭
                        </div>
                        <p className="text-xs text-red-500">
                          关闭期间，所有段位领取按钮将置灰，员工无法获得保底补差。
                        </p>
                      </div>
                    )}

                    {/* Stages Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-gray-500">段位</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-500">条数门槛</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-500">保底金币</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(config.stages || DEFAULT_STAGES).map((st) => (
                            <tr key={st.stage}>
                              <td className="px-3 py-3">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${
                                  st.stage === 1
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {st.stage}
                                </span>
                                <span className="ml-2 font-bold text-gray-700">
                                  {st.stage === 1 ? '第一段' : '第二段'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-[#1E40AF]">
                                {st.thresholdViews.toLocaleString()}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-yellow-600">
                                {formatNumber(st.thresholdGold)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-bold">配置来源</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${getSourceColor(config.source)}`}>
                          {getSourceLabel(config.source)}
                        </span>
                      </div>

                      {config.source === 'DEFAULT(pending_effective)' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                          <div className="flex items-center text-orange-600 text-xs font-bold mb-1">
                            <AlertCircle size={14} className="mr-1" />
                            待生效配置
                          </div>
                          <p className="text-xs text-orange-500">
                            当前配置将于 <span className="font-bold">{config.effectiveFromDateStr || '指定日期'}</span> 生效
                          </p>
                        </div>
                      )}

                      {config.effectiveFromDateStr && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-bold">生效日期</span>
                          <span className="text-xs font-bold text-gray-700">{config.effectiveFromDateStr}</span>
                        </div>
                      )}

                      {config.remark && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <div className="text-xs text-gray-500 font-bold mb-1">备注</div>
                          <div className="text-xs text-gray-700">{config.remark}</div>
                        </div>
                      )}

                      {config.updatedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-bold">最后更新</span>
                          <span className="text-xs text-gray-400">
                            {new Date(config.updatedAt).toLocaleString('zh-CN')} · {config.updatedBy || '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Edit Form
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center">
                        <Edit3 size={20} className="mr-2 text-[#1E40AF]" />
                        编辑保底配置
                      </h2>
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-gray-400"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Stages Editable Table */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">分段配置</label>
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-2 text-left font-bold text-gray-500">段位</th>
                                <th className="px-2 py-2 text-left font-bold text-gray-500">条数门槛</th>
                                <th className="px-2 py-2 text-left font-bold text-gray-500">保底金币</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {editForm.stages.map((st, idx) => (
                                <tr key={st.stage || idx}>
                                  <td className="px-2 py-2">
                                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${
                                      idx === 0
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {idx + 1}
                                    </div>
                                    <span className="ml-1 font-bold text-gray-600 text-[10px]">
                                      {idx === 0 ? '第一段' : '第二段'}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      value={st.thresholdViews}
                                      onChange={(e) => {
                                        const newStages = [...editForm.stages];
                                        newStages[idx] = { ...st, thresholdViews: Number(e.target.value) || 0 };
                                        setEditForm({ ...editForm, stages: newStages });
                                      }}
                                      min="1"
                                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="number"
                                      value={st.thresholdGold}
                                      onChange={(e) => {
                                        const newStages = [...editForm.stages];
                                        newStages[idx] = { ...st, thresholdGold: Number(e.target.value) || 0 };
                                        setEditForm({ ...editForm, stages: newStages });
                                      }}
                                      min="1"
                                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#1E40AF]"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">第二段的条数和金币必须都大于第一段</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">生效日期（可选）</label>
                        <input
                          type="date"
                          value={editForm.effectiveFromDateStr}
                          onChange={(e) => setEditForm({ ...editForm, effectiveFromDateStr: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">留空表示立即生效</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">备注（可选）</label>
                        <textarea
                          value={editForm.remark}
                          onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                          placeholder="如：双11临时调整"
                          rows={2}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF] resize-none"
                        />
                      </div>
                    </div>

                    {configError && (
                      <div className="mt-4 bg-red-50 p-3 rounded-xl flex items-center space-x-2">
                        <AlertCircle size={16} className="text-red-500" />
                        <span className="text-xs text-red-600">{configError}</span>
                      </div>
                    )}

                    {configSuccess && (
                      <div className="mt-4 bg-green-50 p-3 rounded-xl flex items-center space-x-2">
                        <Check size={16} className="text-green-500" />
                        <span className="text-xs text-green-600">{configSuccess}</span>
                      </div>
                    )}

                    <div className="flex space-x-3 mt-5">
                      <button
                        onClick={cancelEditing}
                        className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:bg-gray-200 transition-all"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveConfig}
                        disabled={saveLoading}
                        className={`flex-1 py-3 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-1 ${
                          saveLoading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-[#1E40AF] active:scale-95'
                        }`}
                      >
                        {saveLoading ? (
                          <span>保存中...</span>
                        ) : (
                          <>
                            <Save size={14} />
                            <span>保存配置</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Info Card */}
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center space-x-2">
                    <Gift size={16} />
                    <span>二段保底规则说明</span>
                  </h3>
                  <ul className="text-xs text-blue-600 space-y-1.5">
                    {(config.stages || DEFAULT_STAGES).map((st) => (
                      <li key={st.stage}>
                        • <span className="font-bold">第{st.stage === 1 ? '一' : '二'}段</span>：
                        当日观看 ≥ <span className="font-bold">{st.thresholdViews.toLocaleString()}</span> 次
                        且 当日金币 {'<'} <span className="font-bold">{formatNumber(st.thresholdGold)}</span>
                        → 补齐到 <span className="font-bold">{formatNumber(st.thresholdGold)}</span>
                      </li>
                    ))}
                    <li>• 仅超级管理员和财务可修改此配置</li>
                  </ul>
                </div>
              </>
            ) : (
              configError ? (
                <div className="bg-red-50 p-6 rounded-2xl text-center">
                  <AlertCircle size={40} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm text-red-600">{configError}</p>
                  <button
                    onClick={fetchConfig}
                    className="mt-3 px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl"
                  >
                    重试
                  </button>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Date Picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center">
                <Calendar size={14} className="mr-1" />
                选择日期
              </label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={overviewDate}
                  onChange={(e) => setOverviewDate(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
                <button
                  onClick={() => fetchOverview(overviewDate)}
                  className="px-4 py-2 bg-[#1E40AF] text-white text-xs font-bold rounded-xl active:bg-blue-700"
                >
                  查询
                </button>
              </div>
            </div>

            {overviewLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF]"></div>
              </div>
            ) : overview ? (
              <>
                {/* Scope Label */}
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-400">
                    数据范围: <span className="font-bold text-gray-600">
                      {overview.scope === 'ALL' ? '全部员工' :
                        overview.scope === 'TEAM' ? '本团队' :
                        overview.scope === 'GROUP' ? '本组' : '无权限'}
                    </span>
                  </div>
                </div>

                {/* Overall Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                    <div className="flex items-center text-green-600 text-xs font-bold mb-1">
                      <User size={14} className="mr-1" />
                      发放总人次
                    </div>
                    <div className="text-2xl font-black text-green-700">{overview.totalClaimedCount}</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4">
                    <div className="flex items-center text-yellow-600 text-xs font-bold mb-1">
                      <Coins size={14} className="mr-1" />
                      发放总金币
                    </div>
                    <div className="text-2xl font-black text-yellow-700">{formatNumber(overview.totalClaimedGold)}</div>
                  </div>
                </div>

                {/* Stage Stats */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <BarChart3 size={16} className="mr-1 text-[#1E40AF]" />
                    按段位统计
                  </h3>
                  <div className="space-y-3">
                    {(overview.stages && overview.stages.length > 0 ? overview.stages : []).map((st) => (
                      <div key={st.stage} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${
                              st.stage === 1
                                ? 'bg-green-100 text-green-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {st.stage}
                            </span>
                            <span className="text-xs font-bold text-gray-700">第{st.stage === 1 ? '一' : '二'}段</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="bg-white rounded-lg p-2">
                            <div className="text-gray-400 mb-0.5">发放人次</div>
                            <div className="font-black text-green-600">{st.totalClaimedCount}</div>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <div className="text-gray-400 mb-0.5">发放金币</div>
                            <div className="font-black text-yellow-600">{formatNumber(st.totalClaimedGold)}</div>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <div className="text-gray-400 mb-0.5">观看快照</div>
                            <div className="font-black text-gray-700">{st.totalViewsSnapshot.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Claims */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <TrendingUp size={16} className="mr-1 text-[#1E40AF]" />
                    最近 50 条领取
                  </h3>
                  {overview.topClaims && overview.topClaims.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {overview.topClaims.slice(0, 20).map((c, idx) => (
                        <div key={`${c.employeeId}-${c.claimedAt}-${idx}`} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center space-x-3">
                            <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black border ${getStageBadge(c.stage)}`}>
                              {c.stage}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-900">工号: {c.employeeId}</div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(c.claimedAt).toLocaleString('zh-CN')}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-yellow-600">+{formatNumber(c.gapGold)}</div>
                            <div className="text-[10px] text-gray-400">
                              {c.viewsAtClaim}条 / {formatNumber(c.goldAtClaim)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 text-xs">暂无领取数据</div>
                  )}
                  {overview.topClaims && overview.topClaims.length > 20 && (
                    <div className="text-center mt-3 text-[10px] text-gray-400">
                      共 {overview.topClaims.length} 条，仅显示前20条
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Calendar size={40} className="mx-auto text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">选择日期后查看发放总览</p>
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center">
                  <Filter size={14} className="mr-1" />
                  筛选条件
                </h3>
                <button
                  onClick={resetFilters}
                  className="text-[10px] text-gray-400 hover:text-[#1E40AF]"
                >
                  重置
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">单日期（优先级最高）</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                </div>

                {!filterDate && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">开始日期</label>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">结束日期</label>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">员工工号</label>
                    <input
                      type="text"
                      value={filterEmployeeId}
                      onChange={(e) => setFilterEmployeeId(e.target.value)}
                      placeholder="精确匹配工号"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">段位</label>
                    <select
                      value={filterStage}
                      onChange={(e) => setFilterStage(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    >
                      <option value="">全部段位</option>
                      <option value="1">第一段</option>
                      <option value="2">第二段</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">最小补差</label>
                    <input
                      type="number"
                      value={filterMinGap}
                      onChange={(e) => setFilterMinGap(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">最大补差</label>
                    <input
                      type="number"
                      value={filterMaxGap}
                      onChange={(e) => setFilterMaxGap(e.target.value)}
                      placeholder="不限"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">排序字段</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    >
                      <option value="claimedAt">领取时间</option>
                      <option value="gapGold">补差金额</option>
                      <option value="dateStr">日期</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">排序方式</label>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                    >
                      <option value="desc">从高到低</option>
                      <option value="asc">从低到高</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scope Warning */}
            {scopeWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 flex items-start space-x-2">
                <AlertCircle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-yellow-700">{scopeWarning}</span>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-[10px] text-gray-500 font-bold mb-1">总领取数</div>
                <div className="text-xl font-black text-[#1E40AF]">{formatNumber(claimsSummary.totalClaimedCount)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-[10px] text-gray-500 font-bold mb-1">总补发金币</div>
                <div className="text-xl font-black text-yellow-600">{formatNumber(claimsSummary.totalClaimedGold)}</div>
              </div>
            </div>

            {/* Claims List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {claimsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E40AF]"></div>
                </div>
              ) : claims.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {claims.map((claim, idx) => (
                    <div key={`${claim.employeeId}-${claim.claimedAt}-${idx}`} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <User size={16} className="text-[#1E40AF]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="text-sm font-bold text-gray-900 truncate">{claim.employee?.name || claim.employeeId}</span>
                              <span className="text-[10px] text-gray-400">{claim.employeeId}</span>
                              <span className={`inline-flex items-center justify-center text-[9px] font-black px-1.5 py-0.5 rounded border ${getStageBadge(claim.stage)}`}>
                                {getStageLabel(claim.stage)}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                              {claim.employee?.teamName || ''} {claim.employee?.groupName ? `· ${claim.employee.groupName}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-black text-yellow-600">+{formatNumber(claim.gapGold)}</div>
                          <div className="text-[10px] text-gray-400">{claim.dateStr}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-gray-400 mb-0.5">观看次数</div>
                          <div className="font-bold text-gray-700">{claim.viewsAtClaim.toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-gray-400 mb-0.5">当日金币</div>
                          <div className="font-bold text-gray-700">{formatNumber(claim.goldAtClaim)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-gray-400 mb-0.5">门槛</div>
                          <div className="font-bold text-gray-700">{claim.thresholdViews.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center text-[10px] text-gray-400">
                        <Clock size={10} className="mr-1" />
                        {new Date(claim.claimedAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <List size={40} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">暂无领取记录</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {claims.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 py-2">
                <button
                  onClick={() => setClaimsPage(Math.max(1, claimsPage - 1))}
                  disabled={claimsPage <= 1}
                  className={`p-2 rounded-lg ${claimsPage <= 1 ? 'bg-gray-100 text-gray-300' : 'bg-[#1E40AF] text-white active:bg-blue-700'}`}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <span className="text-xs text-gray-600 font-bold">
                  {claimsPage} / {totalPages}
                </span>
                <button
                  onClick={() => setClaimsPage(Math.min(totalPages, claimsPage + 1))}
                  disabled={claimsPage >= totalPages}
                  className={`p-2 rounded-lg ${claimsPage >= totalPages ? 'bg-gray-100 text-gray-300' : 'bg-[#1E40AF] text-white active:bg-blue-700'}`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyGuarantee;
