import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';

// Tracks the on-screen rect of ref.current, resyncing on resize/scroll.
// Used to visually overlay VidFeed onto whichever slot is "active"
// without ever unmounting it.
export default function useSyncedRect(ref, isActive) {
  const [rect, setRect] = useState(null);
  const frameRef = useRef(null);

  const measure = useCallback(() => {
    if (!ref?.current) return;
    const r = ref.current.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [ref]);

  // Sync before paint so switching slots never shows a stale-size frame.
  useLayoutEffect(() => {
    if (!isActive) { setRect(null); return; }
    measure();
  }, [ref, isActive, measure]);

  useEffect(() => {
    if (!isActive || !ref?.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true); // capture: catches ancestor scroll too
    frameRef.current = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      cancelAnimationFrame(frameRef.current);
    };
  }, [ref, isActive, measure]);

  return rect;
}