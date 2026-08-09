export function cleanReferralCode(value: string | null) {
  const code = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z0-9_-]{3,64}$/.test(code) ? code : "";
}

export function referralCodeFromBrowser() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const code = cleanReferralCode(
    params.get("code") || params.get("referral_code") || params.get("ref"),
  );
  return (
    code || cleanReferralCode(localStorage.getItem("saarly-referral-code"))
  );
}

export function rememberReferralCode(code: string) {
  if (typeof window === "undefined" || !code) return;
  localStorage.setItem("saarly-referral-code", code);
}

export function forgetReferralCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("saarly-referral-code");
}

export function referralDeviceFingerprint() {
  if (typeof window === "undefined") return "";
  const key = "saarly-referral-device-fingerprint-v1";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = `web:${randomBrowserId()}`;
  localStorage.setItem(key, generated);
  return generated;
}

export function referralDeviceFamilyFingerprint() {
  if (typeof window === "undefined") return "";
  const extendedNavigator = navigator as Navigator & {
    deviceMemory?: number;
  };
  const memory =
    "deviceMemory" in extendedNavigator
      ? String(extendedNavigator.deviceMemory ?? "")
      : "";
  return [
    "web-family-v1",
    navigator.platform || "",
    navigator.language || "",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.hardwareConcurrency || "",
    memory,
    navigator.maxTouchPoints || 0,
  ]
    .join("|")
    .toLowerCase();
}

function randomBrowserId() {
  const browserCrypto =
    typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (browserCrypto?.getRandomValues) {
    browserCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
