import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Search, X, MoreVertical, Edit2, Trash2, Loader2,
  Shield, ChevronRight, AlertCircle
} from 'lucide-react';
import { AdminUser, UserRole } from '../types';
import { request } from '../services/api';

const GroupLeaderManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<AdminUser | null>(null);
  const [deletingLeader, setDeletingLeader] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    teamName: '',
    groupName: '',
    teamGroupId: ''
  });
  
  // Group leaders data
  const [groupLeaders, setGroupLeaders] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; teamId: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all accounts
        const accountsResponse = await request<any>('/admin/account/list', {
          method: 'GET'
        });
        const allAccounts = Array.isArray(accountsResponse) ? accountsResponse : (accountsResponse?.admins || []);
        
        // Filter group leaders
        const leadersList = allAccounts.filter((a: any) => 
          a.role === 'GROUP_LEADER' || a.role === 'group_leader'
        );
        setGroupLeaders(leadersList);

        // Fetch teams (team leaders)
        const teamLeaders = allAccounts.filter((a: any) => 
          a.role === 'NORMAL_ADMIN'
        );
        const teams = teamLeaders.map((t: any) => ({
          id: t._id,
          name: t.teamName
        }));
        setTeams(teams);

        // Fetch groups from employee data
        const employeeResponse = await request<any>('/admin/employee/list?pageSize=1000', {
          method: 'GET'
        });
        const employeeAccounts = employeeResponse ? (Array.isArray(employeeResponse) ? employeeResponse : (employeeResponse?.data || [])) : [];
        
        const groupsMap = new Map();
        employeeAccounts.forEach((e: any) => {
          if (e.groupId && e.groupName) {
            if (!groupsMap.has(e.groupId)) {
              groupsMap.set(e.groupId, {
                id: e.groupId,
                name: e.groupName,
                teamId: e.parentId || ''
              });
            }
          }
        });
        setGroups(Array.from(groupsMap.values()));
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data on error
        setGroupLeaders([
          { id: 'GL001', username: '张组长', role: UserRole.GROUP_LEADER, status: 'enabled', teamName: '鼎盛战队', groupName: '一组', teamGroupId: 'G001' },
          { id: 'GL002', username: '李组长', role: UserRole.GROUP_LEADER, status: 'enabled', teamName: '鼎盛战队', groupName: '二组', teamGroupId: 'G002' },
        ]);
        setTeams([
          { id: 'T001', name: '鼎盛战队' },
          { id: 'T002', name: '精英战队' },
        ]);
        setGroups([
          { id: 'G001', name: '一组', teamId: 'T001' },
          { id: 'G002', name: '二组', teamId: 'T001' },
          { id: 'G003', name: '一组', teamId: 'T002' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 过滤后的组长列表
  const filteredGroupLeaders = useMemo(() => {
    return groupLeaders.filter(leader => 
      (leader.username || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (leader.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (leader.teamName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (leader.groupName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  }, [groupLeaders, searchTerm]);

  const handleAddGroupLeader = async () => {
    if (!formData.username || !formData.password || !formData.teamGroupId || !formData.teamName) {
      setError('请填写所有必填字段');
      return;
    }
    
    setSaving(true);
    try {
      const teamLeaderId = teams.find(t => t.name === formData.teamName)?.id || '';
      if (!teamLeaderId) {
        setError('无法找到对应的团队长ID');
        return;
      }
      
      // 1. 先创建管理员账号
      const adminResult = await request<AdminUser>('/admin/account/create', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          role: UserRole.GROUP_LEADER,
          parentId: teamLeaderId,
          teamName: formData.teamName,
          groupName: formData.groupName
        })
      });
      
      if (!adminResult) {
        setError('创建管理员账号失败');
        return;
      }
      
      // 2. 再将该管理员设置为组长
      const result = await request<AdminUser>('/admin/employee/group-leader/add', {
        method: 'POST',
        body: JSON.stringify({
          teamLeaderId: teamLeaderId,
          teamName: formData.teamName,
          groupName: formData.groupName,
          commission: 0.05,
          groupLeaderId: adminResult.id,
          groupLeaderName: formData.username
        })
      });
      
      if (result) {
        setGroupLeaders(prev => [result, ...prev]);
      }
      setIsAddModalOpen(false);
      setFormData({ username: '', password: '', teamName: '', groupName: '', teamGroupId: '' });
      setError(null);
    } catch (error: any) {
      console.error('Failed to add group leader:', error);
      setError(error.message || '添加失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditGroupLeader = async () => {
    if (!selectedLeader) return;
    setError(null);

    if (!formData.username || !formData.teamGroupId) {
      setError('请填写所有必填字段');
      return;
    }

    setSaving(true);
    try {
      await request<AdminUser>(`/admin/account/${selectedLeader.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password || undefined,
          parentId: teams.find(t => t.name === formData.teamName)?.id || '',
          groupId: formData.teamGroupId,
          groupName: formData.groupName,
          teamName: formData.teamName
        })
      });
      
      setIsEditModalOpen(false);
      setSelectedLeader(null);
      setFormData({ username: '', password: '', teamName: '', groupName: '', teamGroupId: '' });
      // 重新获取所有数据
      const accountsResponse = await request<any>('/admin/account/list', {
        method: 'GET'
      });
      const allAccounts = Array.isArray(accountsResponse) ? accountsResponse : (accountsResponse?.admins || []);
      
      // 重新过滤组长账号
      const leadersList = allAccounts.filter((a: any) => 
        a.role === 'GROUP_LEADER' || a.role === 'group_leader'
      );
      setGroupLeaders(leadersList);
      setError(null);
    } catch (error: any) {
      console.error('Error updating group leader:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroupLeader = async () => {
    if (!deletingLeader) return;
    
    setSaving(true);
    try {
      await request<any>(`/admin/account/${deletingLeader.id}`, {
        method: 'DELETE'
      });
      
      setIsDeleteModalOpen(false);
      setDeletingLeader(null);
      // 重新获取所有数据
      const accountsResponse = await request<any>('/admin/account/list', {
        method: 'GET'
      });
      const allAccounts = Array.isArray(accountsResponse) ? accountsResponse : (accountsResponse?.admins || []);
      
      // 重新过滤组长账号
      const leadersList = allAccounts.filter((a: any) => 
        a.role === 'GROUP_LEADER' || a.role === 'group_leader'
      );
      setGroupLeaders(leadersList);
      setError(null);
    } catch (error: any) {
      console.error('Error deleting group leader:', error);
      setError(error.message || '删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (leader: AdminUser) => {
    setSelectedLeader(leader);
    setFormData({
      username: leader.username || '',
      password: '',
      teamName: leader.teamName || '',
      groupName: leader.groupName || '',
      teamGroupId: leader.teamGroupId || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (leader: AdminUser) => {
    setDeletingLeader(leader);
    setIsDeleteModalOpen(true);
  };

  const handleTeamChange = (teamId: string) => {
    const selectedTeam = teams.find(t => t.id === teamId);
    if (selectedTeam) {
      setFormData(prev => ({ ...prev, teamName: selectedTeam.name }));
    }
  };

  const handleGroupChange = (groupId: string) => {
    const selectedGroup = groups.find(g => g.id === groupId);
    if (selectedGroup) {
      setFormData(prev => ({
        ...prev,
        groupName: selectedGroup.name,
        teamGroupId: selectedGroup.id
      }));
    }
  };

  return (
    <div className="p-4 pb-24 animate-in fade-in duration-300">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            <Shield className="text-[#1E40AF] mr-2" size={24} />
            组长账号管理
          </h1>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            <UserPlus size={20} />
          </button>
        </div>
      </header>

      <div className="relative group mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
        <input 
          type="text"
          placeholder="搜索组长姓名、ID、团队或组..."
          className="w-full pl-9 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filteredGroupLeaders.map((leader) => (
          <div key={leader.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(leader.status === 'enabled' || leader.status === '1') ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                <Shield size={20} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900">
                    {leader.username || '未知用户'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">
                  团队: {leader.teamName || '未设置'}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">
                  组: {leader.groupName || '未设置'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openEditModal(leader)}
                className="p-1.5 text-gray-400 hover:text-[#1E40AF] transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => openDeleteModal(leader)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${(leader.status === 'enabled' || leader.status === '1') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {(leader.status === 'enabled' || leader.status === '1') ? '启用' : '禁用'}
              </span>
            </div>
          </div>
        ))}

        {filteredGroupLeaders.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Shield size={40} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400 font-bold">暂无组长数据</p>
          </div>
        )}
      </div>

      {/* Add Group Leader Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">添加新组长</h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                setFormData({ username: '', password: '', teamName: '', groupName: '', teamGroupId: '' });
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">用户名</label>
                <input 
                  type="text" 
                  required
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">密码</label>
                <input 
                  type="password" 
                  required
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择团队</label>
                <select
                  required
                  value={formData.teamName}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择团队</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择组</label>
                <select
                  required
                  value={formData.teamGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择组</option>
                  {groups.filter(g => g.teamId === teams.find(t => t.name === formData.teamName)?.id).map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleAddGroupLeader}
                disabled={saving || !formData.username || !formData.password || !formData.teamGroupId}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.username || !formData.password || !formData.teamGroupId ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Leader Modal */}
      {isEditModalOpen && selectedLeader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">编辑组长账号</h3>
              <button onClick={() => {
                setIsEditModalOpen(false);
                setSelectedLeader(null);
                setFormData({ username: '', password: '', teamName: '', groupName: '', teamGroupId: '' });
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">用户名</label>
                <input 
                  type="text" 
                  required
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">密码（留空表示不修改）</label>
                <input 
                  type="password" 
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择团队</label>
                <select
                  required
                  value={teams.find(t => t.name === formData.teamName)?.id || ''}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择团队</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择组</label>
                <select
                  required
                  value={formData.teamGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择组</option>
                  {groups.filter(g => g.teamId === teams.find(t => t.name === formData.teamName)?.id).map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleEditGroupLeader}
                disabled={saving || !formData.username || !formData.teamGroupId}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.username || !formData.teamGroupId ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Leader Modal */}
      {isDeleteModalOpen && deletingLeader && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">删除账号</h3>
              <button onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingLeader(null);
                setError(null);
              }} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    确定要删除 <span className="font-bold text-gray-900">
                      {deletingLeader.username}
                    </span> 账号吗？
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    此操作不可撤销，删除后将无法恢复。
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-500 text-xs font-bold rounded-xl text-center">
                  {error}
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingLeader(null);
                  setError(null);
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleDeleteGroupLeader}
                disabled={saving}
                className={`flex-1 py-4 font-black rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all ${saving ? 'bg-gray-300 text-gray-500' : 'bg-red-500 text-white'}`}
              >
                {saving ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupLeaderManagement;