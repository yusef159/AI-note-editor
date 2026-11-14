const STORAGE_KEY = "sidebar-collapsed-groups";
const CHANGE_EVENT = "sidebar-collapsed-groups-change";
const EMPTY_GROUP_IDS: ReadonlySet<string> = new Set();

let cachedValue: string | null = null;
let cachedGroupIds = EMPTY_GROUP_IDS;

export function getCollapsedGroupIds(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY_GROUP_IDS;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== cachedValue) {
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      cachedGroupIds = new Set(
        Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : []
      );
      cachedValue = stored;
    }
  } catch {
    // Keep the current preference if storage is unavailable or invalid.
  }

  return cachedGroupIds;
}

export function getServerCollapsedGroupIds(): ReadonlySet<string> {
  return EMPTY_GROUP_IDS;
}

export function subscribeToCollapsedGroupIds(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function toggleCollapsedGroupId(id: string) {
  const next = new Set(getCollapsedGroupIds());
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Collapsing still works for this session when storage is unavailable.
  }
  cachedGroupIds = next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
