import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 15,
  colorFrom = "#94A3B8",
  colorTo = "#E2E8F0",
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={{ "--duration": duration, "--delay": `-${delay}s` } as React.CSSProperties}
    >
      {/* The beam element uses motion-path animation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          border: "1px solid transparent",
          background: `conic-gradient(
              from var(--angle, 0deg),
              transparent 70%,
              ${colorFrom} 80%,
              ${colorTo} 90%,
              ${colorFrom} 95%,
              transparent 100%
            ) border-box`,
          WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "destination-out",
          maskComposite: "exclude",
          animation: `spin-border ${duration}s linear ${-delay}s infinite`,
        }}
      />
      <style>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes spin-border {
          to { --angle: 360deg; }
        }
      `}</style>
    </div>
  );
}
