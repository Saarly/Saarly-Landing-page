import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  referrals,
  buyerAuth,
  buyerOnboarding,
  merchantForm,
  merchantRoute,
  merchantRegistrationUpload,
] =
  await Promise.all([
    read("../src/lib/referrals.ts"),
    read("../src/components/buyer-auth-form.tsx"),
    read("../src/app/api/buyer/onboarding/route.ts"),
    read("../src/components/merchant-registration-form.tsx"),
    read("../src/app/api/merchant/registration/route.ts"),
    read("../src/app/api/merchant/registration-upload/route.ts"),
  ]);

test("buyer signup sends referral code and device signals to the onboarding API", () => {
  assert.match(referrals, /referralDeviceFingerprint/);
  assert.match(referrals, /referralDeviceFamilyFingerprint/);
  assert.match(buyerAuth, /referralCodeFromBrowser/);
  assert.match(buyerAuth, /primaryEmail: profilePrimaryEmail/);
  assert.match(buyerAuth, /recoveryEmail: recoveryEmail\.trim\(\)\.toLowerCase\(\) \|\| null/);
  assert.match(buyerAuth, /referralDeviceFingerprint\(\)/);
  assert.match(buyerAuth, /referralDeviceFamilyFingerprint\(\)/);
  assert.match(buyerOnboarding, /register_confirmed_referral/);
  assert.match(buyerOnboarding, /landing_buyer_profile_completion/);
  assert.match(buyerOnboarding, /value\(body\.primaryEmail\) \|\| value\(context\.user\.email\)/);
  assert.match(buyerOnboarding, /p_recovery_email: recoveryEmail \|\| null/);
});

test("merchant registration stores referral device signals for approval-time counting", () => {
  assert.match(merchantForm, /setReferralCode/);
  assert.match(merchantForm, /cleanReferralCode\(referralCode\)/);
  assert.match(merchantForm, /referral_device_fingerprint/);
  assert.match(merchantForm, /referral_device_family_fingerprint/);
  assert.match(
    merchantRoute,
    /submit_my_merchant_registration_with_referral_device/,
  );
});

test("merchant registration documents match the mobile registration file contract", () => {
  assert.match(merchantRegistrationUpload, /MAX_DOCUMENT_BYTES = 5 \* 1024 \* 1024/);
  assert.match(merchantRegistrationUpload, /"image\/jpeg", "image\/png", "application\/pdf"/);
  assert.doesNotMatch(merchantRegistrationUpload, /image\/webp/);
  assert.match(merchantForm, /Image file — up to 5 megabytes/);
  assert.match(merchantForm, /Image or document — up to 5 megabytes/);
  assert.doesNotMatch(merchantForm, /image\/webp/);
  assert.match(merchantForm, /Clear file/);
});
