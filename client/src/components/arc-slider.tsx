import { useRef, useCallback, useEffect, useState } from "react";

interface ArcSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
  formatValue?: (value: number) => string;
  step?: number;
}

const START_ANGLE = (135 * Math.PI) / 180;
const TOTAL_ARC = (270 * Math.PI) / 180;

function angleToPoint(angle: number, cx: number, cy: number, r: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = angleToPoint(startAngle, cx, cy, r);
  const end = angleToPoint(endAngle, cx, cy, r);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function ArcSlider({
  min, max, value, onChange, label,
  unit = "", color = "#e879a0", size = 100,
  formatValue, step = 1,
}: ArcSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.085;
  const innerR = r * 0.55;

  const t = max === min ? 0 : (value - min) / (max - min);
  const currentAngle = START_ANGLE + t * TOTAL_ARC;
  const handlePt = angleToPoint(currentAngle, cx, cy, r);

  const getValueFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return value;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const px = (clientX - rect.left) * scaleX - cx;
      const py = (clientY - rect.top) * scaleY - cy;
      let angle = Math.atan2(py, px);
      let norm = angle - START_ANGLE;
      while (norm < 0) norm += 2 * Math.PI;
      while (norm > 2 * Math.PI) norm -= 2 * Math.PI;
      if (norm > TOTAL_ARC + 0.3) norm = norm > Math.PI ? 0 : TOTAL_ARC;
      const clamped = Math.max(0, Math.min(TOTAL_ARC, norm));
      const raw = min + (clamped / TOTAL_ARC) * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [cx, cy, min, max, size, step, value]
  );

  const isNearCenter = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return false;
      const rect = svgRef.current.getBoundingClientRect();
      const px = (clientX - rect.left) * (size / rect.width);
      const py = (clientY - rect.top) * (size / rect.height);
      return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) < innerR;
    },
    [cx, cy, innerR, size]
  );

  const startEditing = useCallback(() => {
    setEditVal(String(value));
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
  }, [value]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const num = parseFloat(editVal.replace(/[^0-9.]/g, ""));
    if (!isNaN(num)) {
      const stepped = Math.round(num / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    }
  }, [editVal, min, max, step, onChange]);

  const onSVGMouseDown = useCallback((e: React.MouseEvent) => {
    if (isNearCenter(e.clientX, e.clientY)) {
      startEditing();
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    onChange(getValueFromPoint(e.clientX, e.clientY));
  }, [isNearCenter, startEditing, getValueFromPoint, onChange]);

  const onSVGTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (isNearCenter(touch.clientX, touch.clientY)) {
      startEditing();
      return;
    }
    isDragging.current = true;
    onChange(getValueFromPoint(touch.clientX, touch.clientY));
  }, [isNearCenter, startEditing, getValueFromPoint, onChange]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      onChange(getValueFromPoint(e.clientX, e.clientY));
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const t = e.touches[0];
      onChange(getValueFromPoint(t.clientX, t.clientY));
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [getValueFromPoint, onChange]);

  const bgPath = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + TOTAL_ARC);
  const valPath = t > 0.001 ? describeArc(cx, cy, r, START_ANGLE, currentAngle) : null;
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className="flex flex-col items-center select-none" style={{ width: size }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          onMouseDown={onSVGMouseDown}
          onTouchStart={onSVGTouchStart}
          style={{ cursor: "pointer", overflow: "visible", display: "block" }}
        >
          <path d={bgPath} fill="none" stroke="#EBEBED" strokeWidth={strokeWidth} strokeLinecap="round" />
          {valPath && (
            <path d={valPath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          )}
          <circle
            cx={handlePt.x} cy={handlePt.y} r={strokeWidth * 0.9}
            fill={color} stroke="white" strokeWidth={2}
            style={{ cursor: "grab", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
          />
          {!editing && (
            <>
              <text
                x={cx} y={cy - size * 0.05}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.2} fontWeight="800" fill="#1D1D1F"
                style={{ cursor: "text" }}
              >
                {displayValue}
              </text>
              {unit && (
                <text
                  x={cx} y={cy + size * 0.14}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={size * 0.1} fill="#8E8E93" fontWeight="500"
                >
                  {unit}
                </text>
              )}
            </>
          )}
          {/* Невидимая зона клика для редактирования */}
          <circle
            cx={cx} cy={cy} r={innerR}
            fill="transparent"
            style={{ cursor: "text" }}
            onMouseDown={e => { e.stopPropagation(); startEditing(); }}
          />
        </svg>

        {/* Поле ввода при редактировании */}
        {editing && (
          <div style={{
            position: "absolute",
            left: "50%", top: "50%",
            transform: "translate(-50%, -52%)",
            width: size * 0.55,
            zIndex: 10,
          }}>
            <input
              ref={inputRef}
              type="number"
              value={editVal}
              min={min} max={max} step={step}
              onChange={e => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: Math.max(12, size * 0.16),
                fontWeight: 800,
                color: "#1D1D1F",
                background: "white",
                border: `2px solid ${color}`,
                borderRadius: 10,
                outline: "none",
                padding: "3px 4px",
                boxShadow: `0 4px 12px ${color}33`,
              }}
            />
          </div>
        )}
      </div>

      <div
        className="text-center font-semibold leading-tight"
        style={{
          fontSize: Math.max(10, size * 0.105),
          maxWidth: size + 8,
          marginTop: -(size * 0.06),
          color: "#6E6E73",
        }}
      >
        {label}
      </div>
    </div>
  );
}
