import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 8, className }: MeteorsProps) {
  const [meteors, setMeteors] = useState<{ id: number; top: string; left: string; delay: string; dur: string }[]>([]);

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        top: `${Math.floor(Math.random() * 100)}%`,
        left: `${Math.floor(Math.random() * 100)}%`,
        delay: `${(Math.random() * 3).toFixed(2)}s`,
        dur: `${(1.5 + Math.random() * 2).toFixed(2)}s`,
      }))
    );
  }, [number]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      {meteors.map((m) => (
        <span
          key={m.id}
          style={{
            position: "absolute",
            top: m.top,
            left: m.left,
            width: 1,
            height: 40,
            transform: "rotate(-45deg)",
            background: "linear-gradient(to bottom, rgba(148,163,184,0.55), transparent)",
            borderRadius: 9999,
            animationDelay: m.delay,
            animationDuration: m.dur,
            opacity: 0,
            animation: `meteor ${m.dur} ${m.delay} ease-in infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes meteor {
          0%   { opacity: 0; transform: rotate(-45deg) translateX(0); }
          10%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(-45deg) translateX(120px); }
        }
      `}</style>
    </div>
  );
}
