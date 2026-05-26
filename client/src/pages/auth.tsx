import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AuroraBackground } from "@/components/magicui/aurora-background";

interface User { id: number; name: string; role: "master" | "admin" }
interface AuthPageProps { onLogin: (user: any) => void }

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const handleAuth = async (fullPin: string) => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin: fullPin }),
      });
      if (r.ok) { onLogin((await r.json()).user); }
      else {
        setShake(true); setTimeout(() => setShake(false), 420);
        setPin(["", "", "", ""]); setTimeout(() => inputRefs.current[0]?.focus(), 40);
        toast({ title: "Неверный PIN-код", variant: "destructive" });
      }
    } catch {
      setPin(["", "", "", ""]); setTimeout(() => inputRefs.current[0]?.focus(), 40);
    } finally { setLoading(false); }
  };

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...pin]; next[i] = v.slice(-1); setPin(next);
    if (v && i < 3) inputRefs.current[i + 1]?.focus();
    if (next.every(d => d !== "")) handleAuth(next.join(""));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const d = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (d.length === 4) { setPin(d.split("")); handleAuth(d); }
  };

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  return (
    <AuroraBackground className="h-screen items-center justify-center">
      <div
        style={{
          position: "relative", zIndex: 1,
          background: "rgba(255,255,255,0.09)",
          backdropFilter: "blur(32px) saturate(160%)",
          WebkitBackdropFilter: "blur(32px) saturate(160%)",
          borderRadius: 28,
          padding: "44px 52px 48px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 0 0 1.5px rgba(255,255,255,0.2), 0 24px 64px rgba(0,0,0,0.5)",
          width: 310,
          animation: shake ? "shake 0.35s ease" : "none",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: "linear-gradient(135deg, #e8a0b8 0%, #c06080 55%, #a04060 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 28px rgba(192,96,128,0.4)",
            fontSize: 24, color: "#fff",
          }}>✿</div>
        </div>

        <p style={{ textAlign: "center", fontSize: 17, fontWeight: 700, color: "#F2F2F7", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Добро пожаловать
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "#636366", marginBottom: 32 }}>
          Введите PIN-код для входа
        </p>

        {/* PIN inputs */}
        <div onPaste={handlePaste} style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)}
              type="password" inputMode="numeric" maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading} autoComplete="off"
              style={{
                width: 54, height: 58, textAlign: "center", fontSize: 24, fontWeight: 700,
                borderRadius: 16,
                border: digit ? "2px solid rgba(192,96,128,0.6)" : "2px solid rgba(255,255,255,0.08)",
                background: digit ? "rgba(192,96,128,0.15)" : "rgba(255,255,255,0.05)",
                color: "#F2F2F7", outline: "none",
                transition: "all 0.15s ease",
                transform: digit ? "scale(1.05)" : "scale(1)",
                boxShadow: digit ? "0 4px 16px rgba(192,96,128,0.25)" : "none",
                cursor: "text",
              }}
            />
          ))}
        </div>
        {loading && <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#636366" }}>Проверка...</p>}
      </div>
      <style>{`
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-8px); }
          40% { transform:translateX(8px); }
          60% { transform:translateX(-5px); }
          80% { transform:translateX(5px); }
        }
      `}</style>
    </AuroraBackground>
  );
}
