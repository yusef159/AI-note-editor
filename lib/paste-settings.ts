import {
  ENHANCE_SCALE_DEFAULT,
  clampEnhanceScale,
} from "@/lib/enhance-scale-preference";

const STORAGE_KEY = "paste-settings";
const LEGACY_AUTO_ENHANCE_KEY = "auto-enhance-images";
const LEGACY_SCALE_KEY = "enhance-scale";

export type PasteMode =
  | "original"
  | "enhanced"
  | "text_only"
  | "text_original"
  | "text_enhanced";

export interface PasteSettings {
  mode: PasteMode;
  enhanceScale: number;
}

const DEFAULT_SETTINGS: PasteSettings = {
  mode: "enhanced",
  enhanceScale: ENHANCE_SCALE_DEFAULT,
};

const VALID_MODES = new Set<PasteMode>([
  "original",
  "enhanced",
  "text_only",
  "text_original",
  "text_enhanced",
]);

export function modeUsesEnhancement(mode: PasteMode): boolean {
  return mode === "enhanced" || mode === "text_enhanced";
}

export function modeUsesExtract(mode: PasteMode): boolean {
  return mode === "text_only" || mode === "text_original" || mode === "text_enhanced";
}

function migrateLegacySettings(): PasteSettings | null {
  if (typeof window === "undefined") return null;

  const legacyAutoEnhance = localStorage.getItem(LEGACY_AUTO_ENHANCE_KEY);
  const legacyScale = localStorage.getItem(LEGACY_SCALE_KEY);

  if (legacyAutoEnhance === null && legacyScale === null) {
    return null;
  }

  let mode: PasteMode = "enhanced";
  if (legacyAutoEnhance === "false") {
    mode = "original";
  }

  let enhanceScale = ENHANCE_SCALE_DEFAULT;
  if (legacyScale !== null) {
    enhanceScale = clampEnhanceScale(Number(legacyScale));
  }

  return { mode, enhanceScale };
}

function parseStoredSettings(raw: string): PasteSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PasteSettings>;
    if (!parsed.mode || !VALID_MODES.has(parsed.mode)) return null;

    return {
      mode: parsed.mode,
      enhanceScale: clampEnhanceScale(
        parsed.enhanceScale ?? ENHANCE_SCALE_DEFAULT
      ),
    };
  } catch {
    return null;
  }
}

export function getPasteSettings(): PasteSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseStoredSettings(stored);
    if (parsed) return parsed;
  }

  const migrated = migrateLegacySettings();
  if (migrated) {
    setPasteSettings(migrated);
    return migrated;
  }

  return { ...DEFAULT_SETTINGS };
}

export function setPasteSettings(settings: PasteSettings): PasteSettings {
  const normalized: PasteSettings = {
    mode: VALID_MODES.has(settings.mode) ? settings.mode : DEFAULT_SETTINGS.mode,
    enhanceScale: clampEnhanceScale(settings.enhanceScale),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function updatePasteMode(mode: PasteMode): PasteSettings {
  return setPasteSettings({ ...getPasteSettings(), mode });
}

export function updateEnhanceScale(enhanceScale: number): PasteSettings {
  return setPasteSettings({
    ...getPasteSettings(),
    enhanceScale: clampEnhanceScale(enhanceScale),
  });
}
