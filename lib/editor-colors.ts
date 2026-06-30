export interface EditorColor {
  name: string;
  value: string | null;
}

export const TEXT_COLORS: EditorColor[] = [
  { name: "Default", value: null },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#d97706" },
  { name: "Green", value: "#16a34a" },
  { name: "Teal", value: "#0d9488" },
  { name: "Blue", value: "#2563eb" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Purple", value: "#9333ea" },
  { name: "Pink", value: "#db2777" },
  { name: "Gray", value: "#71717a" },
];

export const HIGHLIGHT_COLORS: EditorColor[] = [
  { name: "None", value: null },
  { name: "Yellow", value: "#fef08a" },
  { name: "Lime", value: "#d9f99d" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Cyan", value: "#a5f3fc" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
];
