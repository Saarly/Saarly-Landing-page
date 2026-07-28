import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [branches, portalRoute, uploadRoute, overview, store] = await Promise.all([
  read("../src/components/merchant/sections/branches-section.tsx"),
  read("../src/app/api/merchant/portal/route.ts"),
  read("../src/app/api/merchant/upload/route.ts"),
  read("../src/components/merchant/sections/overview-section.tsx"),
  read("../src/components/merchant/sections/store-section.tsx"),
]);

test("branch editor captures manager ID front and back", () => {
  assert.match(branches, /managerIdFront/);
  assert.match(branches, /managerIdBack/);
  assert.match(portalRoute, /save_my_merchant_branch_web/);
});

test("branch commercial register can reuse the parent or upload a separate file", () => {
  assert.match(branches, /usesParentCommercialRegister/);
  assert.match(branches, /commercialRegisterPath/);
  assert.match(uploadRoute, /branch-commercial-register/);
  assert.match(portalRoute, /uses_parent_commercial_register/);
});

test("merchant portal displays founder and trusted badges", () => {
  assert.match(overview, /founder_badge_enabled/);
  assert.match(overview, /trusted_badge_enabled/);
  assert.match(store, /founder_badge_enabled/);
  assert.match(store, /trusted_badge_enabled/);
});
