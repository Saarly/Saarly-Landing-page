import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("src/lib/merchant-auth.ts");
const api = read("src/app/api/merchant/portal/route.ts");
const login = read("src/components/auth-forms.tsx");
const support = read("src/app/api/support/route.ts");
const layout = read("src/app/layout.tsx");
const publicSite = read("src/components/public-site.tsx");
const css = read("src/app/globals.css");

test("merchant portal verifies bearer session and merchant relation", () => {
  assert.match(auth, /auth\.getUser\(accessToken\)/);
  assert.match(auth, /merchant_account_required/);
  assert.match(auth, /merchant_pending_approval/);
  assert.match(auth, /merchant_registration_rejected/);
});

test("buyer-only account is signed out after portal verification fails", () => {
  assert.match(login, /fetch\("\/api\/merchant\/portal\?section=overview"/);
  assert.match(login, /await supabase\.auth\.signOut\(/);
});

test("financial values are calculated by trusted server RPCs", () => {
  assert.match(api, /portal_create_manual_subscription_payment_request_as/);
  assert.match(api, /portal_set_billing_preference_as/);
  assert.doesNotMatch(api, /original_amount\s*:\s*body/);
  assert.doesNotMatch(api, /final_amount\s*:\s*body/);
});

test("RFQ replies respect account receiving status", () => {
  assert.match(api, /can_receive_orders/);
  assert.match(api, /merchant_not_receiving_requests/);
});

test("public support and deletion requests reach server routes", () => {
  assert.match(publicSite, /fetch\("\/api\/support"/);
  assert.match(support, /portal_submit_public_support_request/);
});

test("root layout installs bilingual theme provider", () => {
  assert.match(layout, /SitePreferencesProvider/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /prefers-reduced-motion/);
});

test("site has no external stock-photo dependency or invalid merchant column", () => {
  const source = [publicSite, css, api].join("\n");
  assert.doesNotMatch(source, /images\.unsplash\.com/);
  assert.doesNotMatch(source, /subscription_status/);
});

test("service role is server-only", () => {
  const client = read("src/lib/supabase.ts");
  assert.doesNotMatch(client, /SERVICE_ROLE/);
  assert.doesNotMatch(publicSite, /SERVICE_ROLE/);
});

test("merchant portal exposes every required operating section", () => {
  const portal = read("src/components/merchant-portal.tsx");
  for (const section of ["StoreSection", "ProductsSection", "RequestsSection", "OrdersSection", "BranchesSection", "EmployeesSection", "NotificationsSection", "BillingSection", "PaymentsSection", "SettingsSection"]) {
    assert.match(portal, new RegExp(section));
  }
});

test("private merchant uploads are authorized and scoped", () => {
  const upload = read("src/app/api/merchant/upload/route.ts");
  assert.match(upload, /requireMerchant\(request\)/);
  assert.match(upload, /merchant-payment-proofs/);
  assert.match(upload, /context\.merchantId.*portal-payments/s);
  assert.match(upload, /merchant-ids/);
  assert.match(upload, /unsupported_file_type/);
  assert.match(upload, /file_too_large/);
});

test("portal supports real product, order, billing, and preference mutations", () => {
  for (const action of ["save_product", "import_products", "update_order", "create_manual_payment", "set_billing_preference", "save_preferences", "delete_account"]) {
    assert.match(api, new RegExp(`action === \\"${action}\\"`));
  }
});

test("legal pages use app-aligned dated policy content", () => {
  const content = read("src/lib/site-content.ts");
  assert.match(content, /21 يوليو 2026/);
  assert.match(content, /19 يوليو 2026/);
  assert.match(content, /Supabase/);
  assert.match(content, /OpenAI/);
  assert.match(content, /TomTom/);
});

test("portal GET enforces staff section permissions on the server", () => {
  assert.match(api, /section_permission_required/);
  assert.match(api, /!canManage\(context, section\)/);
  assert.match(api, /section === "employees"\) ownerOnly\(context\)/);
});

test("staff permissions stay aligned with the Flutter merchant workspace", () => {
  const employees = read("src/components/merchant/sections/employees-section.tsx");
  for (const permission of ["dashboard", "orders", "rfqs", "products", "imports", "branches", "hours", "delivery", "reports", "billing", "notifications", "referrals", "support", "settings", "buyer_mode"]) {
    assert.match(employees, new RegExp(`key: \\"${permission}\\"`));
  }
});


test("merchant sign-in uses email OTP with an actual remember-device setting", () => {
  const client = read("src/lib/supabase.ts");
  assert.match(login, /signInWithOtp/);
  assert.match(login, /verifyOtp/);
  assert.match(login, /shouldCreateUser:\s*false/);
  assert.match(login, /تذكرني على هذا الجهاز/);
  assert.match(client, /sessionStorage/);
  assert.match(client, /localStorage/);
});

test("support requests create an admin workflow and queue an email notification", () => {
  assert.match(support, /start_or_get_support_conversation/);
  assert.match(support, /admin_email_events/);
  assert.match(support, /process-admin-email-events/);
  assert.match(support, /info@saarly\.app/);
});

test("landing removes the categories section and presents buyer and merchant journeys", () => {
  const content = read("src/lib/site-content.ts");
  assert.doesNotMatch(publicSite, /id="categories"/);
  assert.doesNotMatch(content, /href:\s*"\/#categories"/);
  assert.match(publicSite, /buyer-journey/);
  assert.match(publicSite, /merchant-journey/);
  assert.match(publicSite, /hero-title-accent/);
});
