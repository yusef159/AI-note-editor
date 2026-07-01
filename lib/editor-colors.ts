export interface EditorColor {
  name: string;
  value: string | null;
}

export const TEXT_COLORS: EditorColor[] = [
  { name: "Default", value: null },
  { name: "Black", value: "#09090b" },
  { name: "Slate", value: "#475569" },
  { name: "Gray", value: "#71717a" },
  { name: "Stone", value: "#78716c" },
  { name: "Red", value: "#dc2626" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#d97706" },
  { name: "Yellow", value: "#ca8a04" },
  { name: "Lime", value: "#65a30d" },
  { name: "Green", value: "#16a34a" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#0d9488" },
  { name: "Cyan", value: "#0891b2" },
  { name: "Sky", value: "#0284c7" },
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Purple", value: "#9333ea" },
  { name: "Fuchsia", value: "#c026d3" },
  { name: "Pink", value: "#db2777" },
];

export const HIGHLIGHT_COLORS: EditorColor[] = [
  { name: "None", value: null },
  { name: "Gray", value: "#e4e4e7" },
  { name: "Slate", value: "#e2e8f0" },
  { name: "Red", value: "#fecaca" },
  { name: "Rose", value: "#fecdd3" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Amber", value: "#fde68a" },
  { name: "Yellow", value: "#fef08a" },
  { name: "Lime", value: "#d9f99d" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Emerald", value: "#a7f3d0" },
  { name: "Teal", value: "#99f6e4" },
  { name: "Cyan", value: "#a5f3fc" },
  { name: "Sky", value: "#bae6fd" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Indigo", value: "#c7d2fe" },
  { name: "Violet", value: "#ddd6fe" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Fuchsia", value: "#f5d0fe" },
  { name: "Pink", value: "#fbcfe8" },
];
