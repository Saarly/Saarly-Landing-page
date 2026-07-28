import { NextRequest, NextResponse } from "next/server";
import { PortalError, requireAuthenticatedUser } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

function value(input: unknown) { return String(input ?? "").trim(); }

function errorResponse(error: unknown) {
  if (error instanceof PortalError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("buyer onboarding error", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "buyer_onboarding_failed" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuthenticatedUser(request);
    const body = await request.json() as Record<string, unknown>;
    const fullName = value(body.fullName).slice(0, 160);
    const mobile = value(body.mobile).replace(/\s+/g, "").slice(0, 40);
    const primaryEmail = value(context.user.email).toLowerCase();
    const recoveryEmail = value(body.recoveryEmail).toLowerCase().slice(0, 320) || primaryEmail;
    const language = body.language === "en" ? "en" : "ar";
    const theme = body.theme === "dark" ? "dark" : "light";
    if (fullName.length < 2) throw new PortalError("full_name_required", 400);
    if (mobile.length < 7) throw new PortalError("mobile_required", 400);
    if (!primaryEmail) throw new PortalError("email_required", 400);

    const result = await context.userDb.rpc("complete_my_user_profile", {
      p_full_name: fullName,
      p_mobile: mobile,
      p_primary_email: primaryEmail,
      p_recovery_email: recoveryEmail,
      p_role: "buyer",
      p_preferred_language: language,
      p_theme: theme,
    });
    if (result.error) throw new PortalError(result.error.message || "profile_save_failed", 400);
    return NextResponse.json({ data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
