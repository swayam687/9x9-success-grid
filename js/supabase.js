/// <reference types="vite/client" />
// js/supabase.js — Supabase client (singleton)
// Env vars are injected at build time by Vite (VITE_* prefix).
// If missing, the app still works — auth UI is simply hidden.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
