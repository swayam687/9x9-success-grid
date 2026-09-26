// js/icons.js — inline SVG icon set (Lucide-style, 1.75 stroke)
// Usage: import { icons } from "./icons.js";  →  icons.flame  (defaults 20px)
//        icon("flame", 16) for a custom size.

const svg = (path, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const P = {
  sun:          '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  grid:         '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar:     '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  activity:     '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  more:         '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  target:       '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  flame:        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check:        '<path d="M20 6 9 17l-5-5"/>',
  sparkles:     '<path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7z"/><path d="M19 4v4M21 6h-4M5 15v4M7 17H3"/>',
  folder:       '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  send:         '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  dumbbell:     '<path d="M6 12h12"/><circle cx="4.5" cy="12" r="2.5"/><circle cx="19.5" cy="12" r="2.5"/>',
  scale:        '<path d="M12 3v18"/><path d="M3 8h18"/><path d="M6 8 3 15a3 3 0 0 0 6 0z"/><path d="M18 8l-3 7a3 3 0 0 0 6 0z"/>',
  code:         '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  download:     '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M3 21h18"/>',
  upload:       '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M3 3h18"/>',
  alert:        '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  palette:      '<circle cx="13.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r=".7" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r=".7" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r=".7" fill="currentColor" stroke="none"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.6-.2-1.1-.6-1.5-.4-.4-.6-.9-.6-1.5 0-1.1.9-2 2-2h2.2A4.5 4.5 0 0 0 22 10.5C22 5.8 17.5 2 12 2z"/>',
  sliders:      '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  wand:         '<path d="m21 3-9 9M3 21l4-4"/><path d="M14 4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM19 10l.5 1.2L20.7 12l-1.2.5L19 13.7l-.5-1.2L17.3 12l1.2-.5z"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  plus:         '<path d="M12 5v14M5 12h14"/>',
  x:            '<path d="M18 6 6 18M6 6l12 12"/>'
};

export const icon = (name, size = 20) => svg(P[name] || P.target, size);
export const icons = Object.fromEntries(Object.keys(P).map(k => [k, svg(P[k])]));