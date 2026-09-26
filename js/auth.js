// js/auth.js — Auth helpers wrapping Supabase
// Public API:
//   getSession()          -> current session or null
//   getCachedUser()       -> current user or null (sync)
//   setCachedUser(user)   -> internal cache setter
//   signInWithGoogle()    -> redirects to Google
//   signOut()             -> clears session
//   onAuthChange(cb)      -> subscribe to auth state changes
//   isAuthAvailable()     -> whether Supabase is configured

import { supabase, isSupabaseConfigured } from "./supabase.js";

let _cachedUser = null;

export function isAuthAvailable() {
  return isSupabaseConfigured;
}

export function getCachedUser() {
  return _cachedUser;
}

export function setCachedUser(user) {
  _cachedUser = user || null;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase not configured");

  const returnTo = window.location.origin + window.location.pathname;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: returnTo }
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  _cachedUser = null;
}

export function onAuthChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    _cachedUser = session?.user ?? null;
    callback(event, session?.user ?? null);
  });
  return data.subscription;
}
