
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  NORMAL_ADMIN = 'NORMAL_ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  token?: string;
  parentId?: string; // For employees, who is their admin
  coins?: number; // For employees
  commission?: number; // For normal admins
  status: 'enabled' | 'disabled';
  avatar?: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export enum TimeRange {
  TODAY = '今日',
  YESTERDAY = '昨日',
  THIS_WEEK = '本周',
  THIS_MONTH = '本月'
}

export enum AppTab {
  DASHBOARD = '首页',
  NEW_USERS = '新人',
  TEAM = '团队',
  MANAGEMENT = '管理',
  ALERTS = '异常监控',
  USERS = '用户管理',
  RANKING = '排名',
  PROFILE = '我的'
}

export interface KPIStats {
  impressions: number;
  clicks: number;
  coins: number;
  revenue: number;
  impressionsGrowth: number;
  clicksGrowth: number;
  coinsGrowth: number;
  revenueGrowth: number;
}

export interface User {
  id: string;
  name: string;
  adsWatched: number;
  currentCoins: number;
  totalPayout: number;
  lastActive: string;
  status: '正常' | '封禁' | '待审核';
  avatar: string;
  ipCount: number;
  deviceCount: number;
}

export interface AlertItem {
  id: string;
  type: '用户异常' | '数据异常';
  severity: '高' | '中' | '低';
  title: string;
  description: string;
  time: string;
  status: '待处理' | '已处理' | '已忽略';
}
