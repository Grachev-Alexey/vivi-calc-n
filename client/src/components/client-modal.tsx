import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { User, Loader2, Copy, CheckCircle, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { validatePhoneNumber } from "@/lib/utils";
import PhoneInput from "./ui/phone-input";

interface UserData { id: number; name: string; role: "master" | "admin" }

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculation: any;
  selectedPackage: string | null;
  selectedServices: any[];
  procedureCount: number;
  downPayment: number;
  installmentMonths: number;
  usedCertificate: boolean;
  freeZones: any[];
  manualGiftSessions?: Record<string, number>;
  user?: UserData;
}

const G: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)",
  borderRadius: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  color: "#F2F2F7",
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  color: "#E8678A",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 5,
};

function DarkInput({ id, type = "text", value, onChange, placeholder, required }: {
  id?: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id} type={type} value={value} placeholder={placeholder} required={required}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputStyle,
        borderColor: focused ? "rgba(232,103,138,0.5)" : "rgba(255,255,255,0.14)",
        boxShadow: focused ? "0 0 0 2px rgba(232,103,138,0.12)" : "none",
      }}
    />
  );
}

function buildPaymentSchedule(
  selectedPackage: string,
  finalCost: number,
  downPayment: number,
  installmentMonths: number,
  startDate: Date
): { date: string; amount: number; description: string }[] {
  if (selectedPackage === "vip") {
    return [{ date: startDate.toISOString().split("T")[0], amount: finalCost, description: "Полная оплата" }];
  }
  const schedule = [{ date: startDate.toISOString().split("T")[0], amount: downPayment, description: "Первоначальный взнос" }];
  const monthly = (finalCost - downPayment) / installmentMonths;
  for (let i = 1; i <= installmentMonths; i++) {
    const d = new Date(startDate); d.setMonth(d.getMonth() + i);
    schedule.push({ date: d.toISOString().split("T")[0], amount: monthly, description: `Платеж ${i} из ${installmentMonths}` });
  }
  return schedule;
}

