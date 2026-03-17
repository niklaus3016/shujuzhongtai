import { useEffect, useRef, useCallback } from 'react';

interface SwipeBackOptions {
  onBack: () => void;
  threshold?: number; // 滑动阈值，默认100px
  edgeWidth?: number; // 边缘触发宽度，默认50px
}

export const useSwipeBack = ({ onBack, threshold = 100, edgeWidth = 50 }: SwipeBackOptions) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean>(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // 只响应从屏幕左侧边缘开始的滑动
    if (touch.clientX <= edgeWidth) {
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      isHorizontalSwipe.current = false;
    }
  }, [edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // 判断是否为水平滑动（水平位移大于垂直位移）
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
      isHorizontalSwipe.current = true;
      // 可以在这里添加视觉反馈，比如页面跟随手指移动
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;

    // 如果是水平滑动且滑动距离超过阈值，触发返回
    if (isHorizontalSwipe.current && deltaX > threshold) {
      onBack();
    }

    // 重置状态
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = false;
  }, [onBack, threshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // 添加触摸事件监听
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
};

export default useSwipeBack;
