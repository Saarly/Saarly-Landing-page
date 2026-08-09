import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const buyerApi = read("src/app/api/buyer/portal/route.ts");
const buyerAuth = read("src/lib/buyer-auth.ts");
const login = read("src/components/buyer-auth-form.tsx");
const portal = read("src/components/buyer-portal.tsx");
const content = read("src/lib/content.ts");
const upload = read("src/app/api/buyer/upload/route.ts");
const requests = read("src/components/buyer/sections/requests-section.tsx");
const orders = read("src/components/buyer/sections/orders-section.tsx");
const stores = read("src/components/buyer/sections/stores-section.tsx");
const publicSite = read("src/components/public-site.tsx");

test("buyer authentication supports sign in, new accounts, OTP, and profile completion", () => {
  assert.match(login, /type Mode = "signin" \| "signup"/);
  assert.match(login, /signInWithOtp/);
  assert.match(login, /verifyOtp/);
  assert.match(login, /shouldCreateUser: mode === "signup"/);
  assert.match(login, /\/api\/buyer\/onboarding/);
  assert.match(login, /primaryEmail/);
  assert.match(login, /recoveryEmail/);
  assert.match(login, /setReferralCode/);
  assert.match(login, /cleanReferralCode/);
  assert.match(login, /type Step = "email" \| "code" \| "profile" \| "accountType"/);
  assert.match(login, /chooseAccountType\(role: "buyer" \| "merchant"\)/);
  assert.match(login, /\/api\/merchant\/registration/);
});

test("buyer portal exposes every main app section", () => {
  for (const component of ["BuyerHomeSection", "BuyerRequestsSection", "BuyerOrdersSection", "BuyerStoresSection", "BuyerFavoritesSection", "BuyerAlertsSection", "BuyerNotificationsSection", "BuyerReferralsSection", "BuyerSupportSection", "BuyerSettingsSection"]) {
    assert.match(portal, new RegExp(component));
  }
  for (const route of ["requests", "orders", "stores", "favorites", "alerts", "notifications", "referrals", "support", "settings"]) {
    assert.match(content, new RegExp(`buyer/${route}`));
  }
});

test("buyer server accepts buyer accounts only because merchant buyer-mode is disabled in Flutter", () => {
  assert.match(buyerAuth, /String\(profile\.role\) !== "buyer"/);
  assert.match(buyerAuth, /account_blocked/);
  assert.match(buyerAuth, /is_archived/);
});

test("buyer requests match the mobile input methods and review workflow", () => {
  for (const source of ["manual", "image", "pdf", "voice"]) assert.match(requests, new RegExp(`"${source}"`));
  assert.match(requests, /type Tab = "offers" \| "requests" \| "rfq"/);
  assert.match(requests, /useState<Tab>\("offers"\)/);
  assert.match(requests, /عروض مستلمة/);
  assert.match(requests, /Received offers/);
  assert.match(requests, /analyze_upload/);
  assert.match(requests, /approve_analyzed_quote/);
  assert.match(requests, /generate_offers/);
  assert.match(requests, /create_rfq/);
  assert.match(requests, /accept_offer/);
  assert.match(requests, /accept_rfq_response/);
  assert.match(requests, /OfferSort/);
  assert.match(requests, /"cheapest"/);
  assert.match(requests, /"nearest"/);
  assert.match(requests, /"coverage"/);
  assert.match(requests, /"rating"/);
});

test("buyer upload is authenticated, user-scoped, MIME checked, and size limited", () => {
  assert.match(upload, /requireBuyer\(request\)/);
  assert.match(upload, /context\.user\.id.*buyer-web/s);
  assert.match(upload, /unsupported_file_type/);
  assert.match(upload, /file_too_large/);
  assert.match(upload, /voice-recordings/);
  assert.match(upload, /invoices/);
});

test("storefront supports search, products, favorites, alerts, location, direct requests, and catalog cart orders", () => {
  for (const action of ["search_stores", "load_store_products", "toggle_favorite", "toggle_price_alert", "save_location", "create_manual_quote", "preview_catalog_cart", "create_catalog_cart_order"]) {
    assert.match(buyerApi, new RegExp(`action === \\"${action}\\"`));
  }
  assert.match(buyerApi, /preview_catalog_cart_order/);
  assert.match(buyerApi, /create_catalog_cart_order/);
  assert.match(stores, /طلب مخصوص|Direct request/);
  assert.match(stores, /useCurrentLocation/);
  assert.match(stores, /buyer-product-actions/);
  assert.match(stores, /Add to cart/);
  assert.match(stores, /Shopping cart/);
  assert.match(stores, /Send purchase order/);
});

test("buyer cannot see or request from their own store", () => {
  assert.match(buyerApi, /merchantId === context\.ownMerchantId/);
  assert.match(buyerApi, /target_merchant_own_store/);
  assert.match(buyerApi, /filter\(\(item\) => value\(item\.merchant_id\) !== context\.ownMerchantId\)/);
});

test("buyer notifications exclude merchant workflow notifications", () => {
  assert.match(buyerApi, /merchantOnlyNotificationTypes/);
  assert.match(buyerApi, /weekly_price_update/);
  assert.match(buyerApi, /rfq_request_new/);
  assert.match(buyerApi, /saarly:\\\/\\\/merchant/);
  assert.match(buyerApi, /mark_all_notifications/);
});

