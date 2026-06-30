const STORAGE_KEY = "auto-enhance-images";

export function getAutoEnhancePreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

export function setAutoEnhancePreference(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
}
