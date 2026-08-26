interface TransformedUser {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  watched: number;
  earnings: number;
  ipCount: number;
  deviceCount: number;
  ecpm: number;
  superior: string;
  teamName: string;
  teamGroupId: string;
  groupName: string;
  regDays: number;
  supervisorUsername?: string;
  supervisorRealName?: string;
  supervisorName?: string;
  isDirect?: boolean;
  sourceKind?: string;
  trend?: 'up' | 'down' | 'stable';
}

export function transformUser(user: any, includeTrend: boolean = false): TransformedUser {
  // 解析 isDirect：支持 boolean/number/string，也可从 sourceKind 推导
  let isDirect: boolean | undefined;
  if (typeof user.isDirect === 'boolean') {
    isDirect = user.isDirect;
  } else if (typeof user.isDirect === 'number') {
    isDirect = user.isDirect === 1;
  } else if (typeof user.isDirect === 'string') {
    const v = user.isDirect.toLowerCase().trim();
    if (v === 'true' || v === '1') isDirect = true;
    else if (v === 'false' || v === '0') isDirect = false;
  }
  // 从 sourceKind 推导 isDirect（如果直接字段不可用）
  if (isDirect === undefined && user.sourceKind) {
    const sk = String(user.sourceKind);
    if (sk === 'directD' || sk === 'glGroupG') isDirect = true;
    else if (sk === 'subGroupG' || sk === 'subTlDirectD') isDirect = false;
  }

  return {
    id: user.employeeId || user.userId || '',
    userId: user.userId || user.employeeId || '',
    name: user.realName || user.realname || user.name || user.username || user.userName || user.employeeId || user.userId || '',
    avatar: '',
    watched: user.watched || 0,
    earnings: (user.earnings || 0) / 1000,
    ipCount: user.ipCount || 1,
    deviceCount: user.deviceCount || 1,
    ecpm: user.ecpm || 0,
    superior: user.superior || user.supervisorUsername || user.supervisorName || user.supervisorRealName || user.teamName || '系统直属',
    teamName: user.teamName || user.superior || '系统直属',
    teamGroupId: user.teamGroupId || user.groupId || '',
    groupName: user.groupName || user.teamGroup || '',
    regDays: user.regDays || 1,
    supervisorUsername: user.supervisorUsername || undefined,
    supervisorRealName: user.supervisorRealName || undefined,
    supervisorName: user.supervisorName || undefined,
    isDirect,
    sourceKind: user.sourceKind || undefined,
    ...(includeTrend ? { trend: 'up' as const } : {}),
  };
}

export function transformUsers(users: any[], includeTrend: boolean = false): TransformedUser[] {
  return users.map(user => transformUser(user, includeTrend));
}