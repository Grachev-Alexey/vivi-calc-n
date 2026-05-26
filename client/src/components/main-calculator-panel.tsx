import { useState } from "react";
import {
  Gift, Percent, CreditCard, Sparkles, Star, Shield, PlusCircle, Heart,
  Lock, Check, ArrowRight, Minus, Plus, X,
} from "lucide-react";
import { Slider } from "@nextui-org/react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { ShinyButton } from "@/components/magicui/shiny-button";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { formatPrice } from "@/lib/utils";

interface SelectedService {
  id: number; yclientsId: number; title: string;
  priceMin: string; customPrice?: string; quantity: number; sessionCount: number;
}
interface FreeZone { serviceId: number; title: string; pricePerProcedure: number; quantity: number }

interface Props {
  selectedServices: SelectedService[];
  onServicesChange: (s: SelectedService[]) => void;
  freeZones: FreeZone[];
  onAddFreeZone: (zones: FreeZone[]) => void;
  downPayment: number;
  onDownPaymentChange: (v: number) => void;
  installmentMonths: number;
  onInstallmentMonthsChange: (v: number) => void;
  baseCost: number;
  finalCost: number;
  discountPercent: number;
  savings: number;
  maxProcedureCount: number;
  isFullPayment: boolean;
  monthly: number;
  minDP: number;
  maxDP: number;
  correctionPercent?: number;
  calculatorSettings?: any;
  onOrder: () => void;
}

// Discount tiers — based purely on procedure count
function getDiscountPct(proc: number): number {
  if (proc >= 20) return 46;
  if (proc >= 15) return 40;
  if (proc >= 10) return 35;
  if (proc >= 8)  return 30;
  if (proc >= 5)  return 25;
  return 20;
}

/* ── Privileges ─────────────────────────────────────────────────────── */
// dpT = minimum down-payment (₽) to unlock; pMin = minimum procedures needed; fp = full-payment only
const PRIVS = [
  { id: "small_zone",  Icon: Gift,       title: "Малая зона",    desc: "Зона в подарок",        dpT: 2000,  pMin: 0,  fp: false, color: "#818CF8" },
  { id: "bonus50",     Icon: Percent,    title: "Бонус 50%",     desc: "50% взноса на счёт",    dpT: 4000,  pMin: 0,  fp: false, color: "#34D399" },
  { id: "club_card",   Icon: CreditCard, title: "Клубная карта", desc: "Новые зоны −40%",        dpT: 7000,  pMin: 0,  fp: false, color: "#F472B6" },
  { id: "gift_choice", Icon: Sparkles,   title: "Подарок",       desc: "Зона или процедура",    dpT: 10000, pMin: 0,  fp: false, color: "#FBBF24" },
  { id: "priority",    Icon: Star,       title: "Приоритет",     desc: "К личному мастеру",     dpT: 12000, pMin: 0,  fp: false, color: "#60A5FA" },
  { id: "guarantee",   Icon: Shield,     title: "Гарантия",      desc: "Гарантия результата",   dpT: 0,     pMin: 10, fp: false, color: "#A78BFA" },
  { id: "bonus_proc",  Icon: PlusCircle, title: "+3 процедуры",  desc: "При полной оплате",     dpT: 99999, pMin: 0,  fp: true,  color: "#34D399" },
  { id: "friend",      Icon: Heart,      title: "Подруга −50%",  desc: "При полной оплате",     dpT: 99999, pMin: 0,  fp: true,  color: "#F472B6" },
] as const;

/* ── Discount hint ───────────────────────────────────────────────────── */
function getDiscountHint(proc: number): string {
  if (proc >= 20) return "Максимальная скидка 46% — поздравляем!";
  if (proc >= 15) return `Ещё +${20 - proc} зон → 46%`;
  if (proc >= 10) return `Ещё +${15 - proc} зон → 40%`;
  if (proc >= 8)  return `Ещё +${10 - proc} зон → 35%`;
  if (proc >= 5)  return `Ещё +${8 - proc} зон → 30%`;
  if (proc > 0)   return `Ещё +${5 - proc} зон → 25%`;
  return "Добавьте зоны — скидка растёт";
}

/* ── Glass card style ────────────────────────────────────────────────── */
const G: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1.5px rgba(255,255,255,0.16), 0 8px 32px rgba(0,0,0,0.4)",
  borderRadius: 22,
};

