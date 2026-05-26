import { useState, useMemo } from "react";
import { BarChart3, X } from "lucide-react";
import { Switch as NextSwitch } from "@nextui-org/react";
import { useCalculator } from "@/hooks/use-calculator";
import { formatPrice } from "@/lib/utils";
import { AuroraBackground } from "@/components/magicui/aurora-background";
import ServiceSelector from "@/components/service-selector";
import ClientModal from "@/components/client-modal";
import MasterSalesModal from "@/components/master-sales-modal";
import MainCalculatorPanel from "@/components/main-calculator-panel";

interface User { id: number; name: string; role: "master" | "admin" }
interface Props { user: User; onLogout: () => void }

// Discount tiers — based purely on procedure count
function getDiscountPct(proc: number): number {
  if (proc >= 20) return 46;
  if (proc >= 15) return 40;
  if (proc >= 10) return 35;
  if (proc >= 8)  return 30;
  if (proc >= 5)  return 25;
  return 20;
}

// Slider maximum = finalCost at the best available discount tier for given proc count.
// Since discount no longer depends on dp, this is simply finalCost.
function computeTrueMaxDP(
  baseCost: number, maxProc: number, corrPct: number, certAmt: number, globalMin: number,
): number {
  if (baseCost <= 0) return globalMin;
  const bestPct = getDiscountPct(maxProc);
  const fc = Math.max(0, Math.round(baseCost * (1 - Math.min(bestPct + corrPct, 99) / 100)) - certAmt);
  return fc > 0 ? fc : globalMin;
}

/* Glass panel */
const GLASS: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px) saturate(160%)",
  WebkitBackdropFilter: "blur(24px) saturate(160%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1.5px rgba(255,255,255,0.16), 0 8px 32px rgba(0,0,0,0.4)",
  borderRadius: 22,
};

