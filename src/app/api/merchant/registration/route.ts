import { NextRequest, NextResponse } from "next/server";
import { PortalError, requireAuthenticatedUser } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function errorResponse(error: unknown) {
  if (error instanceof PortalError)
    return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("merchant registration api", error);
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "registration_request_failed",
    },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const { user, userDb, service } = await requireAuthenticatedUser(request);
    const [
      { data: profile, error: profileError },
      { data: merchant, error: merchantError },
      locations,
      categories,
    ] = await Promise.all([
      service
        .from("users")
        .select(
          "id,full_name,mobile,primary_email,recovery_email,role,preferred_language,theme,is_blocked",
        )
        .eq("id", user.id)
        .maybeSingle(),
      service
        .from("merchants")
        .select(
          "*, merchant_categories(category_id,is_primary), branches(*), merchant_documents(kind,storage_bucket,storage_path,status,rejection_reason)",
        )
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      userDb.rpc("app_location_options"),
      service
        .from("categories")
        .select("id,name_ar,name_en,parent_id,display_order,is_active")
        .eq("is_active", true)
        .order("display_order")
        .order("name_ar"),
    ]);
    if (profileError) throw new PortalError("profile_load_failed", 500);
    if (merchantError) throw new PortalError("merchant_load_failed", 500);
    if (locations.error)
      throw new PortalError("location_options_load_failed", 500);
    if (categories.error) throw new PortalError("categories_load_failed", 500);
    return NextResponse.json({
      data: {
        user: { id: user.id, email: user.email ?? "" },
        profile,
        merchant,
        locations: locations.data ?? [],
        categories: categories.data ?? [],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, userDb, service } = await requireAuthenticatedUser(request);
    const body = (await request.json()) as Row;
    const action = clean(body.action);

    if (action === "complete_profile") {
      const role = clean(body.role || "merchant");
      if (role !== "merchant") throw new PortalError("merchant_role_required");
      const { data, error } = await userDb.rpc("complete_my_user_profile", {
        p_full_name: clean(body.fullName),
        p_mobile: clean(body.mobile),
        p_primary_email: clean(body.email || user.email),
        p_recovery_email: clean(body.recoveryEmail) || null,
        p_role: "merchant",
        p_preferred_language: clean(body.locale) === "en" ? "en" : "ar",
        p_theme: ["dark", "light", "system"].includes(clean(body.theme))
          ? clean(body.theme)
          : "system",
      });
      if (error) throw new PortalError(error.message, 400);
      return NextResponse.json({ data });
    }

    if (action === "submit_registration") {
      const { data: profile, error: profileError } = await service
        .from("users")
        .select("role,is_blocked")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw new PortalError("profile_load_failed", 500);
      if (!profile || profile.role !== "merchant")
        throw new PortalError("merchant_role_required", 403);
      if (profile.is_blocked) throw new PortalError("account_blocked", 403);
      const payload =
        body.payload &&
        typeof body.payload === "object" &&
        !Array.isArray(body.payload)
          ? body.payload
          : {};
      const { data, error } = await userDb.rpc(
        "submit_my_merchant_registration_with_referral_device",
        { p_payload: payload },
      );
      if (error) throw new PortalError(error.message, 400);
      return NextResponse.json({ data });
    }

    throw new PortalError("unsupported_registration_action");
  } catch (error) {
    return errorResponse(error);
  }
}