/* ── Privilege card ──────────────────────────────────────────────────── */
function PrivCard({ priv, unlocked, pct, missing }: {
  priv: typeof PRIVS[number]; unlocked: boolean; pct: number; missing: string;
}) {
  const { Icon } = priv;
  return (
    <div className="priv-card" style={{
      position: "relative", overflow: "hidden", borderRadius: 14,
      padding: "7px 8px",
      background: unlocked ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)",
      boxShadow: unlocked
        ? `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.35)`
        : "inset 0 0 0 1px rgba(255,255,255,0.12)",
      filter: unlocked ? "none" : "grayscale(0.4)",
      opacity: unlocked ? 1 : 0.72,
      transition: "opacity 0.4s, filter 0.4s, box-shadow 0.4s",
    }}>
      {/* Color blob */}
      <div style={{
        position: "absolute", bottom: -6, right: -6, width: 32, height: 32,
        borderRadius: "50%", background: `${priv.color}30`, filter: "blur(10px)", zIndex: 0,
      }} />

      {/* BorderBeam — only when unlocked */}
      {unlocked && <BorderBeam size={60} duration={14} colorFrom={priv.color} colorTo="transparent" />}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Icon + check */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 7,
            background: unlocked ? `${priv.color}22` : "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: unlocked ? `0 2px 6px ${priv.color}44` : "none",
            transition: "all 0.4s", flexShrink: 0,
          }}>
            <Icon size={11} strokeWidth={1.6} style={{ color: unlocked ? priv.color : "rgba(255,255,255,0.6)" }} />
          </div>
          {unlocked ? (
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#E8678A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(232,103,138,0.4)", flexShrink: 0 }}>
              <Check size={7} strokeWidth={3} color="#fff" />
            </div>
          ) : (
            <Lock size={8} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.55)", marginTop: 1 }} />
          )}
        </div>

        <p className="priv-card-title" style={{ fontSize: 12, fontWeight: 800, color: unlocked ? "#F2F2F7" : "rgba(255,255,255,0.75)", marginBottom: 2, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
          {priv.title}
        </p>
        <p className="priv-card-desc" style={{ fontSize: 10.5, color: unlocked ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.68)", lineHeight: 1.3, marginBottom: 5 }}>
          {priv.desc}
        </p>

        {/* Progress bar */}
        <div style={{ height: 2.5, borderRadius: 99, background: "rgba(255,255,255,0.22)", overflow: "hidden", marginBottom: 4 }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${Math.min(100, pct)}%`,
            background: unlocked ? priv.color : `${priv.color}AA`,
            boxShadow: unlocked ? `0 0 4px ${priv.color}66` : `0 0 3px ${priv.color}44`,
            transition: "width 0.5s ease-out",
          }} />
        </div>

        {unlocked ? (
          <span className="priv-card-status" style={{ fontSize: 10, fontWeight: 800, color: priv.color, letterSpacing: "0.03em" }}>АКТИВНО</span>
        ) : missing ? (
          <span className="priv-card-status" style={{ fontSize: 10, color: "rgba(255,255,255,0.78)", fontWeight: 600, lineHeight: 1.3, display: "block" }}>{missing}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Progress dots on slider ─────────────────────────────────────── */
function TrackMarkers({ min, max, dp }: { min: number; max: number; dp: number }) {
  const range = max - min;
  if (range <= 0) return null;
  return (
    <div style={{ position: "relative", height: 14, marginTop: 3 }}>
      {PRIVS.filter(p => !p.fp && p.dpT > min && p.dpT < max).map(p => {
        const pct = ((p.dpT - min) / range) * 100;
        const ok  = dp >= p.dpT;
        return (
          <div key={p.id} style={{ position: "absolute", left: `${pct}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <div style={{ width: 1, height: 4, background: ok ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: ok ? p.color : "rgba(255,255,255,0.12)", boxShadow: ok ? `0 0 6px ${p.color}88` : "none", transition: "all 0.3s" }} />
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/* ── Continuous discount progress (0-100) ───────────────────────────── */
// Tiers: 20%→0, 25%→20, 30%→40, 35%→60, 40%→80, 46%→100
function getBarProgress(proc: number): number {
  if (proc >= 20) return 100;
  if (proc >= 15) return 80 + Math.min(1, (proc - 15) / 5) * 20;
  if (proc >= 10) return 60 + Math.min(1, (proc - 10) / 5) * 20;
  if (proc >= 8)  return 40 + Math.min(1, (proc - 8)  / 2) * 20;
  if (proc >= 5)  return 20 + Math.min(1, (proc - 5)  / 3) * 20;
  if (proc >= 1)  return Math.min(1, proc / 5) * 20;
  return 0;
}

export default function MainCalculatorPanel({
  selectedServices, onServicesChange, freeZones, onAddFreeZone,
  downPayment, onDownPaymentChange, installmentMonths, onInstallmentMonthsChange,
  baseCost, finalCost, discountPercent, savings,
  maxProcedureCount, isFullPayment, monthly,
  minDP, maxDP, correctionPercent = 0, calculatorSettings, onOrder,
}: Props) {
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [tempPrice, setTempPrice]       = useState("");
  const [dragDP,    setDragDP]          = useState<number | null>(null);
  const [editingDP, setEditingDP]       = useState(false);
  const [tempDP,    setTempDP]          = useState("");
  const [giftChoice, setGiftChoice]     = useState<"zone" | "procedure" | null>(null);

  // During drag: use local dragDP. At rest: use committed parent value.
  // This single rule eliminates all feedback-loop oscillation.
  const sliderVal  = dragDP !== null ? dragDP : downPayment;
  const isDragging = dragDP !== null;

  // Discount depends only on procedure count, not down-payment.
  const liveDiscountPct = Math.min(getDiscountPct(maxProcedureCount) + correctionPercent, 99);

  // maxDP is the EXACT finalCost (not rounded), so the slider's step=100 may
  // not reach it precisely. We treat "within 100₽ of maxDP" as full payment.
  const isFullPayLive = maxDP > 0 && sliderVal >= maxDP - 100;

  // When full payment: show finalCost (the actual subscription cost), NOT maxDP.
  // maxDP can exceed finalCost in the 46% paradox case (e.g., maxDP=20000 but
  // finalCost=18468). The slider thumb is at maxDP (right edge), but the
  // displayed/committed amount is finalCost so the client never "over-pays".
  const displayDP = isFullPayLive ? finalCost : sliderVal;

  const monthOpts: number[] = calculatorSettings?.installmentMonthsOptions ?? [1, 2, 3, 4, 5, 6];
  const range = maxDP - minDP;

  // Full payment unlocks ALL privileges; otherwise check dp threshold + proc min
  const unlocked = (p: typeof PRIVS[number]) =>
    isFullPayLive || (!p.fp && sliderVal >= p.dpT && (!p.pMin || maxProcedureCount >= p.pMin));

  const nextLocked = PRIVS.find(p => !unlocked(p));
  const toNext = nextLocked && !nextLocked.fp && nextLocked.dpT < 99999
    ? Math.max(0, nextLocked.dpT - displayDP) : 0;

  const changeSessions = (id: number, v: number) =>
    onServicesChange(selectedServices.map(s => s.yclientsId === id ? { ...s, sessionCount: v } : s));
  const removeService = (id: number) =>
    onServicesChange(selectedServices.filter(s => s.yclientsId !== id));
  const toggleFreeZone = (svc: SelectedService) => {
    const already = freeZones.some(z => z.serviceId === svc.yclientsId);
    if (already) { onAddFreeZone(freeZones.filter(z => z.serviceId !== svc.yclientsId)); }
    else { onAddFreeZone([...freeZones, { serviceId: svc.yclientsId, title: svc.title, pricePerProcedure: parseFloat(svc.customPrice || svc.priceMin), quantity: 1 }]); }
  };
  const startEdit = (id: number, price: string) => { setEditingPrice(id); setTempPrice(Math.round(parseFloat(price)).toString()); };
  const saveEdit  = (id: number) => { onServicesChange(selectedServices.map(s => s.yclientsId === id ? { ...s, customPrice: tempPrice } : s)); setEditingPrice(null); };
  const getPrice  = (s: SelectedService) => s.customPrice || s.priceMin;

  /* ── EMPTY ── */
  if (selectedServices.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div style={{ width: 56, height: 56, borderRadius: 20, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={26} strokeWidth={1.2} style={{ color: "rgba(255,255,255,0.2)" }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "-0.02em" }}>Выберите зоны слева</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", maxWidth: 200 }}>Используйте поиск чтобы добавить зоны в абонемент</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2.5 calc-panel" style={{ minHeight: 0 }}>

      {/* ══ CONFIGURATOR ══════════════════════════════════════════════ */}
      <div style={{ ...G, padding: "14px 16px", flexShrink: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.12em" }}>Конфигуратор</p>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#AEAEB2", background: "rgba(255,255,255,0.09)", borderRadius: 20, padding: "2px 8px" }}>
            {selectedServices.length} {selectedServices.length === 1 ? "зона" : "зоны"}
          </span>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>

          {/* ── LEFT: Down payment + installment ────────────────────── */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Первый взнос</p>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {editingDP ? (
                <input
                  autoFocus
                  type="number"
                  value={tempDP}
                  onChange={e => setTempDP(e.target.value)}
                  onBlur={() => {
                    const parsed = Math.round(Number(tempDP));
                    if (!isNaN(parsed) && parsed > 0) {
                      const clamped = Math.max(minDP, Math.min(parsed, maxDP));
                      onDownPaymentChange(clamped);
                    }
                    setEditingDP(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingDP(false);
                  }}
                  style={{
                    fontSize: 22, fontWeight: 900, color: "#F2F2F7", letterSpacing: "-0.04em",
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(232,103,138,0.5)",
                    borderRadius: 10, padding: "2px 8px", width: 130, outline: "none",
                  }}
                />
              ) : (
                <span
                  title="Нажмите для ввода суммы вручную"
                  onClick={() => { setTempDP(String(displayDP)); setEditingDP(true); }}
                  style={{ fontSize: 24, fontWeight: 900, color: "#F2F2F7", letterSpacing: "-0.04em", lineHeight: 1, cursor: "text" }}
                >
                  {formatPrice(displayDP)}
                </span>
              )}
              {!editingDP && toNext > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "#AEAEB2", background: "rgba(255,255,255,0.09)", borderRadius: 20, padding: "2px 7px" }}>
                  +{formatPrice(toNext)} → {nextLocked?.title}
                </span>
              )}
            </div>

            {/* NextUI Slider */}
            {range > 0 && (
              <>
                <Slider size="sm" step={100} minValue={minDP} maxValue={maxDP} value={sliderVal}
                  onChange={v => { setDragDP(typeof v === "number" ? v : v[0]); }}
                  onChangeEnd={v => {
                    const val = typeof v === "number" ? v : v[0];
                    setDragDP(null);
                    const committed = maxDP > 0 && val >= maxDP - 100 ? maxDP : val;
                    onDownPaymentChange(committed);
                  }}
                  aria-label="Первый взнос"
                  classNames={{
                    base: "w-full",
                    track: "h-1.5 rounded-full bg-white/10",
                    filler: "rounded-full bg-gradient-to-r from-rose-500 to-pink-400",
                    thumb: "w-4 h-4 bg-white shadow-[0_2px_10px_rgba(232,103,138,0.5)] border-2 border-rose-400 data-[dragging=true]:scale-125 transition-transform after:bg-rose-400 after:w-1.5 after:h-1.5",
                  }}
                />
                <TrackMarkers min={minDP} max={maxDP} dp={sliderVal} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 500 }}>{formatPrice(minDP)}</span>
                  <span style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 500 }}>{formatPrice(maxDP)}</span>
                </div>
              </>
            )}

            {/* Installment pills */}
            {!isFullPayment && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Рассрочка</p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {monthOpts.map(m => {
                    const active = installmentMonths === m;
                    return (
                      <button key={m} onClick={() => onInstallmentMonthsChange(m)} style={{
                        padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                        fontSize: 11, fontWeight: active ? 800 : 600,
                        background: active ? "rgba(232,103,138,0.2)" : "rgba(255,255,255,0.08)",
                        color: active ? "#E8678A" : "#AEAEB2",
                        boxShadow: active ? "inset 0 0 0 1.5px rgba(232,103,138,0.5)" : "inset 0 0 0 1px rgba(255,255,255,0.15)",
                        border: "none", transition: "all 0.15s",
                      }}>{m} мес</button>
                    );
                  })}
                </div>
              </div>
            )}

            {isFullPayment && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "rgba(232,103,138,0.12)", borderRadius: 14, padding: "5px 10px", boxShadow: "inset 0 0 0 1px rgba(232,103,138,0.25)" }}>
                <Check size={11} strokeWidth={2.5} style={{ color: "#E8678A", flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E8678A" }}>Полная оплата — максимум привилегий</span>
              </div>
            )}
          </div>

          {/* ── RIGHT: Zone rows ─────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>Процедуры</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", scrollbarWidth: "none" }}>
            {selectedServices.map(svc => {
              const isFree = freeZones.some(z => z.serviceId === svc.yclientsId);
              const price  = parseFloat(getPrice(svc));
              return (
                <div key={svc.yclientsId} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: isFree ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                  borderRadius: 12, padding: "6px 8px",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
                  opacity: isFree ? 0.7 : 1, transition: "opacity 0.2s",
                }}>
                  {/* Gift toggle */}
                  <button onClick={() => toggleFreeZone(svc)}
                    title={isFree ? "Убрать из подарков" : "Сделать зону подарком"}
                    style={{
                      width: 20, height: 20, borderRadius: 6, border: "none", flexShrink: 0,
                      background: isFree ? "rgba(232,103,138,0.2)" : "rgba(255,255,255,0.08)",
                      color: isFree ? "#E8678A" : "rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                    onMouseLeave={e => (e.currentTarget.style.background = isFree ? "rgba(232,103,138,0.2)" : "rgba(255,255,255,0.08)")}
                  ><Gift size={9} strokeWidth={2} /></button>

                  {/* Name + price */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, color: "#F2F2F7",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      textDecoration: isFree ? "line-through" : "none", marginBottom: 1,
                    }}>{svc.title}</p>

                    {editingPrice === svc.yclientsId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <input type="number" value={tempPrice} onChange={e => setTempPrice(e.target.value)}
                          autoFocus onFocus={e => e.target.select()} onBlur={() => saveEdit(svc.yclientsId)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(svc.yclientsId); if (e.key === "Escape") setEditingPrice(null); }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 56, height: 16, fontSize: 10, textAlign: "center", borderRadius: 5, border: "1.5px solid rgba(232,103,138,0.4)", background: "rgba(255,255,255,0.08)", outline: "none", color: "#F2F2F7", padding: "0 3px" }}
                        />
                        <span style={{ fontSize: 10, color: "#AEAEB2" }}>₽</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, color: "#AEAEB2", cursor: "pointer", fontWeight: 500 }}
                        onClick={() => !isFree && startEdit(svc.yclientsId, getPrice(svc))}
                        title="Нажмите для изменения цены"
                      >
                        {price.toLocaleString("ru-RU")} ₽ × {svc.sessionCount || 10}
                      </span>
                    )}
                  </div>

                  {/* Session stepper */}
                  <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    <button onClick={() => changeSessions(svc.yclientsId, Math.max(1, (svc.sessionCount || 10) - 1))}
                      style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)", border: "none", color: "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Minus size={8} strokeWidth={2.5} /></button>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#F2F2F7", width: 20, textAlign: "center" }}>{svc.sessionCount || 10}</span>
                    <button onClick={() => changeSessions(svc.yclientsId, Math.min(30, (svc.sessionCount || 10) + 1))}
                      style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)", border: "none", color: "#8E8E93", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      <Plus size={8} strokeWidth={2.5} /></button>
                  </div>

                  {/* Remove */}
                  <button onClick={() => removeService(svc.yclientsId)}
                    style={{ width: 16, height: 16, borderRadius: 5, border: "none", background: "transparent", color: "rgba(255,255,255,0.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.15)")}
                  ><X size={9} strokeWidth={2} /></button>
                </div>
              );
            })}
            </div>{/* end scrollable zone list */}
          </div>{/* end RIGHT column */}

        </div>{/* end two-column grid */}
      </div>{/* end CONFIGURATOR card */}

      {/* ══ PRIVILEGES ═══════════════════════════════════════════════ */}
      <div className="calc-priv-section" style={{ ...G, padding: "12px 14px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

        {/* ── Discount header strip ─────────────────────────────────── */}
        <div style={{ flexShrink: 0, marginBottom: 8 }}>
          {/* Row: label + count dots */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.12em" }}>Привилегии</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#E8678A" }}>{PRIVS.filter(p => unlocked(p)).length}/{PRIVS.length}</span>
              <div style={{ display: "flex", gap: 2 }}>
                {PRIVS.map(p => (
                  <div key={p.id} style={{ width: 16, height: 3, borderRadius: 99, transition: "background 0.35s", background: unlocked(p) ? "#E8678A" : "rgba(255,255,255,0.14)" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Discount block */}
          <div style={{
            padding: "10px 12px", borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            {/* Top row: big % + tier pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {/* Big discount */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{
                  fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em",
                  background: "linear-gradient(135deg, #E8678A 30%, #FBBF24 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  transition: "all 0.4s ease",
                }}>{liveDiscountPct}</span>
                <span style={{
                  fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em",
                  background: "linear-gradient(135deg, #E8678A 30%, #FBBF24 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>%</span>
              </div>

              {/* Vertical divider */}
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

              {/* Tier pills */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
                {([
                  { pct: 20, label: "20%" },
                  { pct: 25, label: "25%" },
                  { pct: 30, label: "30%" },
                  { pct: 35, label: "35%" },
                  { pct: 40, label: "40%" },
                  { pct: 46, label: "46%" },
                ] as const).map(t => {
                  const active = liveDiscountPct === t.pct;
                  const passed = liveDiscountPct > t.pct;
                  return (
                    <div key={t.pct} style={{
                      padding: "3px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: active
                        ? "linear-gradient(135deg, rgba(232,103,138,0.3), rgba(251,191,36,0.15))"
                        : passed
                          ? "rgba(232,103,138,0.12)"
                          : "rgba(255,255,255,0.06)",
                      boxShadow: active
                        ? "inset 0 0 0 1px rgba(232,103,138,0.5)"
                        : passed
                          ? "inset 0 0 0 1px rgba(232,103,138,0.2)"
                          : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                      color: active ? "#FBBF24" : passed ? "#E8678A" : "rgba(255,255,255,0.3)",
                      transition: "all 0.35s ease",
                    }}>{t.label}</div>
                  );
                })}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${getBarProgress(maxProcedureCount)}%`,
                background: "linear-gradient(90deg, #E8678A 0%, #FBBF24 100%)",
                boxShadow: "0 0 6px rgba(232,103,138,0.5)",
                transition: dragDP !== null ? "none" : "width 0.55s cubic-bezier(0.34,1.2,0.64,1)",
              }} />
            </div>

            {/* Hint */}
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.35, margin: 0 }}>
              {getDiscountHint(maxProcedureCount)}
            </p>
          </div>
        </div>

        {/* ── All 8 privilege cards ──────────────────────────────────── */}
        <div className="priv-grid" style={{ gap: 7, overflowY: "auto", scrollbarWidth: "none", flex: 1, alignContent: "start" }}>
          {PRIVS.map(p => {
            const ok  = unlocked(p);
            const dpPct = p.dpT >= 99999
              ? 0
              : (sliderVal >= p.dpT || p.dpT <= minDP)
                ? 100
                : range > 0
                  ? Math.max(0, Math.min(99, ((sliderVal - minDP) / (p.dpT - minDP)) * 100))
                  : 0;
            const procPct = p.pMin > 0
              ? Math.min(100, Math.round((maxProcedureCount / p.pMin) * 100))
              : 100;
            const pct = p.fp
              ? (isFullPayLive ? 100 : 0)
              : Math.min(dpPct, procPct);
            const missing = p.fp ? (isFullPayment ? "" : "Полная оплата")
              : p.pMin > 0 && maxProcedureCount < p.pMin ? `Нужно ${p.pMin}+ сеансов`
              : sliderVal < p.dpT && p.dpT < 99999 ? `Ещё ${formatPrice(p.dpT - sliderVal)}` : "";

            // Special interactive card for gift_choice
            if (p.id === "gift_choice") {
              return (
                <div key={p.id} className="priv-card" style={{
                  position: "relative", overflow: "hidden", borderRadius: 14,
                  padding: "7px 8px",
                  background: ok ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)",
                  boxShadow: ok
                    ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.35)"
                    : "inset 0 0 0 1px rgba(255,255,255,0.12)",
                  filter: ok ? "none" : "grayscale(0.4)",
                  opacity: ok ? 1 : 0.72,
                  transition: "opacity 0.4s, filter 0.4s",
                }}>
                  <div style={{ position: "absolute", bottom: -6, right: -6, width: 32, height: 32, borderRadius: "50%", background: `${p.color}30`, filter: "blur(10px)", zIndex: 0 }} />
                  {ok && <BorderBeam size={80} duration={14} colorFrom={p.color} colorTo="transparent" />}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: ok ? `${p.color}22` : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ok ? `0 2px 6px ${p.color}44` : "none" }}>
                        <Sparkles size={11} strokeWidth={1.6} style={{ color: ok ? p.color : "rgba(255,255,255,0.4)" }} />
                      </div>
                      {ok ? (
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#E8678A", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(232,103,138,0.4)" }}>
                          <Check size={7} strokeWidth={3} color="#fff" />
                        </div>
                      ) : (
                        <Lock size={8} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.35)", marginTop: 1 }} />
                      )}
                    </div>

                    <p className="priv-card-title" style={{ fontSize: 12, fontWeight: 800, color: ok ? "#F2F2F7" : "rgba(255,255,255,0.75)", marginBottom: 2, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                      Подарок
                    </p>
                    <p className="priv-card-desc" style={{ fontSize: 10.5, color: ok ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.68)", lineHeight: 1.3, marginBottom: ok ? 4 : 5 }}>
                      {ok && giftChoice === "zone" ? "Зона в подарок" : ok && giftChoice === "procedure" ? "1 процедура" : "Зона / процедура"}
                    </p>

                    {ok ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {[
                          { val: "zone" as const, label: "Зона" },
                          { val: "procedure" as const, label: "Процедура" },
                        ].map(opt => {
                          const sel = giftChoice === opt.val;
                          return (
                            <button key={opt.val} onClick={() => setGiftChoice(sel ? null : opt.val)} style={{
                              padding: "3px 6px", borderRadius: 7, cursor: "pointer", textAlign: "left", border: "none",
                              background: sel ? `${p.color}22` : "rgba(255,255,255,0.07)",
                              boxShadow: sel ? `inset 0 0 0 1.5px ${p.color}66` : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                              transition: "all 0.2s",
                            }}>
                              <p style={{ fontSize: 10, fontWeight: 800, color: sel ? p.color : "#F2F2F7", lineHeight: 1.2 }}>{opt.label}</p>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <div style={{ height: 2.5, borderRadius: 99, background: "rgba(255,255,255,0.22)", overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", borderRadius: 99, width: `${Math.min(100, pct)}%`, background: `${p.color}AA`, transition: "width 0.5s ease-out" }} />
                        </div>
                        <span className="priv-card-status" style={{ fontSize: 10, color: "rgba(255,255,255,0.78)", fontWeight: 600, lineHeight: 1.3, display: "block" }}>{missing}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            return <PrivCard key={p.id} priv={p} unlocked={ok} pct={pct} missing={missing} />;
          })}
        </div>
      </div>

      {/* ══ BOTTOM BAR ═══════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        background: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.13), inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)",
        borderRadius: 22,
        padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
            <NumberTicker value={finalCost} format={n => formatPrice(Math.round(n))}
              style={{ fontSize: 42, fontWeight: 900, color: "#F2F2F7", letterSpacing: "-0.05em", lineHeight: 1 }} />
            {savings > 0 && (
              <span style={{ fontSize: 17, fontWeight: 500, color: "#8E8E93", textDecoration: "line-through" }}>
                {formatPrice(baseCost)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {savings > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(232,103,138,0.15)", boxShadow: "inset 0 0 0 1px rgba(232,103,138,0.3)", borderRadius: 20, padding: "3px 10px" }}>
                <span style={{ fontSize: 11, color: "#E8678A", fontWeight: 600 }}>Выгода</span>
                <NumberTicker value={savings} format={n => formatPrice(Math.round(n))}
                  style={{ fontSize: 12, fontWeight: 900, color: "#E8678A" }} />
              </div>
            )}
            {!isFullPayment && monthly > 0 && (
              <span style={{ fontSize: 12, color: "#AEAEB2", fontWeight: 500 }}>
                · <b style={{ color: "#C7C7CC", fontWeight: 800 }}>{formatPrice(monthly)}</b>/мес
                {installmentMonths > 1 && <span style={{ color: "#AEAEB2" }}> × {installmentMonths}</span>}
              </span>
            )}
          </div>
        </div>
        <ShinyButton onClick={onOrder} style={{ flexShrink: 0 }}>
          Оформить <ArrowRight size={14} strokeWidth={2.2} />
        </ShinyButton>
      </div>
    </div>
  );
}