export default function PromoCalculatorPage({ user, onLogout }: Props) {
  const [showClient,       setShowClient]       = useState(false);
  const [showSales,        setShowSales]        = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [tempPrice,        setTempPrice]        = useState("");

  const {
    selectedServices, downPayment, installmentMonths,
    usedCertificate, freeZones, calculation, calculatorSettings,
    correctionPercent, manualGiftSessions, handleSessionCountChange,
    setSelectedServices, setDownPayment, setInstallmentMonths,
    setUsedCertificate, setFreeZones, setCorrectionPercent,
  } = useCalculator();

  function toggleFreeZone(svc: typeof selectedServices[number]) {
    const already = freeZones.some(z => z.serviceId === svc.yclientsId);
    if (already) {
      setFreeZones(freeZones.filter(z => z.serviceId !== svc.yclientsId));
    } else {
      setFreeZones([...freeZones, {
        serviceId: svc.yclientsId, title: svc.title,
        pricePerProcedure: Number(svc.customPrice || svc.priceMin),
        quantity: svc.quantity,
      }]);
    }
  }
  function removeService(id: number) {
    const svc = selectedServices.find(s => s.id === id);
    setSelectedServices(selectedServices.filter(s => s.id !== id));
    if (svc) setFreeZones(freeZones.filter(z => z.serviceId !== svc.yclientsId));
  }
  function startEdit(svc: typeof selectedServices[number]) {
    setEditingServiceId(svc.id);
    setTempPrice(String(svc.customPrice || svc.priceMin));
  }
  function saveEdit(svc: typeof selectedServices[number]) {
    const parsed = parseInt(tempPrice.replace(/\D/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedServices(selectedServices.map(s =>
        s.id === svc.id ? { ...s, customPrice: String(parsed) } : s
      ));
    }
    setEditingServiceId(null);
  }

  const maxProc = useMemo(
    () => selectedServices.length > 0 ? Math.max(...selectedServices.map(s => s.sessionCount || 10)) : 0,
    [selectedServices]
  );

  const baseCost   = calculation?.baseCost || 0;
  const globalMin  = calculatorSettings?.minimumDownPayment || 8000;
  const basePct    = getDiscountPct(maxProc);
  const totalDisc  = Math.min(basePct + (correctionPercent || 0), 99);
  const certAmt    = usedCertificate ? (calculatorSettings?.certificateDiscountAmount || 3000) : 0;
  const finalCost  = baseCost > 0 ? Math.max(0, Math.round(baseCost * (1 - totalDisc / 100)) - certAmt) : 0;
  const savings    = baseCost > 0 ? baseCost - finalCost : 0;
  const trueMaxDP  = baseCost > 0 ? computeTrueMaxDP(baseCost, maxProc, correctionPercent || 0, certAmt, globalMin) : globalMin;
  // Default down payment: 8000 if finalCost allows, otherwise half of finalCost
  const defaultDP  = finalCost >= globalMin
    ? globalMin
    : finalCost > 0 ? Math.max(1000, Math.floor(finalCost / 2 / 100) * 100) : 0;
  const rawDP      = downPayment > 0 ? downPayment : defaultDP;
  // When finalCost >= 8000: slider starts at 8000 (defaultDP), goes to finalCost.
  // When finalCost < 8000: slider starts at 1000 so the thumb lands visually near
  // the centre of the track (defaultDP = finalCost/2 ≈ midpoint of [1000, finalCost]).
  const maxDP      = trueMaxDP;
  const minDP      = finalCost > 0 && finalCost < globalMin
    ? Math.min(1000, trueMaxDP)
    : trueMaxDP <= defaultDP ? trueMaxDP : defaultDP;
  // isFullPay: did the user commit enough to cover the ACTUAL cost at their tier?
  const isFullPay  = finalCost > 0 && rawDP >= finalCost;
  // effDP: cap at finalCost when in full-payment mode to prevent "overpayment"
  // in the paradox case (46% tier where maxDP=20000 > finalCost=18468).
  // For the slider position we pass maxDP separately, so the thumb stays at the
  // right edge even when effDP < maxDP.
  const effDP      = finalCost > 0 ? (isFullPay ? finalCost : Math.max(minDP, Math.min(rawDP, maxDP))) : 0;
  const remaining  = Math.max(0, finalCost - effDP);
  const monthly    = remaining > 0 ? Math.round(remaining / installmentMonths) : 0;

  const adaptedCalc = calculation ? {
    ...calculation,
    packages: {
      ...(calculation.packages || {}),
      custom: {
        isAvailable: true, unavailableReason: "",
        finalCost, totalSavings: savings, monthlyPayment: monthly,
        appliedDiscounts: [{ type: "procedure_count_discount", amount: savings }],
      },
    },
  } : null;

  return (
    <AuroraBackground className="calc-bg"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif", position: "relative" }}
    >
      <div className="calc-outer" style={{ position: "relative", zIndex: 1 }}>

        {/* Ghost controls */}
        <div style={{ position: "absolute", top: 14, right: 14, zIndex: 100, display: "flex", gap: 6 }}>
          {[
            { Icon: BarChart3, action: () => setShowSales(true), title: "Продажи" },
            { Icon: X,         action: onLogout,                  title: "Выйти" },
          ].map(({ Icon, action, title }, i) => (
            <button key={i} onClick={action} title={title} style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            ><Icon size={13} strokeWidth={1.5} /></button>
          ))}
        </div>

        {/* ═══ LEFT — catalog + settings ══════════════════════════════ */}
        <div className="calc-left">
          {/* Catalog */}
          <div style={{ ...GLASS, padding: "13px", flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Каталог зон</p>
            <ServiceSelector
              selectedServices={selectedServices}
              onServicesChange={setSelectedServices}
              onAddFreeZone={setFreeZones}
              freeZones={freeZones}
              onSessionCountChange={handleSessionCountChange}
              calculatorSettings={calculatorSettings}
              hideSelectedList
            />

            {/* Selected zones list */}
            {selectedServices.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
                  Выбрано зон: <span style={{ color: "#F2F2F7" }}>{selectedServices.length}</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", scrollbarWidth: "none" }}>
                  {selectedServices.map(svc => {
                    const isFree = freeZones.some(z => z.serviceId === svc.yclientsId);
                    const price  = svc.customPrice || svc.priceMin;
                    return (
                      <div
                        key={svc.id}
                        onDoubleClick={() => toggleFreeZone(svc)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "5px 8px", borderRadius: 10, cursor: "default", userSelect: "none",
                          background: isFree ? "rgba(232,103,138,0.12)" : "rgba(255,255,255,0.06)",
                          boxShadow: isFree ? "inset 0 0 0 1px rgba(232,103,138,0.35)" : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                          transition: "background 0.2s, box-shadow 0.2s",
                        }}
                      >
                        {isFree && <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>🎁</span>}
                        <span style={{
                          fontSize: 12, fontWeight: 600, lineHeight: 1.2,
                          color: isFree ? "#E8678A" : "#F2F2F7",
                          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{svc.title}</span>
                        {editingServiceId === svc.id ? (
                          <input
                            autoFocus
                            value={tempPrice}
                            onChange={e => setTempPrice(e.target.value.replace(/\D/g, ""))}
                            onBlur={() => saveEdit(svc)}
                            onKeyDown={e => { if (e.key === "Enter") saveEdit(svc); if (e.key === "Escape") setEditingServiceId(null); }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              width: 64, fontSize: 11, fontWeight: 700, color: "#F2F2F7",
                              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(232,103,138,0.5)",
                              borderRadius: 6, padding: "2px 5px", outline: "none", textAlign: "right", flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span
                            onClick={e => { e.stopPropagation(); startEdit(svc); }}
                            style={{
                              fontSize: 11, fontWeight: 700, flexShrink: 0,
                              color: isFree ? "rgba(232,103,138,0.5)" : "#AEAEB2",
                              textDecoration: isFree ? "line-through" : "none",
                              cursor: "pointer", padding: "1px 4px", borderRadius: 5,
                            }}
                          >{Number(price).toLocaleString()} ₽</span>
                        )}
                        <button
                          onClick={() => removeService(svc.id)}
                          style={{
                            width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.09)",
                            border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center", flexShrink: 0, padding: 0,
                          }}
                        ><X size={9} color="rgba(255,255,255,0.45)" /></button>
                      </div>
                    );
                  })}
                </div>

                {/* Price comparison */}
                {baseCost > 0 && (() => {
                  const pricePerVisit = selectedServices.reduce((sum, svc) => sum + Number(svc.customPrice || svc.priceMin), 0);
                  const pricePerVisitDisc = maxProc > 0 ? Math.round(finalCost / maxProc) : 0;
                  const totalSaved = Math.round(baseCost - finalCost);
                  return (
                    <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#8E8E93", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Стоимость визита</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>

                        {/* По прайсу */}
                        <div style={{
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                        }}>
                          <p style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 600, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>По прайсу</p>
                          <p style={{
                            fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1,
                            color: "rgba(255,255,255,0.6)",
                            textDecoration: "line-through",
                            textDecorationColor: "rgba(255,255,255,0.3)",
                          }}>
                            {Math.round(pricePerVisit).toLocaleString("ru-RU")} <span style={{ fontSize: 18, fontWeight: 700 }}>₽</span>
                          </p>
                        </div>

                        {/* Divider with discount badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                          <div style={{ flex: 1, height: 1, background: "rgba(232,103,138,0.2)" }} />
                          <div style={{
                            background: "linear-gradient(135deg, rgba(232,103,138,0.25), rgba(251,191,36,0.1))",
                            boxShadow: "inset 0 0 0 1px rgba(232,103,138,0.4)",
                            borderRadius: 20, padding: "3px 11px",
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#E8678A", letterSpacing: "0.02em" }}>−{totalDisc}%</span>
                          </div>
                          <div style={{ flex: 1, height: 1, background: "rgba(232,103,138,0.2)" }} />
                        </div>

                        {/* По абонементу */}
                        <div style={{
                          background: "linear-gradient(135deg, rgba(232,103,138,0.13) 0%, rgba(251,191,36,0.05) 100%)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 0 1px rgba(232,103,138,0.25)",
                        }}>
                          <p style={{ fontSize: 10, color: "#E8678A", fontWeight: 700, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>По абонементу</p>
                          <p style={{
                            fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1,
                            color: "#F2F2F7",
                          }}>
                            {pricePerVisitDisc > 0 ? pricePerVisitDisc.toLocaleString("ru-RU") : "—"} <span style={{ fontSize: 20, fontWeight: 700 }}>₽</span>
                          </p>
                        </div>

                        {/* Total savings across the full course */}
                        {totalSaved > 0 && (
                          <div style={{
                            background: "rgba(232,103,138,0.1)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            marginTop: 12,
                            boxShadow: "inset 0 0 0 1px rgba(232,103,138,0.28)",
                          }}>
                            <p style={{ fontSize: 10, color: "#AEAEB2", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                              Выгода за весь курс
                            </p>
                            <p style={{ fontSize: 10, color: "rgba(174,174,178,0.75)", fontWeight: 500, marginBottom: 6 }}>
                              {maxProc} сеансов × все зоны
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 900, color: "#E8678A", letterSpacing: "-0.03em", lineHeight: 1 }}>
                              {totalSaved.toLocaleString("ru-RU")} ₽
                            </p>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Settings */}
          <div style={{ ...GLASS, padding: "13px" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Настройки</p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#F2F2F7", marginBottom: 1 }}>Сертификат</p>
                <p style={{ fontSize: 12, color: "#AEAEB2" }}>−{formatPrice(calculatorSettings?.certificateDiscountAmount || 3000)}</p>
              </div>
              <NextSwitch size="sm"
                isSelected={usedCertificate}
                isDisabled={baseCost < (calculatorSettings?.certificateMinCourseAmount || 25000)}
                onValueChange={setUsedCertificate}
                classNames={{ wrapper: "bg-zinc-700 group-data-[selected=true]:bg-rose-500", thumb: "bg-white" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#F2F2F7", marginBottom: 1 }}>
                  Коррекция{correctionPercent > 0 ? ` +${correctionPercent}%` : ""}
                </p>
                <p style={{ fontSize: 12, color: "#AEAEB2" }}>до 30%</p>
              </div>
              <NextSwitch size="sm"
                isSelected={correctionPercent > 0}
                onValueChange={on => setCorrectionPercent(on ? 5 : 0)}
                classNames={{ wrapper: "bg-zinc-700 group-data-[selected=true]:bg-rose-500", thumb: "bg-white" }}
              />
            </div>

            {correctionPercent > 0 && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <input type="range" min={1} max={30} step={1} value={correctionPercent}
                  onChange={e => setCorrectionPercent(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#E8678A", cursor: "pointer" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: "#F2F2F7", width: 28, textAlign: "right" }}>{correctionPercent}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT — configurator + privileges + price bar ══════════ */}
        <div className="calc-right">
          <MainCalculatorPanel
            selectedServices={selectedServices}
            onServicesChange={setSelectedServices}
            freeZones={freeZones}
            onAddFreeZone={setFreeZones}
            downPayment={isFullPay ? maxDP : effDP}
            onDownPaymentChange={setDownPayment}
            installmentMonths={installmentMonths}
            onInstallmentMonthsChange={setInstallmentMonths}
            baseCost={baseCost}
            finalCost={finalCost}
            discountPercent={totalDisc}
            savings={savings}
            maxProcedureCount={maxProc}
            isFullPayment={isFullPay}
            monthly={monthly}
            minDP={minDP}
            maxDP={maxDP}
            correctionPercent={correctionPercent || 0}
            calculatorSettings={calculatorSettings}
            onOrder={() => setShowClient(true)}
          />
        </div>
      </div>

      {showClient && adaptedCalc && (
        <ClientModal
          isOpen={showClient}
          onClose={() => setShowClient(false)}
          calculation={adaptedCalc}
          selectedPackage="custom"
          selectedServices={selectedServices}
          procedureCount={maxProc}
          downPayment={effDP}
          installmentMonths={installmentMonths}
          usedCertificate={usedCertificate}
          freeZones={freeZones}
          manualGiftSessions={manualGiftSessions}
          user={user}
        />
      )}
      {showSales && (
        <MasterSalesModal
          isOpen={showSales}
          onClose={() => setShowSales(false)}
          masterName={user.name}
        />
      )}
    </AuroraBackground>
  );
}