test("accepted orders include contacts, chat, reviews, and history without reviving buyer payment", () => {
  assert.match(orders, /open_order_chat/);
  assert.match(orders, /send_order_chat_message/);
  assert.match(orders, /submit_review/);
  assert.match(orders, /cancel_order/);
  assert.match(orders, /delete_order/);
  assert.doesNotMatch(orders, /order_payment_dashboard|buyer_order_payment_dashboard|checkout|pay now/i);
  assert.match(buyerApi, /buyer_payment_not_available/);
});

test("buyer support, referrals, preferences, and profile mutations are real server actions", () => {
  for (const action of ["send_support_message", "transfer_support", "save_preferences", "save_profile", "mark_notification", "mark_all_notifications"]) {
    assert.match(buyerApi, new RegExp(`action === \\"${action}\\"`));
  }
  assert.match(buyerApi, /my_referral_dashboard_for/);
  assert.match(buyerApi, /p_audience: "buyer"/);
  assert.match(buyerApi, /start_or_get_support_conversation/);
});

test("currency and location come from the registered city instead of a fixed web price currency", () => {
  assert.match(buyerApi, /currency_code/);
  assert.match(buyerApi, /save_my_buyer_location/);
  assert.match(buyerApi, /app_location_options/);
  assert.match(requests, /payload\.account\.currencyCode/);
  assert.match(orders, /payload\.account\.currencyCode/);
});

test("landing offers separate buyer and merchant entry points", () => {
  assert.match(publicSite, /\/login/);
  assert.match(publicSite, /\/merchant-login/);
  assert.match(content, /دخول المشتري/);
  assert.match(content, /دخول التاجر/);
});

test("service role remains outside buyer client components", () => {
  const clients = [portal, login, requests, orders, stores].join("\n");
  assert.doesNotMatch(clients, /SERVICE_ROLE/);
  assert.doesNotMatch(clients, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("buyer price alerts support free-text watches, filters, product opening, and safe cancellation", () => {
  const alerts = read("src/components/buyer/sections/alerts-section.tsx");
  assert.match(buyerApi, /action === "create_text_price_alert"/);
  assert.match(buyerApi, /action === "stop_price_alert"/);
  assert.match(buyerApi, /action === "load_product_target"/);
  assert.match(alerts, /type AlertFilter/);
  assert.match(alerts, /create_text_price_alert/);
  assert.match(alerts, /stop_price_alert/);
  assert.match(alerts, /buyer\/stores\?product=/);
  assert.match(alerts, /تفاصيل المنتج/);
  assert.match(alerts, /Product details/);
  assert.doesNotMatch(alerts, /فتح المنتج|Open product/);
});

test("browser buyer requests include live voice recording and camera-friendly image capture", () => {
  assert.match(requests, /MediaRecorder/);
  assert.match(requests, /getUserMedia/);
  assert.match(requests, /audio\/webm/);
  assert.match(requests, /capture=\{mode === "image" \? "environment"/);
});

test("direct store requests support manual, image, PDF, and voice analysis", () => {
  assert.match(stores, /type DirectRequestMode = "manual" \| "image" \| "pdf" \| "voice"/);
  assert.match(stores, /buyerUpload\(requestMode/);
  assert.match(stores, /approve_analyzed_quote/);
  assert.match(stores, /merchantId: selectedMerchantId/);
  assert.match(stores, /MediaRecorder/);
});

test("RFQ response acceptance reviews shipping companies, weight tiers, and final cost", () => {
  assert.match(buyerApi, /action === "rfq_shipping_options"/);
  assert.match(buyerApi, /get_rfq_response_delivery_quote/);
  assert.match(requests, /shippingCompanyId/);
  assert.match(requests, /totalWeightKg/);
  assert.match(requests, /shippingCost/);
});

test("merchant buyer mode is intentionally disabled to match the current Flutter source", () => {
  const merchantPortal = read("src/components/merchant-portal.tsx");
  const merchantApi = read("src/app/api/merchant/portal/route.ts");
  assert.doesNotMatch(merchantPortal, /BuyerModeSection|href: "\/merchant\/buyer"/);
  assert.match(merchantApi, /merchant_buyer_mode_disabled/);
  assert.match(portal, /href="\/merchant"/);
});

test("buyer offer loader keeps the Row contract for TypeScript production builds", () => {
  const source = read("src/app/api/buyer/portal/route.ts");
  assert.match(source, /async function loadOffers\(context: BuyerContext, limit = 120\): Promise<Row\[]>/);
  assert.match(source, /return offerRows\.map\(\(offer\): Row =>/);
});


test("buyer and merchant preference state keeps strict Locale and ThemeMode types", () => {
  const buyerSettings = read("src/components/buyer/sections/settings-section.tsx");
  const merchantSettings = read("src/components/merchant/sections/settings-section.tsx");
  const preferences = read("src/components/site-preferences.tsx");
  assert.match(preferences, /export type ThemeMode = "light" \| "dark" \| "system"/);
  assert.match(buyerSettings, /useState<Locale>\(/);
  assert.match(buyerSettings, /useState<ThemeMode>\(/);
  assert.match(merchantSettings, /useState<Locale>\(/);
  assert.match(merchantSettings, /useState<ThemeMode>\(/);
});
