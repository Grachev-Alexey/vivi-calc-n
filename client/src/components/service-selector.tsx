import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Gift, Plus, Search, ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Service {
  id: number; yclientsId: number; title: string; priceMin: string;
}
interface SelectedService extends Service {
  quantity: number; sessionCount: number; customPrice?: string;
}
interface FreeZone {
  serviceId: number; title: string; pricePerProcedure: number; quantity: number;
}
interface ServiceSelectorProps {
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
  onAddFreeZone: (freeZones: FreeZone[]) => void;
  freeZones: FreeZone[];
  onSessionCountChange?: (maxSessionCount: number) => void;
  calculatorSettings?: any;
  hideSelectedList?: boolean;
}

const D_BG      = "rgba(255,255,255,0.07)";
const D_BG_HVR  = "rgba(255,255,255,0.12)";
const D_BORDER  = "rgba(255,255,255,0.15)";
const D_BORDER_F = "rgba(232,103,138,0.5)";
const D_TEXT    = "#F2F2F7";
const D_SUBTEXT = "#AEAEB2";

export default function ServiceSelector({
  selectedServices, onServicesChange, onAddFreeZone, freeZones,
  onSessionCountChange, calculatorSettings, hideSelectedList = false,
}: ServiceSelectorProps) {
  const [searchTerm, setSearchTerm]             = useState("");
  const [isOpen, setIsOpen]                     = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editingPrice, setEditingPrice]         = useState<number | null>(null);
  const [tempPrice, setTempPrice]               = useState("");
  const [isMalePricing, setIsMalePricing]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });

  useEffect(() => {
    const max = selectedServices.length > 0
      ? Math.max(...selectedServices.map(s => s.sessionCount || 10)) : 10;
    onSessionCountChange?.(max);
  }, [selectedServices]);

  const filteredServices = services
    .filter(s => !selectedServices.find(sel => sel.yclientsId === s.yclientsId))
    .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.priceMin.includes(searchTerm));

  const getAdjustedPrice = (base: string | number) => {
    const p = typeof base === "string" ? parseFloat(base) : base;
    return isMalePricing ? Math.round(p * 1.4) : p;
  };

  const updateDropdownPosition = () => {
    if (dropdownRef.current) {
      const r = dropdownRef.current.getBoundingClientRect();
      setDropdownPosition({ top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX, width: r.width });
    }
  };

  const addService = (service: Service) => {
    if (selectedServices.find(s => s.yclientsId === service.yclientsId)) return;
    const price = getAdjustedPrice(service.priceMin);
    const defaultSessionCount = calculatorSettings?.defaultSessionCount || 10;
    onServicesChange([...selectedServices, {
      ...service, priceMin: price.toString(), customPrice: price.toString(),
      quantity: 1, sessionCount: defaultSessionCount,
    }]);
    setSearchTerm("");
    setTimeout(() => { inputRef.current?.focus(); updateDropdownPosition(); }, 50);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        const inPortal = (target as Element)?.closest("[data-dropdown-portal]");
        if (!inPortal) { setIsOpen(false); setDropdownPosition(null); }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMalePricingToggle = (enabled: boolean) => {
    setIsMalePricing(enabled);
    onServicesChange(selectedServices.map(svc => {
      const orig = svc.customPrice ? parseFloat(svc.customPrice) : parseFloat(svc.priceMin);
      const newPrice = enabled
        ? (isMalePricing ? orig : Math.round(orig * 1.4))
        : (isMalePricing ? Math.round(orig / 1.4) : orig);
      return { ...svc, customPrice: newPrice.toString() };
    }));
  };

  const removeService  = (id: number) => onServicesChange(selectedServices.filter(s => s.yclientsId !== id));
  const removeFreeZone = (id: number) => onAddFreeZone(freeZones.filter(z => z.serviceId !== id));

  const handleDoubleClick = (svc: SelectedService) => {
    if (freeZones.find(z => z.serviceId === svc.yclientsId)) return;
    onAddFreeZone([...freeZones, {
      serviceId: svc.yclientsId, title: svc.title,
      pricePerProcedure: parseFloat(svc.customPrice || svc.priceMin), quantity: 1,
    }]);
  };

  const startEditing = (id: number, price: string) => { setEditingPrice(id); setTempPrice(Math.round(parseFloat(price)).toString()); };
  const savePrice    = (id: number) => { onServicesChange(selectedServices.map(s => s.yclientsId === id ? { ...s, customPrice: tempPrice } : s)); setEditingPrice(null); setTempPrice(""); };
  const getCurrentPrice = (svc: SelectedService) => svc.customPrice || svc.priceMin;

  if (isLoading) {
    return <div style={{ height: 36, borderRadius: 12, background: "rgba(226,232,240,0.5)", animation: "pulse 2s infinite" }} />;
  }

  return (
    <div>
      {/* Search + dropdown */}
      <div className="relative mb-2 z-50" ref={dropdownRef}>
        <div className="relative">
          <input
            ref={inputRef} type="text" placeholder="Поиск зон..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); if (!isOpen) { setIsOpen(true); updateDropdownPosition(); } }}
            style={{
              width: "100%", height: 32, borderRadius: 12, fontSize: 13,
              padding: "0 30px 0 32px",
              background: D_BG,
              border: `1px solid ${D_BORDER}`,
              color: D_TEXT, outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = D_BORDER_F; setIsOpen(true); updateDropdownPosition(); }}
            onBlur={e => (e.currentTarget.style.borderColor = D_BORDER)}
          />
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
          <ChevronDown size={12} style={{ position: "absolute", right: 9, top: "50%", transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)`, color: "rgba(255,255,255,0.35)", pointerEvents: "none", transition: "transform 0.2s" }} />
        </div>

        {isOpen && dropdownPosition && createPortal(
          <div data-dropdown-portal style={{
            position: "fixed", zIndex: 99999,
            top: dropdownPosition.top, left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 300),
            background: "rgba(28,28,32,0.97)",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
            border: `1px solid ${D_BORDER}`,
            borderRadius: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
            maxHeight: 300, overflow: "hidden",
          }}>
            <div style={{ overflowY: "auto", maxHeight: 300, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
              {filteredServices.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center" }}>
                  <Search size={28} style={{ color: "rgba(255,255,255,0.2)", margin: "0 auto 8px", display: "block" }} />
                  <p style={{ fontSize: 12, color: D_SUBTEXT }}>
                    {searchTerm ? "Зоны не найдены" : selectedServices.length > 0 ? "Все доступные зоны добавлены" : "Начните вводить название"}
                  </p>
                </div>
              ) : (
                <div style={{ padding: 8 }}>
                  {/* Male pricing toggle */}
                  <div style={{
                    marginBottom: 8, padding: "6px 10px",
                    background: "rgba(255,255,255,0.06)", borderRadius: 10,
                    border: `1px solid ${D_BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: D_SUBTEXT }}>Мужской прайс (+40%)</span>
                    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={isMalePricing} onChange={e => handleMalePricingToggle(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                      <div style={{ width: 30, height: 17, borderRadius: 9, position: "relative", background: isMalePricing ? "#E8678A" : "rgba(255,255,255,0.15)", transition: "background 0.2s" }}>
                        <div style={{ position: "absolute", top: 2, left: isMalePricing ? "calc(100% - 15px)" : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
                      </div>
                    </label>
                  </div>

                  {filteredServices.slice(0, 20).map(svc => (
                    <div key={svc.yclientsId}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 8px", borderRadius: 9, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = D_BG_HVR)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); addService(svc); }}
                    >
                      <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(232,103,138,0.5)", marginRight: 8, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: D_TEXT, lineHeight: 1.35 }}>{svc.title}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", marginLeft: 6, gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#AEAEB2", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "1px 7px" }}>
                          {getAdjustedPrice(svc.priceMin).toLocaleString()} ₽
                        </span>
                        <Plus size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                      </div>
                    </div>
                  ))}

                  {filteredServices.length > 20 && (
                    <div style={{ padding: "6px 8px", fontSize: 11, color: D_SUBTEXT, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      Уточните поиск — {filteredServices.length} зон
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Selected list — shown only when hideSelectedList is false */}
      {!hideSelectedList && selectedServices.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {selectedServices.map(svc => {
            const isFree = freeZones.some(z => z.serviceId === svc.yclientsId);
            return (
              <div key={svc.yclientsId}
                style={{
                  borderRadius: 12, padding: "7px 9px", cursor: "pointer",
                  border: isFree ? "1px solid rgba(148,163,184,0.4)" : "1px solid rgba(226,232,240,0.7)",
                  background: isFree ? "rgba(241,245,249,0.7)" : "rgba(248,250,252,0.7)",
                  transition: "background 0.15s",
                }}
                onDoubleClick={() => handleDoubleClick(svc)}
                title={isFree ? "Бесплатная зона" : "Двойной клик — добавить как бесплатную"}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, flex: 1, minWidth: 0, color: isFree ? "rgba(71,85,105,0.6)" : ACCENT, wordBreak: "break-word", textDecoration: isFree ? "line-through" : "none", opacity: isFree ? 0.65 : 1 }}>
                    {svc.title}
                    {isFree && <Gift size={10} style={{ color: "rgba(148,163,184,0.7)", marginLeft: 4, display: "inline" }} />}
                  </span>
                  <button onClick={() => removeService(svc.yclientsId)}
                    style={{ width: 18, height: 18, borderRadius: 6, border: "none", background: "transparent", color: "rgba(203,213,225,0.9)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "color 0.15s" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#EF4444")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.9)")}
                  ><X size={10} strokeWidth={2} /></button>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {editingPrice === svc.yclientsId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" value={tempPrice} onChange={e => setTempPrice(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") savePrice(svc.yclientsId); if (e.key === "Escape") { setEditingPrice(null); setTempPrice(""); } }}
                        style={{ width: 70, height: 20, textAlign: "center", fontSize: 11, border: `1px solid ${ACCENT_BDR}`, borderRadius: 7, background: "rgba(255,255,255,0.9)", color: ACCENT, outline: "none", padding: "0 4px" }}
                        autoFocus onFocus={e => e.target.select()} onBlur={() => savePrice(svc.yclientsId)}
                        onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
                      />
                      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.7)" }}>₽</span>
                    </div>
                  ) : (
                    <span
                      style={{ fontSize: 11, fontWeight: 500, cursor: isFree ? "default" : "pointer", padding: "1px 7px", borderRadius: 7, transition: "background 0.15s", color: isFree ? "rgba(148,163,184,0.6)" : ACCENT_MID, background: isFree ? "transparent" : "rgba(241,245,249,0.8)", border: isFree ? "none" : "1px solid rgba(226,232,240,0.6)" }}
                      onClick={e => { e.stopPropagation(); if (!isFree) startEditing(svc.yclientsId, getCurrentPrice(svc)); }}
                    >
                      {Math.round(parseFloat(getCurrentPrice(svc))).toLocaleString()} ₽
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Free zones */}
      {!hideSelectedList && freeZones.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Gift size={11} style={{ color: "rgba(100,116,139,0.6)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(100,116,139,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Бесплатные зоны</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {freeZones.map(zone => (
              <div key={zone.serviceId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(241,245,249,0.7)", borderRadius: 10, padding: "5px 9px", border: "1px solid rgba(226,232,240,0.6)" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(71,85,105,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{zone.title}</span>
                <button onClick={() => removeFreeZone(zone.serviceId)}
                  style={{ width: 16, height: 16, borderRadius: 5, border: "none", background: "transparent", color: "rgba(203,213,225,0.9)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#EF4444")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "rgba(203,213,225,0.9)")}
                ><X size={9} strokeWidth={2} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
