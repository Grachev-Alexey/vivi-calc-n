import { useEffect, useRef } from "react";
import { useInView } from "framer-motion";

interface NumberTickerProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  format?: (n: number) => string;
  duration?: number;
}

export function NumberTicker({ value, className, style, format, duration = 600 }: NumberTickerProps) {
  const ref     = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(value);
  const rafRef  = useRef<number | null>(null);
  const isInView = useInView(ref, { once: false });

  useEffect(() => {
    if (!isInView) return;
    const start = fromRef.current;
    const end   = value;
    if (start === end) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3); // ease-out-cubic
      const current = start + (end - start) * ease;

      if (ref.current) {
        ref.current.textContent = format ? format(current) : Math.round(current).toLocaleString("ru-RU");
      }

      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = end;
        if (ref.current) {
          ref.current.textContent = format ? format(end) : end.toLocaleString("ru-RU");
        }
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, isInView, format, duration]);

  // Initial render
  const initial = format ? format(value) : value.toLocaleString("ru-RU");

  return <span ref={ref} className={className} style={style}>{initial}</span>;
}
