import { ApiResponse } from '../types';
import { retryFetch } from '../utils/retryFetch';

const BASE_URL = 'https://wfqmaepvjkdd.sealoshzh.site/api/admin';

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return retryFetch(async () => {
    const token = localStorage.getItem('admin_token');
    
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('API返回非JSON格式:', text.substring(0, 200));
      throw new Error('服务器返回格式错误，请检查网络或联系管理员');
    }

    if (!result.success) {
      throw new Error(result.message || '请求失败');
    }

    if (result.data !== undefined) {
      return result.data;
    }
    
    const { success, ...rest } = result;
    return rest as T;
  });
}
