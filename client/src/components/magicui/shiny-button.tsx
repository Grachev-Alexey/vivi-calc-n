import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  shimmerColor?: string;
  background?: string;
}

export function ShinyButton({
  children,
  className,
  shimmerColor = "rgba(255,255,255,0.3)",
  background = "linear-gradient(135deg, #c06080 0%, #9d3060 60%, #7d1a48 100%)",
  style: styleProp,
  ...props
}: ShinyButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full",
        "font-bold text-white select-none cursor-pointer border-none outline-none",
        "h-12 px-7 text-[15px] tracking-[-0.01em]",
        className
      )}
      style={{
        background,
        boxShadow: "0 6px 24px rgba(157,48,96,0.38), 0 2px 8px rgba(157,48,96,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
        ...styleProp,
      }}
      {...props}
    >
      {/* Shine sweep */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(105deg, transparent 20%, ${shimmerColor} 50%, transparent 80%)`,
          backgroundSize: "200% 100%",
          animation: "shine-sweep 3s ease-in-out infinite",
        }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <style>{`
        @keyframes shine-sweep {
          0%   { background-position: 200% center; }
          60%  { background-position: -200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </motion.button>
  );
}
