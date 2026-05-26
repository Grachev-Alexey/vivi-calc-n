import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { NextUIProvider } from "@nextui-org/react";
import { useState, useEffect } from "react";
import AuthPage from "@/pages/auth";
import PromoCalculatorPage from "@/pages/promo-calculator";
import AdminPage from "@/pages/admin";

interface User {
  id: number;
  name: string;
  role: 'master' | 'admin';
  pin: string;
  isActive: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/check", { credentials: "include" });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
      }
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111113" }}>
        <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-rose-400 animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NextUIProvider theme="dark">
        <Toaster />
        {!user ? (
          <AuthPage onLogin={setUser} />
        ) : (
          <Switch>
            <Route path="/admin" component={() => <AdminPage user={user} onLogout={() => { fetch("/api/logout", { method: "POST", credentials: "include" }); setUser(null); }} />} />
            <Route component={() => <PromoCalculatorPage user={user} onLogout={() => { fetch("/api/logout", { method: "POST", credentials: "include" }); setUser(null); }} />} />
          </Switch>
        )}
      </NextUIProvider>
    </QueryClientProvider>
  );
}

export default App;
