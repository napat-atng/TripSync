import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../shared/supabase";

type AuthState = { session: Session | null; loading: boolean; error: string | null };
const AuthContext = createContext<AuthState>({ session: null, loading: true, error: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) { setState({ session: null, loading: false, error: null }); return; }
    let active = true;
    let receivedEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      if (!active) return;
      if (previousUser.current !== (session?.user.id ?? null) || _event === "SIGNED_OUT") queryClient.clear();
      previousUser.current = session?.user.id ?? null;
      setState({ session, loading: false, error: null });
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedEvent) setState({ session: data.session, loading: false, error: error?.message ?? null });
    }).catch(() => {
      if (active && !receivedEvent) setState({ session: null, loading: false, error: "ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่" });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
