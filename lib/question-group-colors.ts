export interface QuestionGroupColorTheme {
  id: string;
  name: string;
  swatch: string;
  border: string;
  background: string;
  header: string;
  divider: string;
  accent: string;
}

const LIGHT_THEMES: QuestionGroupColorTheme[] = [
  {
    id: "indigo",
    name: "Indigo",
    swatch: "#6366f1",
    border: "#c7d2fe",
    background: "#f8fafc",
    header: "#4338ca",
    divider: "#e0e7ff",
    accent: "#6366f1",
  },
  {
    id: "blue",
    name: "Blue",
    swatch: "#3b82f6",
    border: "#bfdbfe",
    background: "#f0f9ff",
    header: "#1d4ed8",
    divider: "#dbeafe",
    accent: "#3b82f6",
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "#8b5cf6",
    border: "#ddd6fe",
    background: "#f5f3ff",
    header: "#6d28d9",
    divider: "#ede9fe",
    accent: "#8b5cf6",
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#f43f5e",
    border: "#fecdd3",
    background: "#fff1f2",
    header: "#be123c",
    divider: "#ffe4e6",
    accent: "#f43f5e",
  },
  {
    id: "amber",
    name: "Amber",
    swatch: "#f59e0b",
    border: "#fde68a",
    background: "#fffbeb",
    header: "#b45309",
    divider: "#fef3c7",
    accent: "#f59e0b",
  },
  {
    id: "emerald",
    name: "Emerald",
    swatch: "#10b981",
    border: "#a7f3d0",
    background: "#ecfdf5",
    header: "#047857",
    divider: "#d1fae5",
    accent: "#10b981",
  },
  {
    id: "teal",
    name: "Teal",
    swatch: "#14b8a6",
    border: "#99f6e4",
    background: "#f0fdfa",
    header: "#0f766e",
    divider: "#ccfbf1",
    accent: "#14b8a6",
  },
  {
    id: "slate",
    name: "Slate",
    swatch: "#64748b",
    border: "#cbd5e1",
    background: "#f8fafc",
    header: "#334155",
    divider: "#e2e8f0",
    accent: "#64748b",
  },
];

const DARK_THEME_OVERRIDES: Record<
  string,
  Pick<QuestionGroupColorTheme, "border" | "background" | "header" | "divider" | "accent">
> = {
  indigo: {
    border: "#3730a3",
    background: "#0f172a",
    header: "#a5b4fc",
    divider: "#312e81",
    accent: "#818cf8",
  },
  blue: {
    border: "#1e3a8a",
    background: "#0c1222",
    header: "#93c5fd",
    divider: "#1e3a8a",
    accent: "#60a5fa",
  },
  violet: {
    border: "#5b21b6",
    background: "#120a1f",
    header: "#c4b5fd",
    divider: "#4c1d95",
    accent: "#a78bfa",
  },
  rose: {
    border: "#9f1239",
    background: "#1c0a10",
    header: "#fda4af",
    divider: "#881337",
    accent: "#fb7185",
  },
  amber: {
    border: "#92400e",
    background: "#1a1208",
    header: "#fcd34d",
    divider: "#78350f",
    accent: "#fbbf24",
  },
  emerald: {
    border: "#065f46",
    background: "#061510",
    header: "#6ee7b7",
    divider: "#064e3b",
    accent: "#34d399",
  },
  teal: {
    border: "#115e59",
    background: "#061413",
    header: "#5eead4",
    divider: "#134e4a",
    accent: "#2dd4bf",
  },
  slate: {
    border: "#334155",
    background: "#0f172a",
    header: "#cbd5e1",
    divider: "#1e293b",
    accent: "#94a3b8",
  },
};

export const DEFAULT_QUESTION_GROUP_COLOR = "indigo";

export const QUESTION_GROUP_COLORS = LIGHT_THEMES;

export function isDarkMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getQuestionGroupTheme(
  colorId?: string | null,
  dark = isDarkMode()
): QuestionGroupColorTheme {
  const base =
    LIGHT_THEMES.find((theme) => theme.id === colorId) ?? LIGHT_THEMES[0];

  if (!dark) return base;

  const override = DARK_THEME_OVERRIDES[base.id];
  return override ? { ...base, ...override } : base;
}

