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
};

export class PortalError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function requireMerchant(request: NextRequest): Promise<MerchantContext> {
  const accessToken = bearer(request);
  if (!accessToken) throw new PortalError("authentication_required", 401);

  const userDb = createServerUserClient(accessToken);
  const service = createServerServiceClient();
  const { data: authData, error: authError } = await userDb.auth.getUser(accessToken);
  if (authError || !authData.user) throw new PortalError("invalid_session", 401);
  const user = authData.user;

  const { data: profile, error: profileError } = await service
    .from("users")
    .select("id, full_name, primary_email, preferred_language, theme, is_blocked, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new PortalError("profile_load_failed", 500);
  if (profile?.is_blocked) throw new PortalError("account_blocked", 403);

  let { data: merchant, error: merchantError } = await service
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (merchantError) throw new PortalError("merchant_load_failed", 500);

  let staff: Row | null = null;
  let isOwner = Boolean(merchant?.id);
  if (!merchant?.id) {
    const { data: staffRow, error: staffError } = await service
      .from("merchant_staff_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (staffError) throw new PortalError("staff_access_load_failed", 500);
    if (staffRow?.merchant_id) {
      staff = staffRow as Row;
      const result = await service.from("merchants").select("*").eq("id", staffRow.merchant_id).maybeSingle();
      if (result.error) throw new PortalError("merchant_load_failed", 500);
      merchant = result.data;
    }
  }

  if (!merchant?.id) throw new PortalError("merchant_account_required", 403);
  if (merchant.approval_status !== "approved") {
    if (merchant.approval_status === "rejected") {
      throw new PortalError("merchant_registration_rejected", 403);
    }
    throw new PortalError(isOwner ? "merchant_pending_approval" : "merchant_not_approved_for_staff", 403);
  }

  return {
    accessToken,
    user,
    userDb,
    service,
    profile: (profile ?? {}) as Row,
    merchant: merchant as Row,
    merchantId: String(merchant.id),
    isOwner,
    staff,
  };
}

export function canManage(context: MerchantContext, area: string) {
  if (context.isOwner) return true;
  const permissions = (context.staff?.permissions ?? {}) as Record<string, unknown>;
  const aliases: Record<string, string[]> = {
    overview: ["dashboard", "overview"],
    products: ["products", "catalog", "manage_products", "product_management"],
    requests: ["requests", "rfqs", "rfq", "quotes", "manage_requests"],
    orders: ["orders", "sales", "manage_orders"],
    branches: ["branches", "manage_branches"],
    notifications: ["notifications"],
    billing: ["billing"],
    payments: ["billing"],
    settings: ["settings"],
  };
  return (aliases[area] ?? [area]).some((key) => permissions[key] === true);
}

export function ownerOnly(context: MerchantContext) {
  if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
}
