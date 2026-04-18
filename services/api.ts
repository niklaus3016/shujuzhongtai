import { ApiResponse } from '../types';

// 根据环境选择合适的 API 地址
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URLS = isProduction 
  ? ['https://wfqmaepvjkdd.sealoshzh.site/api'] 
  : ['/api'];

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('admin_token');
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  let lastError: Error;
  
  // 尝试不同的Base URL
  for (const baseUrl of BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || `HTTP ${response.status}`);
        } catch (e) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      const text = await response.text();
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error('服务器返回格式错误，请检查网络或联系管理员');
      }

      // 检查是否有success字段
      if ('success' in result && !result.success) {
        throw new Error(result.message || '请求失败');
      }

      // 检查是否有data字段
      if (result.data !== undefined) {
        return result.data;
      }
      
      // 如果没有success和data字段，直接返回整个结果
      return result as T;
    } catch (error) {
      lastError = error as Error;
    }
  }
  
  // 所有Base URL都失败
  throw lastError!;
}
