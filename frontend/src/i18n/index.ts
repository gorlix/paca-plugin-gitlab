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

export function t(key: MessageKey, locale?: string | null): string {
  const loc = resolveLocale(locale);
  return catalogs[loc][key] ?? catalogs.en[key] ?? key;
}

export type { MessageKey };
