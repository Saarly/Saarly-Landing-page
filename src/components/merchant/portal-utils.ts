export type PortalRow = Record<string, unknown>;
export type PortalPayload = {
  account: {
    userId: string;
    email: string;
    profile: PortalRow;
    merchant: PortalRow;
    merchantId: string;
    isOwner: boolean;
    staff: PortalRow | null;
  };
  section: string;
  data: PortalRow;
};

export function row(value: unknown): PortalRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PortalRow : {};
}

export function rows(value: unknown): PortalRow[] {
  return Array.isArray(value) ? value.filter((item): item is PortalRow => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

export function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function dateLabel(value: unknown, locale: "ar" | "en") {
  const raw = text(value);
  if (!raw) return locale === "ar" ? "غير محدد" : "Not set";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function money(value: unknown, currency: unknown = "EGP", locale: "ar" | "en" = "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: text(currency, "EGP").trim() || "EGP",
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

export const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  pending_merchant_confirmation: { ar: "بانتظار تأكيد المتجر", en: "Awaiting store confirmation" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  active: { ar: "فعّال", en: "Active" },
  trialing: { ar: "فترة مجانية", en: "Free trial" },
  free_trial: { ar: "فترة مجانية", en: "Free trial" },
  pre_launch_access: { ar: "وصول قبل بدء المحاسبة", en: "Pre-launch access" },
  subscription_active: { ar: "اشتراك فعّال", en: "Active subscription" },
  commission_active: { ar: "نظام العمولة فعّال", en: "Commission active" },
  grace_period: { ar: "فترة سماح", en: "Grace period" },
  past_due: { ar: "مستحق", en: "Past due" },
  suspended: { ar: "موقوف", en: "Suspended" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
  expired: { ar: "منتهي", en: "Expired" },
  submitted: { ar: "تم الإرسال", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  cancelled_by_merchant: { ar: "ألغاه المتجر", en: "Cancelled by store" },
  open: { ar: "مفتوح", en: "Open" },
  manual_quote: { ar: "تسعير يدوي", en: "Manual quote" },
  catalog: { ar: "كتالوج وأسعار", en: "Catalog" },
  monthly_subscription: { ar: "اشتراك", en: "Subscription" },
  commission: { ar: "عمولة", en: "Commission" },
};

export function statusLabel(value: unknown, locale: "ar" | "en") {
  const key = text(value, "unknown");
  return STATUS_LABELS[key]?.[locale] ?? key.replaceAll("_", " ");
}

export function statusTone(value: unknown) {
  const key = text(value);
  if (["approved", "active", "confirmed", "subscription_active", "commission_active"].includes(key)) return "success";
  if (["rejected", "suspended", "cancelled", "cancelled_by_merchant", "expired"].includes(key)) return "danger";
  if (["pending", "under_review", "trialing", "free_trial", "grace_period", "past_due", "pending_merchant_confirmation"].includes(key)) return "warning";
  return "neutral";
}