export function applyQuestionGroupTheme(
  container: HTMLElement,
  colorId: string | null | undefined,
  options?: {
    header?: HTMLElement | null;
    headerRow?: HTMLElement | null;
    dark?: boolean;
  }
): QuestionGroupColorTheme {
  const theme = getQuestionGroupTheme(colorId, options?.dark);
  container.style.borderColor = theme.border;
  container.style.backgroundColor = theme.background;
  container.setAttribute("data-group-color", theme.id);

  if (options?.header) {
    options.header.style.color = theme.header;
  }

  if (options?.headerRow) {
    options.headerRow.style.borderBottomColor = theme.divider;
  }

  return theme;
}

export function stylePdfGroupWrapper(
  wrapper: HTMLElement,
  segmentClass: string,
  colorId?: string | null
): void {
  const theme = getQuestionGroupTheme(colorId, false);

  wrapper.style.background = theme.background;
  wrapper.style.margin = segmentClass === "qg-pdf-end" ? "0 0 0.5rem" : "0";
  wrapper.style.padding =
    segmentClass === "qg-pdf-start"
      ? "0.75rem 1rem 0.5rem"
      : segmentClass === "qg-pdf-end"
        ? "0.5rem 1rem 0.75rem"
        : "0.5rem 1rem";

  if (segmentClass === "qg-pdf-closed") {
    wrapper.style.border = `1px solid ${theme.border}`;
    wrapper.style.borderRadius = "10px";
    wrapper.style.padding = "0.75rem 1rem 1rem";
    return;
  }

  if (segmentClass === "qg-pdf-start") {
    wrapper.style.border = `1px solid ${theme.border}`;
    wrapper.style.borderBottom = "none";
    wrapper.style.borderRadius = "10px 10px 0 0";
    return;
  }

  if (segmentClass === "qg-pdf-mid") {
    wrapper.style.borderLeft = `1px solid ${theme.border}`;
    wrapper.style.borderRight = `1px solid ${theme.border}`;
    wrapper.style.borderTop = "none";
    wrapper.style.borderBottom = "none";
    return;
  }

  wrapper.style.borderLeft = `1px solid ${theme.border}`;
  wrapper.style.borderRight = `1px solid ${theme.border}`;
  wrapper.style.borderBottom = `1px solid ${theme.border}`;
  wrapper.style.borderTop = "none";
  wrapper.style.borderRadius = "0 0 10px 10px";
}

export function stylePdfGroupHeader(
  header: HTMLElement,
  colorId?: string | null
): void {
  const theme = getQuestionGroupTheme(colorId, false);
  header.style.color = theme.header;
  header.style.borderBottom = `1px solid ${theme.divider}`;
}

export function stylePdfContinuedLabel(
  label: HTMLElement,
  colorId?: string | null
): void {
  label.style.color = getQuestionGroupTheme(colorId, false).accent;
}

export function generateQuestionGroupColorCss(selector = ".question-group"): string {
  return LIGHT_THEMES.map((theme) => {
    const dark = DARK_THEME_OVERRIDES[theme.id];
    return `
${selector}[data-group-color="${theme.id}"] {
  border-color: ${theme.border};
  background: ${theme.background};
}
${selector}[data-group-color="${theme.id}"] .question-group-header,
${selector}[data-group-color="${theme.id}"] .question-group-header-input {
  color: ${theme.header};
  border-bottom-color: ${theme.divider};
}
@media (prefers-color-scheme: dark) {
  ${selector}[data-group-color="${theme.id}"] {
    border-color: ${dark.border};
    background: ${dark.background};
  }
  ${selector}[data-group-color="${theme.id}"] .question-group-header,
  ${selector}[data-group-color="${theme.id}"] .question-group-header-input {
    color: ${dark.header};
    border-bottom-color: ${dark.divider};
  }
}`;
  }).join("\n");
}
