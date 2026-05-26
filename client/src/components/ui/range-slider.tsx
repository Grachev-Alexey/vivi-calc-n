import { cn } from "@/lib/utils";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
  showLabels?: boolean;
  formatLabel?: (value: number) => string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  onDragStart,
  onDragEnd,
  className,
  showLabels = true,
  formatLabel,
  disabled = false
}: RangeSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value));
  };

  const handleMouseDown = () => {
    onDragStart?.();
  };

  const handleMouseUp = () => {
    onDragEnd?.();
  };

  const formatValue = (val: number) => {
    if (formatLabel) return formatLabel(val);
    return val.toString();
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      )}
    </div>
  );
}