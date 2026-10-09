import { getSupabase } from "../../shared/supabase";
import { consumeReturnPath, saveReturnPath } from "../../shared/navigation";

export async function signInWithGoogle(returnTo: string) {
  saveReturnPath(returnTo);
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

// Keep one exchange per callback even when React StrictMode remounts the page.
let pendingCallback: { code: string; promise: Promise<string> } | null = null;
export function completeGoogleCallback(code: string) {
  if (pendingCallback?.code === code) return pendingCallback.promise;
  const promise = getSupabase().auth.exchangeCodeForSession(code).then(({ error }) => {
    if (error) throw error;
    return consumeReturnPath();
  });
  pendingCallback = { code, promise };
  return promise;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
