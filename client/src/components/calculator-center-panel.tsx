import { ArcSlider } from "./arc-slider";
import { formatPrice } from "@/lib/utils";

interface SelectedService {
  id: number;
  yclientsId: number;
  title: string;
  priceMin: string;
  customPrice?: string;
  quantity: number;
  sessionCount: number;
}

interface CalculatorCenterPanelProps {
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
  downPayment: number;
  onDownPaymentChange: (value: number) => void;
  installmentMonths: number;
  onInstallmentMonthsChange: (value: number) => void;
  finalCost: number;
  discountPercent: number;
  maxProcedureCount: number;
  calculatorSettings?: any;
}

const DISCOUNT_STEPS = [
  { threshold: 15, pct: 46, color: "#16a34a", next: null },
  { threshold: 10, pct: 40, color: "#2563eb", next: 15 },
  { threshold: 7,  pct: 35, color: "#7c3aed", next: 10 },
  { threshold: 4,  pct: 30, color: "#ea580c", next: 7  },
  { threshold: 0,  pct: 25, color: "#6b7280", next: 4  },
];

function discountInfo(pct: number, max: number) {
  const step = DISCOUNT_STEPS.find(s => pct === s.pct) ?? DISCOUNT_STEPS[DISCOUNT_STEPS.length - 1];
  const color = step.color;
  const label = step.next === null
    ? "Максимальная скидка"
    : `+${step.next - max} проц → ${DISCOUNT_STEPS.find(s => s.threshold === step.next)?.pct}%`;
  return { color, label };
}

export default function CalculatorCenterPanel({
  selectedServices,
  onServicesChange,
  downPayment,
  onDownPaymentChange,
  installmentMonths,
  onInstallmentMonthsChange,
  finalCost,
  discountPercent,
  maxProcedureCount,
  calculatorSettings,
}: CalculatorCenterPanelProps) {
  const { color, label } = discountInfo(discountPercent, maxProcedureCount);

  const monthlyOptions: number[] = calculatorSettings?.installmentMonthsOptions || [1, 2, 3, 4, 5, 6];
  const minMonths = Math.min(...monthlyOptions);
  const maxMonths = Math.max(...monthlyOptions);

  const minDP = calculatorSettings?.minimumDownPayment || 5000;
  const maxDP = Math.max(minDP, finalCost || minDP);
  const clampedDP = Math.max(minDP, Math.min(downPayment || minDP, maxDP));
  const isFullPayment = finalCost > 0 && clampedDP >= finalCost;
  const remaining = Math.max(0, finalCost - clampedDP);
  const monthly = installmentMonths > 1 && remaining > 0 ? Math.round(remaining / installmentMonths) : 0;

  const updateSessionCount = (yclientsId: number, count: number) =>
    onServicesChange(selectedServices.map(s => s.yclientsId === yclientsId ? { ...s, sessionCount: count } : s));

  if (selectedServices.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-[#AEAEB2] font-medium text-center">Добавьте услуги<br/>для расчёта</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

      {/* Discount indicator — compact pill (unchanged) */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{ background: `${color}10`, border: `1px solid ${color}25` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tabular-nums" style={{ color }}>
            {discountPercent}%
          </span>
          <span className="text-xs font-semibold" style={{ color }}>скидка</span>
        </div>
        <span className="text-[11px] font-medium text-[#6E6E73]">{label}</span>
      </div>

      {/* Two-column layout: left = down payment, right = procedure sliders */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

        {/* Left — Down payment + installment */}
        <div className="bg-white rounded-2xl p-4 flex flex-col" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[11px] font-semibold text-[#AEAEB2] mb-3">Первый взнос</p>

          <div className="flex justify-center">
            <ArcSlider
              min={minDP}
              max={maxDP}
              value={clampedDP}
              onChange={onDownPaymentChange}
              label={isFullPayment ? "Полная 🎉" : "взнос"}
              color="#818cf8"
              size={96}
              step={500}
              formatValue={v => {
                if (v >= 1000000) return (v / 1000000).toFixed(1) + "М";
                if (v >= 1000) return Math.round(v / 1000) + "к";
                return String(v);
              }}
            />
          </div>

          <p className="text-center mt-1 text-sm font-black tabular-nums text-[#1D1D1F]">
            {formatPrice(clampedDP)}
          </p>

          {/* Installment */}
          {!isFullPayment && remaining > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F2F2F7" }}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-[#6E6E73]">Рассрочка</span>
                <span className="text-[11px] font-bold text-[#818cf8]">
                  {installmentMonths} мес.
                </span>
              </div>
              <input
                type="range"
                min={minMonths}
                max={maxMonths}
                step={1}
                value={installmentMonths}
                onChange={e => onInstallmentMonthsChange(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#818cf8" }}
              />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-[#AEAEB2]">{minMonths} мес.</span>
                <span className="text-[10px] text-[#AEAEB2]">{maxMonths} мес.</span>
              </div>
              {monthly > 0 && (
                <p className="text-center mt-2 text-[11px] text-[#6E6E73]">
                  По <span className="font-bold tabular-nums text-[#818cf8]">{formatPrice(monthly)}</span> / мес.
                </p>
              )}
            </div>
          )}

          {isFullPayment && (
            <p className="text-center mt-2 text-[11px] text-[#34C759] font-semibold">
              ✓ Полная оплата
            </p>
          )}
        </div>

        {/* Right — Procedure sliders */}
        <div className="bg-white rounded-2xl p-4 flex flex-col" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[11px] font-semibold text-[#AEAEB2] mb-3">Процедур по зонам</p>
          <div className="flex flex-wrap gap-2 justify-start overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {selectedServices.map(service => (
              <ArcSlider
                key={service.yclientsId}
                min={1}
                max={20}
                value={service.sessionCount || 10}
                onChange={v => updateSessionCount(service.yclientsId, v)}
                label={service.title.length > 12 ? service.title.slice(0, 11) + "…" : service.title}
                unit="сеанс."
                color="#e879a0"
                size={selectedServices.length <= 2 ? 96 : selectedServices.length <= 4 ? 80 : 70}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
