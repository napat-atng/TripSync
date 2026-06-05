import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "../lib/supabase";

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setIsLoading: (isLoading) => set({ isLoading }),
  signOut: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    set({ session: null, user: null });
  },
}));
