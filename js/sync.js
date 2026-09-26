// js/sync.js — Cloud sync layer (Supabase backed)
// Behaviour:
//   - On sign-in: pull cloud row. If none, push local (first device wins).
//   - On every save: debounced push to cloud (~2s).
//   - localStorage remains the offline cache.
//   - Last-write-wins conflict resolution (fine for single-user).

import { supabase } from "./supabase.js";
import { getCachedUser } from "./auth.js";
import { getState, setState, normalize } from "./state.js";
import { toast } from "./utils.js";

let _syncStatus = "idle";
const _listeners = new Set();
let _pushTimer = null;

export function getSyncStatus(){
  return _syncStatus;
}

function setStatus(s){
  _syncStatus = s;
  _listeners.forEach(cb => cb(s));
}

export function onSyncChange(cb){
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// -- Pull cloud row on sign-in. Replace local with cloud if it exists.
export async function pullAndReplaceLocal(){
  const user = getCachedUser();
  if (!user || !supabase) return false;

  setStatus("syncing");
  try {
    const { data, error } = await supabase
      .from("grids")
      .select("state, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data){
      await pushNow();
      toast("Grid uploaded to cloud");
      return true;
    }

    const cloudState = normalize(data.state);
    setState(cloudState);
    localStorage.setItem("success-grid-v6", JSON.stringify(cloudState));
    setStatus("synced");
    toast("Synced from cloud");
    return true;
  } catch(e){
    console.error("Sync pull failed", e);
    setStatus("error");
    toast("Sync failed");
    return false;
  }
}

// -- Debounced push. Called on every state save.
export function schedulePush(){
  const user = getCachedUser();
  if (!user || !supabase) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => pushNow(), 2000);
}

// -- Immediate push.
export async function pushNow(){
  const user = getCachedUser();
  if (!user || !supabase) return;

  if (_pushTimer){
    clearTimeout(_pushTimer);
    _pushTimer = null;
  }

  setStatus("syncing");
  try {
    const state = getState();
    const { error } = await supabase
      .from("grids")
      .upsert({
        user_id: user.id,
        state: state,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
    setStatus("synced");
  } catch(e){
    console.error("Sync push failed", e);
    setStatus("error");
  }
}