export default function ClientModal({
  isOpen, onClose, calculation, selectedPackage, selectedServices,
  procedureCount, downPayment, installmentMonths, usedCertificate,
  freeZones, manualGiftSessions = {}, user
}: ClientModalProps) {
  const isAdmin = user?.role === "admin";

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscriptionTitle, setSubscriptionTitle] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMasterId, setSelectedMasterId] = useState<number | undefined>(
    isAdmin ? undefined : user?.id
  );
  const [pdfVersion, setPdfVersion] = useState<"standard" | "amendment">("standard");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch users");
      return r.json();
    },
    enabled: isAdmin && isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhoneNumber(phone)) {
      toast({ title: "Ошибка", description: "Введите корректный номер телефона", variant: "destructive" });
      return;
    }
    if (!selectedPackage || !calculation) {
      toast({ title: "Ошибка", description: "Выберите пакет для продолжения", variant: "destructive" });
      return;
    }
    if (isAdmin && !selectedMasterId) {
      toast({ title: "Ошибка", description: "Выберите мастера для продажи", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const packageData = calculation.packages[selectedPackage];
      const startDate = isAdmin ? new Date(saleDate) : new Date();
      const paymentSchedule = buildPaymentSchedule(selectedPackage, packageData.finalCost, downPayment, installmentMonths, startDate);

      const body = {
        clientName,
        clientPhone: phone.replace(/\D/g, ""),
        clientEmail: email || undefined,
        paymentSchedule,
        pdfVersion: isAdmin ? pdfVersion : "standard",
        calculation: {
          services: selectedServices.map(s => ({
            id: s.yclientsId, serviceId: s.yclientsId, name: s.title, title: s.title,
            price: s.editedPrice || s.price || s.priceMin || s.cost || 0,
            priceMin: s.priceMin || s.price || s.editedPrice || s.cost || 0,
            editedPrice: s.editedPrice || s.price || s.priceMin || s.cost || 0,
            cost: s.cost || s.price || s.priceMin || s.editedPrice || 0,
            quantity: s.quantity || 1, sessionCount: s.sessionCount || 10, count: s.sessionCount || 10,
          })),
          packageType: selectedPackage,
          baseCost: calculation.baseCost,
          finalCost: packageData.finalCost,
          totalSavings: packageData.totalSavings,
          downPayment,
          installmentMonths: selectedPackage === "vip" ? undefined : installmentMonths,
          monthlyPayment: selectedPackage === "vip" ? undefined : packageData.monthlyPayment,
          usedCertificate, freeZones,
          appliedDiscounts: packageData.appliedDiscounts,
          manualGiftSessions: Object.keys(manualGiftSessions).length > 0 ? manualGiftSessions : undefined,
          ...(isAdmin && { saleDate, masterId: selectedMasterId }),
        },
      };

      const response = await fetch("/api/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message);
      }

      const result = await response.json();
      setSubscriptionTitle(result.subscriptionType);
      setIsCompleted(true);

      // Send contract by email
      if (email) {
        try {
          const sr = await fetch(`/api/sales/${result.saleId}/send`, { method: "POST", credentials: "include" });
          if (sr.ok) {
            setOfferSent(true);
            toast({ title: "Договор отправлен!", description: `Договор-оферта успешно отправлен на ${email}` });
          }
        } catch (e) {
          console.error("Error sending contract:", e);
        }
      }
    } catch (error) {
      toast({ title: "Ошибка", description: error instanceof Error ? error.message : "Не удалось создать абонемент", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Скопировано!", description: "Название абонемента скопировано в буфер обмена" });
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать", variant: "destructive" });
    }
  };

  const handleClose = () => {
    setPhone(""); setEmail(""); setClientName(""); setSubscriptionTitle("");
    setIsCompleted(false); setOfferSent(false); onClose();
  };

  const generatePaymentSchedule = () => {
    if (!selectedPackage || !calculation || selectedPackage === "vip") return [];
    const pkg = calculation.packages[selectedPackage];
    const schedule = [{ date: new Date(), amount: downPayment, description: "Первоначальный взнос" }];
    const monthly = (pkg.finalCost - downPayment) / installmentMonths;
    for (let i = 1; i <= installmentMonths; i++) {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      schedule.push({ date: d, amount: monthly, description: `Платеж ${i} из ${installmentMonths}` });
    }
    return schedule;
  };

  const paymentSchedule = generatePaymentSchedule();
  const hasSchedule = selectedPackage && selectedPackage !== "vip" && paymentSchedule.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="border-0 p-0 gap-0 overflow-hidden"
        style={{
          background: "rgba(18, 16, 28, 0.96)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.08)",
          borderRadius: 24,
          maxWidth: hasSchedule ? 680 : 420,
          width: "95vw",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: isCompleted ? "linear-gradient(135deg, #34D399, #059669)" : "linear-gradient(135deg, #E8678A, #BE4C6E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isCompleted ? "0 4px 16px rgba(52,211,153,0.35)" : "0 4px 16px rgba(232,103,138,0.35)",
          }}>
            {isCompleted ? <CheckCircle size={18} color="#fff" /> : <User size={18} color="#fff" />}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#F2F2F7", letterSpacing: "-0.02em" }}>
              {isCompleted ? "Абонемент создан!" : "Оформление абонемента"}
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
              {isCompleted ? "Всё готово" : "Введите данные клиента"}
            </p>
          </div>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {isCompleted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...G, padding: "14px 16px" }}>
                <p style={labelStyle}>Название абонемента</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#F2F2F7", wordBreak: "break-word" }}>
                    {subscriptionTitle}
                  </p>
                  <button
                    onClick={() => copyToClipboard(subscriptionTitle)}
                    style={{
                      flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                      background: "rgba(232,103,138,0.15)", border: "1px solid rgba(232,103,138,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    }}
                  >
                    <Copy size={13} color="#E8678A" />
                  </button>
                </div>
              </div>

              {offerSent && (
                <div style={{ ...G, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle size={16} color="#34D399" />
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#34D399" }}>
                    Договор-оферта отправлен на {email}
                  </p>
                </div>
              )}

              <button
                onClick={handleClose}
                style={{
                  width: "100%", padding: "11px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #E8678A, #BE4C6E)",
                  color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: "0.02em",
                  boxShadow: "0 4px 20px rgba(232,103,138,0.4)",
                }}
              >
                Закрыть
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: hasSchedule ? "1fr 1fr" : "1fr", gap: 20 }}>
              {/* Left: form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {isAdmin && (
                  <>
                    <div style={{ ...G, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        Настройки продажи
                      </p>

                      <div>
                        <label style={labelStyle}>Дата продажи</label>
                        <input
                          type="date" value={saleDate}
                          onChange={e => setSaleDate(e.target.value)}
                          required
                          style={{ ...inputStyle, colorScheme: "dark" }}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Мастер</label>
                        <Select value={selectedMasterId?.toString()} onValueChange={v => setSelectedMasterId(Number(v))}>
                          <SelectTrigger style={{ ...inputStyle, height: "auto" }} className="border-0 focus:ring-0">
                            <SelectValue placeholder="Выберите мастера" />
                          </SelectTrigger>
                          <SelectContent style={{ background: "rgba(24,20,36,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                            {users.filter(u => u.role === "master").map(u => (
                              <SelectItem key={u.id} value={u.id.toString()} style={{ color: "#F2F2F7" }}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label style={labelStyle}>Версия договора</label>
                        <Select value={pdfVersion} onValueChange={v => setPdfVersion(v as "standard" | "amendment")}>
                          <SelectTrigger style={{ ...inputStyle, height: "auto" }} className="border-0 focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={{ background: "rgba(24,20,36,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                            <SelectItem value="standard" style={{ color: "#F2F2F7" }}>Стандартный договор</SelectItem>
                            <SelectItem value="amendment" style={{ color: "#F2F2F7" }}>Изменение условий</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
                  </>
                )}

                {/* Client fields */}
                <div>
                  <label style={labelStyle}>ФИО клиента</label>
                  <DarkInput value={clientName} onChange={setClientName} placeholder="Иванов Иван Иванович" required />
                </div>

                <div>
                  <label style={labelStyle}>Номер телефона</label>
                  <PhoneInput value={phone} onChange={setPhone} placeholder="+7 (___) ___-__-__" required style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Email клиента</label>
                  <DarkInput type="email" value={email} onChange={setEmail} placeholder="client@example.com" required />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    type="button" onClick={handleClose} disabled={loading}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 12, cursor: "pointer",
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
                      color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700,
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loading || (isAdmin && !selectedMasterId)}
                    style={{
                      flex: 2, padding: "10px", borderRadius: 12, border: "none", cursor: "pointer",
                      background: loading || (isAdmin && !selectedMasterId)
                        ? "rgba(232,103,138,0.3)"
                        : "linear-gradient(135deg, #E8678A, #BE4C6E)",
                      color: "#fff", fontSize: 13, fontWeight: 800,
                      boxShadow: loading ? "none" : "0 4px 20px rgba(232,103,138,0.35)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? "Создание..." : "Создать абонемент"}
                  </button>
                </div>
              </form>

              {/* Right: payment schedule */}
              {hasSchedule && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Calendar size={13} color="#E8678A" />
                    <p style={{ fontSize: 10, fontWeight: 800, color: "#E8678A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      График платежей
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {paymentSchedule.map((payment, i) => (
                      <div key={i} style={{ ...G, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                            background: "rgba(232,103,138,0.15)", border: "1px solid rgba(232,103,138,0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#E8678A" }}>{i + 1}</span>
                          </div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#F2F2F7" }}>{payment.description}</p>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 800, color: "#E8678A" }}>{formatPrice(payment.amount)}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    ...G, padding: "10px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "rgba(232,103,138,0.1)", boxShadow: "inset 0 0 0 1px rgba(232,103,138,0.2)",
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Итого:</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#E8678A" }}>
                      {formatPrice(paymentSchedule.reduce((s, p) => s + p.amount, 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
