import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const DirtyContext = createContext({ dirty: false, register: (_id: string, _dirty: boolean) => {} });
export function DirtyFormsProvider({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<Set<string>>(() => new Set());
  const register = useCallback((id: string, dirty: boolean) => {
    setForms(previous => {
      if (previous.has(id) === dirty) return previous;
      const next = new Set(previous);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  return <DirtyContext.Provider value={{ dirty: forms.size > 0, register }}>{children}</DirtyContext.Provider>;
}
export function useDirtyForms() { return useContext(DirtyContext); }
