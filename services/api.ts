import { ApiResponse } from '../types';
import { retryFetch } from '../utils/retryFetch';

// 根据环境选择合适的 API 地址
const isProduction = process.env.NODE_ENV === 'production';
const BASE_URLS = isProduction 
  ? ['https://wfqmaepvjkdd.sealoshzh.site/api'] 
  : ['/api'];

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

    let lastError: Error;
    
    // 尝试不同的Base URL
    for (const baseUrl of BASE_URLS) {
      try {
        console.log('开始API请求:', `${baseUrl}${endpoint}`);
        console.log('请求头:', Object.fromEntries(headers.entries()));
        console.log('请求体:', options.body);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers,
        });

        console.log('API响应状态:', response.status);
        console.log('API响应状态文本:', response.statusText);

        if (!response.ok) {
          try {
            const errorText = await response.text();
            console.log('API错误响应:', errorText);
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || `HTTP ${response.status}`);
          } catch (e) {
            throw new Error(`HTTP ${response.status}`);
          }
        }

        const text = await response.text();
        console.log('API响应文本:', text);
        
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error('API返回非JSON格式:', text.substring(0, 200));
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
        console.log(`尝试 ${baseUrl}${endpoint} 失败:`, lastError.message);
      }
    }
    
    // 所有Base URL都失败
    throw lastError!;
  });
}
