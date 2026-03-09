
import { AdminUser, UserRole } from '../types';
import { request } from './api';

export const authService = {
  async login(username: string, password: string, remember: boolean): Promise<AdminUser> {
    // Call the actual API
    const data = await request<{ user: AdminUser; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    // Process the response
    const user: AdminUser = {
      id: data.user.id,
      username: data.user.username,
      role: data.user.role as UserRole,
      token: data.token,
      status: 'enabled',
      commission: data.user.commission,
      teamName: data.user.teamName
    };
    
    this.saveSession(user, remember);
    return user;
  },

  saveSession(user: AdminUser, remember: boolean) {
    if (user.token) {
      localStorage.setItem('admin_token', user.token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      if (remember) {
        localStorage.setItem('remember_username', user.username);
      } else {
        localStorage.removeItem('remember_username');
      }
    }
  },

  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },

  getCurrentUser(): AdminUser | null {
    const userStr = localStorage.getItem('admin_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('admin_token');
  },

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    // Call the actual API
    const token = localStorage.getItem('admin_token');
    const response = await fetch('https://wfqmaepvjkdd.sealoshzh.site/api/update-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, newPassword }),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || '密码修改失败');
    }
  }
};
