import en, { type MessageKey } from "./en";
import it from "./it";

const catalogs: Record<string, Record<MessageKey, string>> = {
  en,
  it,
};

export type Locale = "en" | "it";

export function resolveLocale(raw?: string | null): Locale {
  const v = (raw || (typeof navigator !== "undefined" ? navigator.language : "en") || "en")
    .toLowerCase()
    .split("-")[0];
  return v === "it" ? "it" : "en";
}

/** Simple `{name}` interpolation; missing vars are left as-is. */
export function t(
  key: MessageKey,
  locale?: string | null,
  vars?: Record<string, string | number>,
): string {
  const loc = resolveLocale(locale);
  let msg = catalogs[loc][key] ?? catalogs.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      msg = msg.split(`{${name}}`).join(String(value));
    }
  }
  return msg;
}

export type { MessageKey };
