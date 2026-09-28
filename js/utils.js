export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
export const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const todayISO = () => iso(new Date());
export const uid = () => Math.random().toString(36).slice(2,9);

export function mondayOf(d){
  const x = new Date(d); x.setHours(0,0,0,0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return iso(x);
}
export function daysUntil(dateStr){
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const a = d.setHours(0,0,0,0);
  const b = new Date().setHours(0,0,0,0);
  return Math.round((a - b) / 86400000);
}
export function vibrate(pattern){
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
}
export function fmtDate(dateStr){
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}
let toastTimer = null;
export function toast(msg){
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

export function greeting(name) {
  const h = new Date().getHours();
  let time = "Good evening";
  if (h < 12) time = "Good morning";
  else if (h < 17) time = "Good afternoon";
  const who = name && name.trim() ? `, ${name.trim()}` : "";
  return `${time}${who}`;
}