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

test("merchant Saarly subscription actions are web-only and server guarded", () => {
  const portalUtils = read("src/components/merchant/portal-utils.ts");
  assert.match(api, /my_monetization_dashboard/);
  assert.match(api, /section === "account-status"/);
  assert.match(api, /section === "subscriptions"/);
  assert.match(api, /ownerOnly\(context\)/);
  assert.match(api, /portal_create_manual_subscription_payment_request/);
  assert.match(api, /portal_set_my_billing_preference/);
  assert.match(portalUtils, /\/merchant\/subscriptions/);
  assert.doesNotMatch(api, /portal_create_manual_subscription_payment_request_as/);
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
  const source = [publicSite, css].join("\n");
  assert.doesNotMatch(source, /images\.unsplash\.com/);
  assert.doesNotMatch(api, /\.from\("merchants"\)[\s\S]{0,220}subscription_status/);
});

test("service role is server-only", () => {
  const client = read("src/lib/supabase.ts");
  assert.doesNotMatch(client, /SERVICE_ROLE/);
  assert.doesNotMatch(publicSite, /SERVICE_ROLE/);
});

test("merchant portal exposes every required operating section", () => {
  const portal = read("src/components/merchant-portal.tsx");
  for (const section of ["StoreSection", "ProductsSection", "RequestsSection", "OrdersSection", "BranchesSection", "EmployeesSection", "NotificationsSection", "BuyerModeSection", "AccountStatusSection", "SubscriptionsSection", "SettingsSection"]) {
    assert.match(portal, new RegExp(section));
  }
  assert.doesNotMatch(portal, /BillingSection|PaymentsSection/);
});

test("private merchant uploads are authorized and scoped", () => {
  const upload = read("src/app/api/merchant/upload/route.ts");
  assert.match(upload, /requireMerchant\(request\)/);
  assert.match(upload, /merchant-ids/);
  assert.match(upload, /commercial-registers/);
  assert.match(upload, /storefront-photos/);
  assert.match(upload, /product-images/);
  assert.match(upload, /product-imports/);
  assert.match(upload, /subscription-payment-proof/);
  assert.match(upload, /merchant-payment-proofs/);
  assert.match(upload, /context\.merchantId\}\/portal-subscriptions/);
  assert.match(upload, /merchant_owner_required/);
  assert.doesNotMatch(upload, /portal-payments/);
  assert.match(upload, /unsupported_file_type/);
  assert.match(upload, /file_too_large/);
});

test("portal supports real product, order, buyer-mode, subscription, and preference mutations", () => {
  for (const action of ["save_product", "import_products", "update_order", "submit_rfq", "save_preferences", "delete_account", "create_buyer_direct_request", "set_billing_preference", "create_manual_subscription_payment_request"]) {
    assert.match(api, new RegExp(`action === \\"${action}\\"`));
  }
  assert.doesNotMatch(api, /createBuyerOrderPayment|buyer_order_payment_create/i);
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
  for (const permission of ["dashboard", "orders", "rfqs", "products", "imports", "branches", "hours", "delivery", "reports", "notifications", "referrals", "support", "settings", "buyer_mode"]) {
    assert.match(employees, new RegExp(`key: \\"${permission}\\"`));
  }
  assert.match(auth, /"account-status": \["account_status", "dashboard", "settings"\]/);
  assert.doesNotMatch(employees, /key: "billing"/);
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
