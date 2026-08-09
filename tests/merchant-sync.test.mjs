import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [branches, portalRoute, uploadRoute, overview, store, requests, accountStatus, subscriptions, imports, template, xlsxLite, buyerMode] = await Promise.all([
  read("../src/components/merchant/sections/branches-section.tsx"),
  read("../src/app/api/merchant/portal/route.ts"),
  read("../src/app/api/merchant/upload/route.ts"),
  read("../src/components/merchant/sections/overview-section.tsx"),
  read("../src/components/merchant/sections/store-section.tsx"),
  read("../src/components/merchant/sections/requests-section.tsx"),
  read("../src/components/merchant/sections/account-status-section.tsx"),
  read("../src/components/merchant/sections/subscriptions-section.tsx"),
  read("../src/components/merchant/sections/imports-section.tsx"),
  read("../src/lib/product-import-template.ts"),
  read("../src/lib/xlsx-lite.ts"),
  read("../src/components/merchant/sections/buyer-mode-section.tsx"),
]);

test("branch editor captures manager ID front and back", () => {
  assert.match(branches, /managerIdFront/);
  assert.match(branches, /managerIdBack/);
  assert.match(portalRoute, /save_my_merchant_branch_web/);
});

test("branch management supports editing and deleting branches", () => {
  assert.match(branches, /portalPost\("save_branch"/);
  assert.match(branches, /portalPost\("delete_branch"/);
  assert.match(branches, /Delete branch/);
  assert.match(portalRoute, /action === "delete_branch"/);
  assert.match(portalRoute, /\.from\("branches"\)\s*\.delete\(\)/);
});

test("branch free delivery settings stay aligned with the mobile workspace", () => {
  assert.match(branches, /freeDeliveryEnabled/);
  assert.match(branches, /freeDeliveryMinimum/);
  assert.match(branches, /Free delivery above a minimum/);
  assert.match(portalRoute, /set_my_branch_free_delivery/);
  assert.match(portalRoute, /free_delivery_minimum_required/);
});

test("branch commercial register can reuse the parent or upload a separate file", () => {
  assert.match(branches, /usesParentCommercialRegister/);
  assert.match(branches, /commercialRegisterPath/);
  assert.match(uploadRoute, /branch-commercial-register/);
  assert.match(portalRoute, /uses_parent_commercial_register/);
});

test("branch upload limits match the mobile branch document rules", () => {
  assert.match(uploadRoute, /BRANCH_DOCUMENT_MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(uploadRoute, /allowed = IMAGE_TYPES;\s+maxBytes = BRANCH_DOCUMENT_MAX_BYTES;/);
  assert.match(uploadRoute, /allowed = DOCUMENT_TYPES;\s+maxBytes = BRANCH_DOCUMENT_MAX_BYTES;/);
  assert.match(branches, /Manager ID front[^]*accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(branches, /Separate commercial register[^]*accept="image\/jpeg,image\/png,application\/pdf"/);
  assert.match(branches, /JPG, PNG, WEBP - up to 5 MB/);
  assert.match(branches, /JPG, PNG, PDF - up to 5 MB/);
});

test("merchant portal displays founder and trusted badges", () => {
  assert.match(overview, /founder_badge_enabled/);
  assert.match(overview, /trusted_badge_enabled/);
  assert.match(store, /founder_badge_enabled/);
  assert.match(store, /trusted_badge_enabled/);
});

test("merchant RFQ requests can be filtered as direct or general requests", () => {
  assert.match(requests, /type RequestFilter = "all" \| "direct" \| "broadcast" \| "expiring"/);
  assert.match(requests, /function requestDeliveryType/);
  assert.match(requests, /filter === "direct"/);
  assert.match(requests, /filter === "broadcast"/);
  assert.match(requests, /مخصوصة لك/);
  assert.match(requests, /مقارنة عامة/);
});

test("merchant account status is a read-only workspace page, not a checkout page", () => {
  assert.match(portalRoute, /section === "account-status"/);
  assert.match(portalRoute, /my_monetization_dashboard/);
  assert.match(overview, /href="\/merchant\/account-status"/);
  assert.match(accountStatus, /Work receiving status/);
  assert.match(accountStatus, /Buyer purchases from stores remain part of Saarly/);
  assert.doesNotMatch(accountStatus, /Subscribe|Renew|Checkout|create_manual_payment|payment proof/i);
});

test("merchant web subscriptions use admin-managed plans and manual payment contracts", () => {
  assert.match(portalRoute, /section === "subscriptions"/);
  assert.match(portalRoute, /subscription_plans/);
  assert.match(portalRoute, /manual_payment_methods/);
  assert.match(portalRoute, /manual_payment_requests/);
  assert.match(portalRoute, /payment_transactions/);
  assert.match(portalRoute, /portal_create_manual_subscription_payment_request/);
  assert.match(uploadRoute, /subscription-payment-proof/);
  assert.match(subscriptions, /اشتراك سعرلي على الويب فقط/);
  assert.match(subscriptions, /Buyer purchases from stores remain a separate orders flow/);
  assert.match(subscriptions, /Electronic payment is not connected right now/);
});

test("merchant product import has a branded XLSX template with all needed catalog fields", () => {
  assert.match(imports, /downloadProductImportTemplate/);
  assert.match(imports, /Download template/);
  assert.match(template, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(template, /state="frozen"/);
  for (const header of ["product name", "category", "price", "quantity", "unit", "brand", "size", "color", "shipping weight kg", "delivery pricing method", "available"]) {
    assert.match(template, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(xlsxLite, /shippingWeightKg/);
  assert.match(xlsxLite, /deliveryPricingMethod/);
  assert.match(xlsxLite, /isAvailable/);
});

test("merchant buyer mode reuses the full buyer stores experience instead of a reduced duplicate", () => {
  assert.match(buyerMode, /BuyerStoresSection/);
  assert.match(buyerMode, /return <BuyerStoresSection \{\.\.\.props\} \/>/);
});
