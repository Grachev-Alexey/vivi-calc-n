import { useMemo } from "react";
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

interface OfferSummaryPanelProps {
  selectedServices: SelectedService[];
  baseCost: number;
  discountPercent: number;
  finalCost: number;
  savings: number;
  downPayment: number;
  installmentMonths: number;
  monthly: number;
  isFullPayment: boolean;
  maxProcedureCount: number;
  onOrder: () => void;
  usedCertificate: boolean;
  certificateDiscountAmount?: number;
  minDP?: number;
}

interface Gift {
  id: string;
  label: string;
  emoji: string;
  requiresFullPayment?: boolean;
  minProcedures?: number;
}

// Ordered from most attainable to rarest
const GIFTS: Gift[] = [
  { id: "bonus",       label: "Бонусный счёт 50% от депозита",           emoji: "💰" },
  { id: "club_card",   label: "Клубная карта: новые зоны −40%",           emoji: "💳" },
  { id: "priority",    label: "Приоритетная запись к мастеру",            emoji: "⭐" },
  { id: "all_zones",   label: "1 процедура на все зоны",                  emoji: "✨" },
  { id: "small_zone",  label: "Малая/средняя зона в подарок",             emoji: "🎁" },
  { id: "guarantee",   label: "Гарантия результата",                      emoji: "🛡️", minProcedures: 15 },
  { id: "friend",      label: "+3 процедуры + абонемент с подругой",      emoji: "👯‍♀️", requiresFullPayment: true },
];

function getActiveGiftCount(
  maxProcedureCount: number,
  downPayment: number,
  minDP: number,
  isFullPayment: boolean,
): number {
  // Base gifts from procedure count
  const procGifts = maxProcedureCount >= 15 ? 3 : maxProcedureCount >= 10 ? 2 : maxProcedureCount >= 4 ? 1 : 0;
  // Extra gifts from down payment above minimum (every 2000₽)
  const extraDP = Math.max(0, downPayment - minDP);
  const dpGifts = Math.floor(extraDP / 2000);
  // Full payment bonus
  const fullBonus = isFullPayment ? 2 : 0;
  return Math.min(GIFTS.length, procGifts + dpGifts + fullBonus);
}

function getGiftList(
  maxProcedureCount: number,
  downPayment: number,
  minDP: number,
  isFullPayment: boolean,
) {
  const activeCount = getActiveGiftCount(maxProcedureCount, downPayment, minDP, isFullPayment);
  return GIFTS.map((gift, i) => {
    // A gift is blocked if it has special requirements not yet met
    const blocked =
      (gift.requiresFullPayment && !isFullPayment) ||
      (gift.minProcedures !== undefined && maxProcedureCount < gift.minProcedures);
    const active = i < activeCount && !blocked;
    return { gift, active };
  });
}

