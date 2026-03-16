import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Edit2, Trash2, Loader2,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { request } from '../services/api';
import { AdminUser, UserRole } from '../types';

interface Group {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  createdAt: string;
}

const GroupManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    teamId: '',
    teamName: ''
  });
  
  // Groups data
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch current user
        const userResponse = await request<AdminUser>('/admin/me', {
          method: 'GET'
        });
        setCurrentUser(userResponse);

        // Fetch teams
        const teamsResponse = await request<{ id: string; name: string }[]>('/team/list', {
          method: 'GET'
        });
        setTeams(teamsResponse);

        // Fetch groups
        let groupsResponse;
        if (userResponse.role === UserRole.NORMAL_ADMIN && userResponse.teamName) {
          // Team leaders only see their own teams' groups
          const team = teamsResponse.find(t => t.name === userResponse.teamName);
          if (team) {
            groupsResponse = await request<Group[]>(`/group/list?teamId=${team.id}`, {
              method: 'GET'
            });
          } else {
            groupsResponse = [];
          }
        } else {
          // Super admins see all groups
          groupsResponse = await request<Group[]>('/group/list', {
            method: 'GET'
          });
        }
        setGroups(groupsResponse);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data on error
        setCurrentUser({
          id: 'A001',
          username: '测试团队长',
          role: UserRole.NORMAL_ADMIN,
          status: 'enabled',
          teamName: '鼎盛战队'
        });
        setTeams([
          { id: 'T001', name: '鼎盛战队' },
          { id: 'T002', name: '精英战队' },
        ]);
        setGroups([
          { id: 'G001', name: '一组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-01' },
          { id: 'G002', name: '二组', teamId: 'T001', teamName: '鼎盛战队', createdAt: '2024-01-02' },
          { id: 'G003', name: '一组', teamId: 'T002', teamName: '精英战队', createdAt: '2024-01-03' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 过滤后的组列表
  const filteredGroups = useMemo(() => {
    return groups.filter(group => 
      (group.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
      (group.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (group.teamName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  }, [groups, searchTerm]);

  const handleAddGroup = async () => {
    if (!formData.name || !formData.teamId) {
      setError('请填写所有必填字段');
      return;
    }
    
    setSaving(true);
    try {
      const result = await request<Group>('/group/create', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          teamId: formData.teamId,
          teamName: formData.teamName
        })
      });
      
      if (result) {
        setGroups(prev => [result, ...prev]);
      }
      setIsAddModalOpen(false);
      setFormData({ name: '', teamId: '', teamName: '' });
      setError(null);
    } catch (error: any) {
      console.error('Failed to add group:', error);
      setError(error.message || '添加失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleEditGroup = async () => {
    if (!selectedGroup) return;
    setError(null);

    if (!formData.name || !formData.teamId) {
      setError('请填写所有必填字段');
      return;
    }

    setSaving(true);
    try {
      await request<Group>(`/group/${selectedGroup.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          teamId: formData.teamId,
          teamName: formData.teamName
        })
      });
      
      setIsEditModalOpen(false);
      setSelectedGroup(null);
      setFormData({ name: '', teamId: '', teamName: '' });
      // 重新获取组列表
      let groupsResponse;
      if (currentUser?.role === UserRole.NORMAL_ADMIN && currentUser?.teamName) {
        const team = teams.find(t => t.name === currentUser.teamName);
        if (team) {
          groupsResponse = await request<Group[]>(`/group/list?teamId=${team.id}`, {
            method: 'GET'
          });
        } else {
          groupsResponse = [];
        }
      } else {
        groupsResponse = await request<Group[]>('/group/list', {
          method: 'GET'
        });
      }
      setGroups(groupsResponse);
      setError(null);
    } catch (error: any) {
      console.error('Error updating group:', error);
      setError(error.message || '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    
    setSaving(true);
    try {
      await request<any>(`/group/${deletingGroup.id}`, {
        method: 'DELETE'
      });
      
      setIsDeleteModalOpen(false);
      setDeletingGroup(null);
      // 重新获取组列表
      let groupsResponse;
      if (currentUser?.role === UserRole.NORMAL_ADMIN && currentUser?.teamName) {
        const team = teams.find(t => t.name === currentUser.teamName);
        if (team) {
          groupsResponse = await request<Group[]>(`/group/list?teamId=${team.id}`, {
            method: 'GET'
          });
        } else {
          groupsResponse = [];
        }
      } else {
        groupsResponse = await request<Group[]>('/group/list', {
          method: 'GET'
        });
      }
      setGroups(groupsResponse);
      setError(null);
    } catch (error: any) {
      console.error('Error deleting group:', error);
      setError(error.message || '删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (group: Group) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name || '',
      teamId: group.teamId || '',
      teamName: group.teamName || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (group: Group) => {
    setDeletingGroup(group);
    setIsDeleteModalOpen(true);
  };

  const handleTeamChange = (teamId: string) => {
    const selectedTeam = teams.find(t => t.id === teamId);
    if (selectedTeam) {
      setFormData(prev => ({ ...prev, teamName: selectedTeam.name, teamId }));
    }
  };

  return (
    <div className="p-4 pb-24 animate-in fade-in duration-300">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center">
            组管理
          </h1>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-[#1E40AF] text-white p-2 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <div className="relative group mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1E40AF] transition-colors" size={16} />
        <input 
          type="text"
          placeholder="搜索组名称、ID或团队..."
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
        {filteredGroups.map((group) => (
          <div key={group.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                <span className="text-sm font-bold">{group.name.charAt(0)}</span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900">
                    {group.name}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">
                  团队: {group.teamName}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">
                  创建时间: {new Date(group.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => openEditModal(group)}
                className="p-1.5 text-gray-400 hover:text-[#1E40AF] transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => openDeleteModal(group)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <span className="text-4xl font-bold text-gray-200">📁</span>
            <p className="text-xs text-gray-400 font-bold mt-2">暂无组数据</p>
          </div>
        )}
      </div>

      {/* Add Group Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">添加新组</h3>
              <button onClick={() => {
                setIsAddModalOpen(false);
                setFormData({ name: '', teamId: '', teamName: '' });
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">组名称</label>
                <input 
                  type="text" 
                  required
                  placeholder="请输入组名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择团队</label>
                <select
                  required
                  value={formData.teamId}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择团队</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleAddGroup}
                disabled={saving || !formData.name || !formData.teamId}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.name || !formData.teamId ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">编辑组</h3>
              <button onClick={() => {
                setIsEditModalOpen(false);
                setSelectedGroup(null);
                setFormData({ name: '', teamId: '', teamName: '' });
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">组名称</label>
                <input 
                  type="text" 
                  required
                  placeholder="请输入组名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">选择团队</label>
                <select
                  required
                  value={formData.teamId}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">请选择团队</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleEditGroup}
                disabled={saving || !formData.name || !formData.teamId}
                className={`w-full py-4 font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all mt-2 ${saving || !formData.name || !formData.teamId ? 'bg-gray-300 text-gray-500' : 'bg-[#1E40AF] text-white'}`}
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {isDeleteModalOpen && deletingGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">删除组</h3>
              <button onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingGroup(null);
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
                      {deletingGroup.name}
                    </span> 组吗？
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
                  setDeletingGroup(null);
                  setError(null);
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleDeleteGroup}
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

export default GroupManagement;