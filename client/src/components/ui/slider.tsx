import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-slate-100 border border-white/80">
      <SliderPrimitive.Range
        className="absolute h-full rounded-full"
        style={{
          background: "linear-gradient(90deg, #E8D5A3 0%, #C8A96E 100%)",
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-7 w-7 rounded-full bg-white cursor-grab active:cursor-grabbing focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      style={{
        border: "2.5px solid #C8A96E",
        boxShadow: "0 0 0 5px rgba(200,169,110,0.14), 0 4px 20px rgba(200,169,110,0.35), 0 2px 8px rgba(0,0,0,0.1)",
        transition: "box-shadow 0.15s ease",
      }}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
