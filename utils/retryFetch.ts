interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 1,
  baseDelay: 500
};

export async function retryFetch<T>(
  fetchFn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { maxRetries, baseDelay } = { ...defaultRetryOptions, ...options };
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`请求失败，${delay}ms 后进行第 ${i + 1} 次重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<Response> {
  return retryFetch(async () => {
    const response = await fetch(url, options);
    
    if (!response.ok && response.status !== 401 && response.status !== 403) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response;
  }, retryOptions);
}

export function isRetryableError(error: any): boolean {
  if (!error) return true;
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  if (error.status === 0 || error.status >= 500) {
    return true;
  }
  
  return false;
}
