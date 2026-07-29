import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("authentication requests send the active interface language", () => {
  for (const file of [
    "src/components/auth-forms.tsx",
    "src/components/buyer-auth-form.tsx",
    "src/components/merchant-registration-form.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /preferred_language:\s*locale/);
    assert.match(source, /auth\.updateUser\(\{\s*data:\s*\{\s*preferred_language:\s*locale/);
  }
});

test("changing the website language synchronizes signed-in auth metadata", () => {
  const source = read("src/components/site-preferences.tsx");
  assert.match(source, /preferred_language:\s*next/);
  assert.match(source, /auth\.getSession\(\)/);
});

test("web package version is bumped for bilingual email language sync", () => {
  assert.equal(JSON.parse(read("package.json")).version, "1.0.4");
});
