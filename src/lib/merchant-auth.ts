import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerServiceClient, createServerUserClient } from "@/lib/supabase/server";

export type Row = Record<string, unknown>;

export type MerchantContext = {
  accessToken: string;
  user: User;
  userDb: SupabaseClient;
  service: SupabaseClient;
  profile: Row;
  merchant: Row;
  merchantId: string;
  isOwner: boolean;
  staff: Row | null;
  branchIds: string[];
  currencyCode: string;
};

export class PortalError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

export function bearerToken(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function asUuidList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const accessToken = bearerToken(request);
  if (!accessToken) throw new PortalError("authentication_required", 401);
  const userDb = createServerUserClient(accessToken);
  const service = createServerServiceClient();
  const { data, error } = await userDb.auth.getUser(accessToken);
  if (error || !data.user) throw new PortalError("invalid_session", 401);
  return { accessToken, user: data.user, userDb, service };
}

export async function requireMerchant(request: NextRequest): Promise<MerchantContext> {
  const auth = await requireAuthenticatedUser(request);
  const { user, userDb, service, accessToken } = auth;

  const { data: profile, error: profileError } = await service
    .from("users")
    .select("id, full_name, primary_email, mobile, preferred_language, theme, is_blocked, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new PortalError("profile_load_failed", 500);
  if (!profile) throw new PortalError("profile_incomplete", 403);
  if (profile.is_blocked) throw new PortalError("account_blocked", 403);

  let merchant: Row | null = null;
  let staff: Row | null = null;
  let isOwner = false;

  if (profile.role === "merchant") {
    const ownerResult = await service
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ownerResult.error) throw new PortalError("merchant_load_failed", 500);
    if (ownerResult.data?.id) {
      merchant = ownerResult.data as Row;
      isOwner = true;
    }
  }

  if (!merchant) {
    const staffResult = await service
      .from("merchant_staff_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (staffResult.error) throw new PortalError("staff_access_load_failed", 500);
    if (staffResult.data?.merchant_id) {
      staff = staffResult.data as Row;
      const merchantResult = await service
        .from("merchants")
        .select("*")
        .eq("id", staffResult.data.merchant_id)
        .eq("is_archived", false)
        .maybeSingle();
      if (merchantResult.error) throw new PortalError("merchant_load_failed", 500);
      merchant = merchantResult.data as Row | null;
    }
  }

  if (!merchant?.id) {
    if (profile.role === "buyer") throw new PortalError("buyer_account_not_allowed", 403);
    throw new PortalError("merchant_account_required", 403);
  }

  if (merchant.approval_status !== "approved") {
    if (merchant.approval_status === "rejected") throw new PortalError("merchant_registration_rejected", 403);
    throw new PortalError(isOwner ? "merchant_pending_approval" : "merchant_not_approved_for_staff", 403);
  }
  if (merchant.manually_suspended_at) throw new PortalError("merchant_suspended", 403);

  const merchantId = String(merchant.id);
  const branchIds = isOwner ? [] : asUuidList(staff?.branch_ids);
  let currencyQuery = service
    .from("branches")
    .select("city:cities(currency_code)")
    .eq("merchant_id", merchantId)
    .eq("approval_status", "approved");
  if (!isOwner && branchIds.length > 0) currencyQuery = currencyQuery.in("id", branchIds);
  const { data: currencyRows } = await currencyQuery
    .order("created_at", { ascending: true })
    .limit(1);
  const city = Array.isArray(currencyRows) && currencyRows[0] && typeof currencyRows[0] === "object"
    ? (currencyRows[0] as Row).city
    : null;
  const cityRow = city && typeof city === "object" && !Array.isArray(city) ? city as Row : {};

  return {
    accessToken,
    user,
    userDb,
    service,
    profile: profile as Row,
    merchant,
    merchantId,
    isOwner,
    staff,
    branchIds,
    currencyCode: String(cityRow.currency_code ?? "EGP"),
  };
}

export function canManage(context: MerchantContext, area: string) {
  if (context.isOwner) return true;
  const permissions = (context.staff?.permissions ?? {}) as Record<string, unknown>;
  const aliases: Record<string, string[]> = {
    overview: ["dashboard", "overview"],
    products: ["products", "catalog", "manage_products", "product_management"],
    imports: ["imports", "products"],
    requests: ["requests", "rfqs", "rfq", "quotes", "manage_requests"],
    orders: ["orders", "sales", "manage_orders"],
    branches: ["branches", "manage_branches"],
    hours: ["hours"],
    delivery: ["delivery"],
    reports: ["reports"],
    reviews: ["reports", "reviews"],
    "account-status": ["account_status", "dashboard", "settings"],
    subscriptions: ["billing", "subscriptions", "account_status"],
    notifications: ["notifications", "dashboard"],
    referrals: ["referrals"],
    support: ["support"],
    settings: ["settings"],
    buyer: ["buyer_mode"],
  };
  return (aliases[area] ?? [area]).some((key) => permissions[key] === true);
}

export function ownerOnly(context: MerchantContext) {
  if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
}

export function allowedBranchIds(context: MerchantContext) {
  return context.isOwner || context.branchIds.length === 0 ? null : new Set(context.branchIds);
}

export function assertBranchAccess(context: MerchantContext, branchId: string | null | undefined) {
  const allowed = allowedBranchIds(context);
  if (!allowed || !branchId) return;
  if (!allowed.has(branchId)) throw new PortalError("branch_scope_required", 403);
}
