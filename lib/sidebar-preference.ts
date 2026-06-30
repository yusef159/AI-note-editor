const STORAGE_KEY = "sidebar-collapsed";

export function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setSidebarCollapsed(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
}
