import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PortalError, requireAuthenticatedUser, type Row } from "@/lib/merchant-auth";

export type BuyerContext = {
  accessToken: string;
  user: User;
  userDb: SupabaseClient;
  service: SupabaseClient;
  profile: Row;
  ownMerchant: Row | null;
  ownMerchantId: string;
  isMerchantOwner: boolean;
  staff: Row | null;
  currencyCode: string;
};

function value(input: unknown) {
  return String(input ?? "").trim();
}

export async function requireBuyer(request: NextRequest): Promise<BuyerContext> {
  const auth = await requireAuthenticatedUser(request);
  const { user, userDb, service, accessToken } = auth;

  const { data: profile, error: profileError } = await service
    .from("users")
    .select("id,full_name,mobile,primary_email,recovery_email,role,preferred_language,theme,is_blocked")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new PortalError("profile_load_failed", 500);
  if (!profile) throw new PortalError("profile_incomplete", 403);
  if (profile.is_blocked) throw new PortalError("account_blocked", 403);
  if (!["buyer", "merchant"].includes(String(profile.role))) {
    throw new PortalError("buyer_access_required", 403);
  }

  const merchantResult = await service
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (merchantResult.error) throw new PortalError("merchant_load_failed", 500);
  const ownMerchant = merchantResult.data as Row | null;

  const staffResult = await service
    .from("merchant_staff_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (staffResult.error) throw new PortalError("staff_access_load_failed", 500);

  if (profile.role === "merchant") {
    if (!ownMerchant?.id) throw new PortalError("merchant_registration_required", 403);
    if (ownMerchant.approval_status !== "approved") {
      throw new PortalError(
        ownMerchant.approval_status === "rejected" ? "merchant_registration_rejected" : "merchant_pending_approval",
        403,
      );
    }
    if (ownMerchant.manually_suspended_at) throw new PortalError("merchant_suspended", 403);
  }

  const location = await userDb.rpc("my_buyer_location");
  const locationRow = location.error || !location.data || typeof location.data !== "object"
    ? {}
    : location.data as Row;

  return {
    accessToken,
    user,
    userDb,
    service,
    profile: profile as Row,
    ownMerchant,
    ownMerchantId: value(ownMerchant?.id),
    isMerchantOwner: Boolean(ownMerchant?.id && ownMerchant.approval_status === "approved"),
    staff: staffResult.data as Row | null,
    currencyCode: value(locationRow.currency_code) || "EGP",
  };
}
