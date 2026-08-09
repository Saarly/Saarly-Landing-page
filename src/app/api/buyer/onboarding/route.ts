import { NextRequest, NextResponse } from "next/server";
import { PortalError, requireAuthenticatedUser } from "@/lib/merchant-auth";
import { cleanReferralCode } from "@/lib/referrals";

export const dynamic = "force-dynamic";

function value(input: unknown) {
  return String(input ?? "").trim();
}

function errorResponse(error: unknown) {
  if (error instanceof PortalError)
    return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("buyer onboarding error", error);
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "buyer_onboarding_failed",
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuthenticatedUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = value(body.fullName).slice(0, 160);
    const mobile = value(body.mobile).replace(/\s+/g, "").slice(0, 40);
    const primaryEmail = (
      value(body.primaryEmail) || value(context.user.email)
    )
      .toLowerCase()
      .slice(0, 320);
    const recoveryEmail = value(body.recoveryEmail)
      .toLowerCase()
      .slice(0, 320);
    const language = body.language === "en" ? "en" : "ar";
    const theme = body.theme === "dark" ? "dark" : "light";
    const referralCode = cleanReferralCode(value(body.referralCode));
    const referralDeviceFingerprint = value(
      body.referralDeviceFingerprint,
    ).slice(0, 512);
    const referralDeviceFamilyFingerprint = value(
      body.referralDeviceFamilyFingerprint,
    ).slice(0, 512);
    if (fullName.length < 2) throw new PortalError("full_name_required", 400);
    if (mobile.length < 7) throw new PortalError("mobile_required", 400);
    if (!primaryEmail) throw new PortalError("email_required", 400);

    const result = await context.userDb.rpc("complete_my_user_profile", {
      p_full_name: fullName,
      p_mobile: mobile,
      p_primary_email: primaryEmail,
      p_recovery_email: recoveryEmail || null,
      p_role: "buyer",
      p_preferred_language: language,
      p_theme: theme,
    });
    if (result.error)
      throw new PortalError(result.error.message || "profile_save_failed", 400);

    let referralResult: unknown = null;
    if (referralCode) {
      const referral = await context.userDb.rpc("register_confirmed_referral", {
        p_referral_code: referralCode,
        p_device_fingerprint: referralDeviceFingerprint,
        p_metadata: {
          source: "landing_buyer_profile_completion",
          device_family_fingerprint: referralDeviceFamilyFingerprint,
        },
      });
      if (referral.error) {
        console.error(
          "buyer referral registration failed",
          referral.error.message,
        );
      } else {
        referralResult = referral.data;
      }
    }

    return NextResponse.json({ data: result.data, referral: referralResult });
  } catch (error) {
    return errorResponse(error);
  }
}
