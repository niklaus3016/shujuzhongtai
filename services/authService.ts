
import { AdminUser, UserRole } from '../types';
import { request } from './api';
import { cacheManager } from './cacheManager';

export const authService = {
  async login(username: string, password: string, remember: boolean): Promise<AdminUser> {
    try {
      // Call the actual API
      const data = await request<{ admin: AdminUser; token: string }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      // Process the response
      const user: AdminUser = {
        id: data.admin?.id || '',
        username: data.admin?.username || '',
        realName: data.admin?.realName || '',
        role: data.admin?.role as UserRole || UserRole.NORMAL_ADMIN,
        token: data.token || '',
        status: 'enabled',
        commission: data.admin?.commission || 0,
        teamName: data.admin?.teamName || '',
        teamGroupId: data.admin?.teamGroupId || '',
        groupName: data.admin?.groupName || ''
      };
      
      this.saveSession(user, remember);
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  saveSession(user: AdminUser, remember: boolean) {
    try {
      if (user.token) {
        localStorage.setItem('admin_token', user.token);
        localStorage.setItem('admin_user', JSON.stringify(user));
        if (remember) {
          localStorage.setItem('remember_username', user.username);
        } else {
          localStorage.removeItem('remember_username');
        }
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  },

  logout() {
    try {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      // 清空内存缓存，防止切账号后看到上一个账号的数据
      cacheManager.clear();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  },

  getCurrentUser(): AdminUser | null {
    try {
      const userStr = localStorage.getItem('admin_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  },

  isAuthenticated(): boolean {
    try {
      return !!localStorage.getItem('admin_token');
    } catch (error) {
      console.error('Failed to check authentication:', error);
      return false;
    }
  },

  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      // Call the actual API with correct endpoint and parameters
      await request<any>('/admin/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
    } catch (error) {
      console.error('Update password failed:', error);
      throw error;
    }
  },

  normalizeRole(role: string | undefined): string {
    if (!role) return '';
    return role.trim().toUpperCase().replace(/_/g, '');
  },

  isSuperAdmin(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return normalized === 'SUPERADMIN';
  },

  isAdminManager(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return normalized === 'ADMINMANAGER';
  },

  isTeamLeader(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return normalized === 'NORMALADMIN';
  },

  isGroupLeader(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return normalized === 'GROUPLEADER';
  },

  isEmployee(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return normalized === 'EMPLOYEE';
  },

  isManagement(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return ['SUPERADMIN', 'ADMINMANAGER', 'NORMALADMIN', 'GROUPLEADER'].includes(normalized);
  },

  isSuperOrAdminManager(user: AdminUser | null | undefined): boolean {
    if (!user) return false;
    const normalized = this.normalizeRole(user.role);
    return ['SUPERADMIN', 'ADMINMANAGER'].includes(normalized);
  },

  getRoleDisplayName(role: string | undefined): string {
    const normalized = this.normalizeRole(role);
    const roleMap: Record<string, string> = {
      'SUPERADMIN': '超级管理员',
      'ADMINMANAGER': '高级管理员',
      'NORMALADMIN': '团队长',
      'GROUPLEADER': '组长',
      'EMPLOYEE': '员工',
    };
    return roleMap[normalized] || (role || '未知');
  }
};