function GiftRow({ gift, active }: { gift: Gift; active: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-300"
      style={{
        background: active ? "#fff8fb" : "transparent",
        border: active ? "1px solid #fce7f3" : "1px solid transparent",
      }}
    >
      <span style={{ fontSize: 15, filter: active ? "none" : "grayscale(1) opacity(0.35)" }}>
        {gift.emoji}
      </span>
      <span
        className="flex-1 text-xs leading-tight"
        style={{ color: active ? "#1D1D1F" : "#C7C7CC", fontWeight: active ? 500 : 400 }}
      >
        {gift.label}
      </span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="7" fill="#34C759" />
          <path d="M4 7L6.2 9.2L10 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export default function OfferSummaryPanel({
  selectedServices,
  baseCost,
  discountPercent,
  finalCost,
  savings,
  downPayment,
  installmentMonths,
  monthly,
  isFullPayment,
  maxProcedureCount,
  onOrder,
  usedCertificate,
  certificateDiscountAmount = 0,
  minDP = 5000,
}: OfferSummaryPanelProps) {
  const giftList = useMemo(
    () => getGiftList(maxProcedureCount, downPayment, minDP, isFullPayment),
    [maxProcedureCount, downPayment, minDP, isFullPayment]
  );
  const activeCount = giftList.filter(g => g.active).length;

  const hasServices = selectedServices.length > 0 && baseCost > 0;

  if (!hasServices) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-10">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
          style={{ background: "linear-gradient(135deg, #fce7f3, #f3e8ff)" }}>
          ✦
        </div>
        <p className="text-[#1D1D1F] text-base font-semibold mb-1.5" style={{ letterSpacing: "-0.01em" }}>
          Выберите услуги
        </p>
        <p className="text-[#AEAEB2] text-sm leading-relaxed">
          Добавьте зоны слева — здесь сформируется ваше предложение
        </p>
      </div>
    );
  }

  const originalCost = baseCost + (usedCertificate ? certificateDiscountAmount : 0);
  const nextGiftAt = !isFullPayment
    ? minDP + Math.ceil((downPayment - minDP + 1) / 2000) * 2000
    : null;
  const toNextGift = nextGiftAt ? Math.max(0, nextGiftAt - downPayment) : 0;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

      {/* Price hero */}
      <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
        {/* Discount badge + original */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: "#fff0fa", color: "#e879a0", border: "1px solid #fce7f3" }}
          >
            <span>🏷️</span> Скидка {discountPercent}%
          </div>
          {savings > 0 && (
            <span className="text-xs text-[#AEAEB2] tabular-nums line-through">
              {formatPrice(originalCost)}
            </span>
          )}
        </div>

        {/* Final price */}
        <div className="mb-2">
          <span
            className="font-black tabular-nums tracking-tight"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1D1D1F", letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            {formatPrice(finalCost)}
          </span>
        </div>

        {/* Savings */}
        {savings > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
            <span className="text-sm font-semibold text-[#34C759] tabular-nums">
              Экономия {formatPrice(savings)}
            </span>
          </div>
        )}
      </div>

      {/* Payment split */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          {
            label: "Сегодня",
            value: formatPrice(downPayment),
            sub: isFullPayment ? "полная оплата" : "первый взнос",
            active: true,
          },
          {
            label: "Ежемесячно",
            value: isFullPayment ? "—" : formatPrice(monthly),
            sub: isFullPayment ? "—" : `× ${installmentMonths} мес.`,
            active: !isFullPayment,
          },
        ].map(card => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-4"
            style={{ border: "1px solid rgba(0,0,0,0.07)", opacity: card.active || isFullPayment ? 1 : 0.55 }}
          >
            <p className="text-[10px] font-bold text-[#AEAEB2] uppercase tracking-wider mb-2">{card.label}</p>
            <p className="text-xl font-black tabular-nums text-[#1D1D1F] leading-none mb-1">{card.value}</p>
            <p className="text-[11px] text-[#6E6E73]">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Gifts */}
      <div className="bg-white rounded-2xl p-4 flex-1" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[#1D1D1F]" style={{ letterSpacing: "-0.01em" }}>
            Подарки программы
          </p>
          <div className="flex items-center gap-1">
            {GIFTS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i < activeCount ? 8 : 6,
                  height: i < activeCount ? 8 : 6,
                  background: i < activeCount ? "#e879a0" : "#E5E5EA",
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {giftList.map(({ gift, active }) => (
            <GiftRow key={gift.id} gift={gift} active={active} />
          ))}
        </div>

        {!isFullPayment && activeCount < GIFTS.length && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F2F2F7" }}>
            {toNextGift > 0 && toNextGift <= 2000 ? (
              <p className="text-[11px] text-center text-[#6E6E73]">
                Добавьте <span className="font-bold tabular-nums">{formatPrice(toNextGift)}</span> к взносу — ещё один подарок
              </p>
            ) : (
              <p className="text-[11px] text-center text-[#AEAEB2]">
                Каждые 2 000 ₽ к взносу = +1 подарок
              </p>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onOrder}
        disabled={!hasServices}
        className="w-full rounded-2xl font-bold text-white text-[15px] transition-all duration-200 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
        style={{
          padding: "15px 24px",
          background: "linear-gradient(135deg, #f472b6 0%, #e879a0 40%, #a855f7 100%)",
          boxShadow: "0 6px 24px rgba(232, 121, 160, 0.35)",
          letterSpacing: "-0.01em",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Оформить абонемент
      </button>
    </div>
  );
}
