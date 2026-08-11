import {
  SESSION_AUTHOR_NAME_KEY,
  SESSION_SHOP_ID_KEY,
  SESSION_TOKEN_KEY,
  SHOP_ACCESS_TOKEN_COOKIE,
} from "../config";

export type TokenSource = "session" | "cookie" | "none";

const getSessionValue = (key: string): string => {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const setSessionValue = (key: string, value: string): void => {
  try {
    if (value) {
      globalThis.sessionStorage?.setItem(key, value);
    } else {
      globalThis.sessionStorage?.removeItem(key);
    }
  } catch {
    // Storage may be disabled by the browser. The in-memory React state still works.
  }
};

export const getSessionToken = (): string => getSessionValue(SESSION_TOKEN_KEY);

export const setSessionToken = (token: string): void =>
  setSessionValue(SESSION_TOKEN_KEY, token.trim());

export const getSessionShopId = (): string => getSessionValue(SESSION_SHOP_ID_KEY);

export const setSessionShopId = (shopId: string): void =>
  setSessionValue(SESSION_SHOP_ID_KEY, shopId.trim());

export const getSessionAuthorName = (): string =>
  getSessionValue(SESSION_AUTHOR_NAME_KEY);

export const setSessionAuthorName = (authorName: string): void =>
  setSessionValue(SESSION_AUTHOR_NAME_KEY, authorName.trim());

export const getCookieToken = (): string => {
  if (typeof document === "undefined") return "";

  const encodedName = `${encodeURIComponent(SHOP_ACCESS_TOKEN_COOKIE)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!cookie) return "";

  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return cookie.slice(encodedName.length);
  }
};

export const getEffectiveAccessToken = (
  sessionOverride: string,
  cookieToken: string,
): { token: string; source: TokenSource } => {
  const override = sessionOverride.trim();
  if (override) return { token: override, source: "session" };

  const cookie = cookieToken.trim();
  if (cookie) return { token: cookie, source: "cookie" };

  return { token: "", source: "none" };
};

const decodeBase64Url = (value: string): string => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded: unknown = JSON.parse(decodeBase64Url(payload));
    return decoded && typeof decoded === "object"
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const nonEmptyClaim = (
  payload: Record<string, unknown>,
  claim: string,
): string => {
  const value = payload[claim];
  return typeof value === "string" ? value.trim() : "";
};

export const deriveAuthorName = (token: string): string => {
  const payload = decodeJwtPayload(token);
  if (!payload) return "";

  for (const claim of ["fullName", "full_name", "name"]) {
    const value = nonEmptyClaim(payload, claim);
    if (value) return value;
  }

  const email =
    nonEmptyClaim(payload, "user_email") || nonEmptyClaim(payload, "email");
  return email ? email.split("@")[0].trim() : "";
};
