
export enum UserRole {
  SUPER_ADMIN = 'superadmin',
  ADMIN_MANAGER = 'ADMIN_MANAGER',
  NORMAL_ADMIN = 'NORMAL_ADMIN',
  GROUP_LEADER = 'GROUP_LEADER',
  EMPLOYEE = 'EMPLOYEE'
}

export interface AdminUser {
  id: string;
  _id?: string; // MongoDB ID
  username: string;
  realName?: string; // 真实姓名
  role: UserRole;
  token?: string;
  parentId?: string; // For employees, who is their admin
  coins?: number; // For employees
  commission?: number; // For normal admins
  status: 'enabled' | 'disabled' | '1' | '0' | 'active' | 'inactive';
  avatar?: string;
  teamName?: string; // For team leaders, the name of their team
  teamGroupId?: string; // For group leaders, the id of their group
  groupName?: string; // For group leaders, the name of their group
  groupId?: string; // Group ID
  phoneCount?: number; // 领取手机数
  phone?: string; // 手机号
  region?: string; // 地区
  employeeId?: string; // 员工工号
  memberCount?: number; // 组成员数
  zeroEarningsDays?: number; // 0收益天数
  createdAt?: string; // 创建时间
  updatedAt?: string; // 更新时间
  managedTeamIds?: string[]; // 高管管理的团队长ID列表
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
  PROFILE = '我的',
  GROUP_LEADER_MANAGEMENT = '组长管理',
  GROUP_MANAGEMENT = '团队管理',
  PERFORMANCE = '业绩'
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
