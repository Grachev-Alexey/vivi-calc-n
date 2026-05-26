import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AuroraBackground({ children, className, style }: AuroraBackgroundProps) {
  return (
    <div className={cn("relative flex flex-col", className)} style={{ background: "#0B0B0F", ...style }}>
      {/* Subtle depth layer — not distracting, just alive */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        {/* Top-left: faint indigo */}
        <div style={{
          position: "absolute", width: "55%", height: "60%",
          top: "-15%", left: "-10%",
          background: "radial-gradient(ellipse at center, rgba(90,60,180,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        {/* Bottom-right: faint rose */}
        <div style={{
          position: "absolute", width: "50%", height: "55%",
          bottom: "-15%", right: "-10%",
          background: "radial-gradient(ellipse at center, rgba(180,60,100,0.14) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        {/* Center: very faint highlight */}
        <div style={{
          position: "absolute", width: "40%", height: "35%",
          top: "30%", left: "30%",
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.015) 0%, transparent 80%)",
          filter: "blur(40px)",
        }} />
      </div>
      {children}
    </div>
  );
}
