import { v4 as uuidv4 } from "uuid";

/** UUID v4 that works over HTTP (crypto.randomUUID requires a secure context). */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return uuidv4();
}
