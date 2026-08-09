import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const merchantPortal = read("src/components/merchant-portal.tsx");
const buyerPortal = read("src/components/buyer-portal.tsx");
const merchantApi = read("src/app/api/merchant/portal/route.ts");
const buyerApi = read("src/app/api/buyer/portal/route.ts");
const branches = read("src/components/merchant/sections/branches-section.tsx");
const imports = read("src/components/merchant/sections/imports-section.tsx");
const template = read("src/lib/product-import-template.ts");
const referrals = read("src/components/portal-v2/referral-workspace.tsx");
const css = read("src/app/globals.css");

test("legacy portals are preserved but not imported by active runtime", () => {
  const legacyReadme = read("src/components/legacy-portals/README.md");
  assert.match(legacyReadme, /inactive|غير مفع/i);
  for (const file of walk(path.join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}legacy-portals${path.sep}`))) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /@\/components\/legacy-portals|\.\/legacy-portals|components\/legacy-portals/);
  }
});

test("buyer core navigation keeps the Flutter order", () => {
  const core = buyerPortal.match(/key: "core"[\s\S]*?items: \[([^\]]+)\]/)?.[1] ?? "";
  assert.match(core, /navItems\.home[\s\S]*navItems\.requests[\s\S]*navItems\.favorites[\s\S]*navItems\.stores[\s\S]*navItems\.settings/);
  assert.match(buyerPortal, /mobilePrimary = \[navItems\.home, navItems\.requests, navItems\.favorites, navItems\.stores, navItems\.settings\]/);
});

test("merchant core navigation keeps the current Flutter order and branch-scoped status rule", () => {
  const core = merchantPortal.match(/key: "app-core"[\s\S]*?items: \[([\s\S]*?)\],[\s\S]*?\},/)?.[1] ?? "";
  for (const token of ["nav.overview", 'show("orders")', 'show("requests")', 'show("products")', 'show("imports")', 'show("hours")', 'show("delivery")', 'show("account-status")', 'show("referrals")', 'show("branches")', 'show("settings")', 'show("support")']) assert.match(core, new RegExp(token.replace(/[()".]/g, (m) => `\\${m}`)));
  assert.match(merchantPortal, /isBranchScopedStaff/);
  assert.match(merchantPortal, /key === "account-status" && isBranchScopedStaff/);
  assert.doesNotMatch(merchantPortal, /BuyerModeSection|href="\/merchant\/buyer"/);
});

test("branch page exposes the app branch-product availability action", () => {
  assert.match(branches, /إدارة توفر المنتجات|Manage product availability/);
  assert.match(branches, /save_branch_availability/);
  assert.match(branches, /unavailableIds/);
  assert.match(merchantApi, /branch_product_availability/);
  assert.match(merchantApi, /set_branch_product_availability/);
});

test("branch page mirrors app sales, craftsperson and free-delivery quick controls", () => {
  assert.match(merchantApi, /merchant_branch_sales_summary/);
  assert.match(branches, /branchSales/);
  assert.match(branches, /confirmed_orders_count/);
  assert.match(branches, /set_branch_craftsman/);
  assert.match(merchantApi, /portal_set_branch_craftsman_availability/);
  assert.match(branches, /set_branch_free_delivery/);
  assert.match(merchantApi, /set_my_branch_free_delivery/);
  assert.match(branches, /unassignedSales/);
});

test("product import template mirrors the app three-sheet workbook and 15 columns", () => {
  for (const column of ["اسم المنتج", "الفئة الفرعية", "متاح للبيع", "طريقة التوصيل للمنتج", "وزن الشحن كجم", "رابط الصورة 3", "ملاحظات"]) assert.match(template, new RegExp(column));
  assert.match(template, /name="products"/);
  assert.match(template, /الفئات الفرعية/);
  assert.match(template, /تعليمات قالب منتجات سعرلي/);
  assert.match(template, /sheet1\.xml/);
  assert.match(template, /sheet2\.xml/);
  assert.match(template, /sheet3\.xml/);
  assert.match(imports, /includeInvalidRows: true/);
});

test("active ad queries match the live ads_banners schema and do not request removed title columns", () => {
  assert.match(merchantApi, /from\("ads_banners"\)/);
  assert.match(buyerApi, /from\("ads_banners"\)/);
  const activeQueries = `${merchantApi}\n${buyerApi}`;
  assert.doesNotMatch(activeQueries, /ads_banners[\s\S]{0,220}title_ar|ads_banners[\s\S]{0,220}title_en/);
});

test("referral workspace carries link, sharing, progress, reward and status", () => {
  for (const needle of ["referral_url", "navigator.share", "clipboard", "total_confirmed_registrations", "next_target_remaining", "reward_status", "reward_label_ar", "banner_image_url"]) assert.match(referrals, new RegExp(needle.replace(".", "\\.")));
});

test("buyer payment remains unavailable and merchant web does not invent electronic checkout", () => {
  assert.match(buyerApi, /buyer_payment_not_available/);
  assert.doesNotMatch(buyerPortal, /payment|checkout/i);
  assert.match(merchantApi, /electronicCheckoutAvailable: false/);
});

test("portal v2 includes responsive and modal accessibility hooks", () => {
  assert.match(css, /portal-v2/);
  assert.match(css, /@media[\s\S]*max-width/);
  assert.match(branches, /role="dialog"/);
  assert.match(branches, /aria-modal="true"/);
});

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) out.push(...walk(file)); else out.push(file);
  }
  return out;
}
