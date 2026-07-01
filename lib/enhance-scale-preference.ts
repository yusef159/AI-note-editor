const STORAGE_KEY = "enhance-scale";

export const ENHANCE_SCALE_MIN = 0;
export const ENHANCE_SCALE_MAX = 10;
export const ENHANCE_SCALE_DEFAULT = 2;

export function clampEnhanceScale(value: number): number {
  if (!Number.isFinite(value)) return ENHANCE_SCALE_DEFAULT;
  return Math.min(ENHANCE_SCALE_MAX, Math.max(ENHANCE_SCALE_MIN, value));
}

export function getEnhanceScalePreference(): number {
  if (typeof window === "undefined") return ENHANCE_SCALE_DEFAULT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return ENHANCE_SCALE_DEFAULT;
  const parsed = Number(stored);
  return clampEnhanceScale(parsed);
}

export function setEnhanceScalePreference(value: number): number {
  const clamped = clampEnhanceScale(value);
  localStorage.setItem(STORAGE_KEY, String(clamped));
  return clamped;
}
