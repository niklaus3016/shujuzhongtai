import { ApiResponse } from '../types';

// 根据环境选择合适的 API 地址
const BASE_URLS = ['https://wfqmaepvjkdd.sealoshzh.site/api'];

// 创建默认请求头
function createDefaultHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);
  const token = localStorage.getItem('admin_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');
  return headers;
}

// 创建带超时的fetch请求
function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 30000): Promise<Response> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`请求超时，超过${timeout}ms`));
    }, timeout);
  });
  
  return Promise.race([
    fetch(url, options),
    timeoutPromise
  ]);
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<T> {
  const headers = createDefaultHeaders(options.headers);
  let lastError: Error;
  
  // 尝试不同的Base URL
  for (const baseUrl of BASE_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      }, timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error [${response.status}]:`, errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || errorData.msg || `HTTP ${response.status}`);
        } catch (jsonErr: any) {
          if (jsonErr instanceof SyntaxError) {
            // 不是 JSON 格式，直接用错误文本
            throw new Error(errorText || `HTTP ${response.status}`);
          }
          // 已经是我们抛出的带 message 的 Error，直接透传
          throw jsonErr;
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
