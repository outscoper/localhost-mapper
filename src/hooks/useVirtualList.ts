import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number;
}

interface UseVirtualListResult<T> {
  virtualItems: Array<{ item: T; index: number; style: React.CSSProperties }>;
  containerStyle: React.CSSProperties;
  scrollToIndex: (index: number) => void;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
}

export function useVirtualList<T>(
  items: T[],
  { itemHeight, overscan = 5 }: UseVirtualListOptions
): UseVirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const totalHeight = items.length * itemHeight;

  const virtualItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
    const endIndex = Math.min(items.length, startIndex + visibleCount);

    return items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
      style: {
        position: 'absolute' as const,
        top: (startIndex + i) * itemHeight,
        height: itemHeight,
        left: 0,
        right: 0,
      },
    }));
  }, [items, scrollTop, containerHeight, itemHeight, overscan]);

  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [itemHeight]);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        setContainerHeight(entries[0].contentRect.height);
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return {
    virtualItems,
    containerStyle: { height: totalHeight, position: 'relative' as const },
    scrollToIndex,
    onScroll,
  };
}
