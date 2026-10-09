import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: "tripsync",
  path: "auth/callback",
});

export async function handleOAuthCallback(url: string) {
  const parsedUrl = new URL(url);
  const code = parsedUrl.searchParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data;
  }

  const params = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  return null;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("Google OAuth URL was not returned by Supabase.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "success") {
    await handleOAuthCallback(result.url);
  }

  return getCurrentUser();
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
    await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  if (sessionError) {
    throw sessionError;
  }

  if (userError) {
    throw userError;
  }

  return {
    session: sessionData.session,
    user: userData.user,
  };
}

export function getOAuthRedirectUrl() {
  return redirectTo;
}

export function createAppUrl(path: string) {
  return Linking.createURL(path);
}
