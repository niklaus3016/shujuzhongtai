// 全局缓存管理服务

interface CacheItem {
  data: any;
  timestamp: number;
  cacheTime?: number; // 可选的缓存时间
}

class CacheManager {
  private cache: Map<string, CacheItem> = new Map();
  private static instance: CacheManager;

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @param cacheTime 缓存时间（毫秒），默认5分钟，如果缓存项有自己的时间则优先使用缓存项的时间
   * @returns 缓存数据，如果缓存不存在或已过期则返回null
   */
  public get(key: string, cacheTime: number = 300000): any {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // 使用缓存项自己的时间，如果没有则使用传入的时间
    const effectiveCacheTime = cached.cacheTime || cacheTime;
    
    if (Date.now() - cached.timestamp < effectiveCacheTime) {
      return cached.data;
    }
    
    // 缓存已过期，移除
    this.cache.delete(key);
    return null;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 缓存数据
   * @param cacheTime 可选的缓存时间（毫秒），不设置则默认使用get时传入的时间
   */
  public set(key: string, data: any, cacheTime?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      cacheTime
    });
  }

  /**
   * 清除指定缓存
   * @param key 缓存键
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清除所有缓存
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   * @returns 缓存项数量
   */
  public size(): number {
    return this.cache.size;
  }
}

export const cacheManager = CacheManager.getInstance();