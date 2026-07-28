import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const publicSite = read("src/components/public-site.tsx");
const siteContent = read("src/lib/site-content.ts");
const authForms = read("src/components/auth-forms.tsx");
const registration = read("src/components/merchant-registration-form.tsx");
const css = read("src/app/globals.css");
const supportRoute = read("src/app/api/support/route.ts");

test("hero copy keeps the requested three-line Arabic and English structure", () => {
  assert.match(publicSite, /اطلب احتياجاتك وقارن/);
  assert.match(publicSite, /عروض المتاجر/);
  assert.match(publicSite, /في مكان واحد/);
  assert.match(publicSite, /Request what you need and compare/);
  assert.match(publicSite, /store offers/);
  assert.match(publicSite, /in one place/);
  assert.match(css, /hero-title-line:not\(\.hero-title-accent\).*color: #fff/);
});

test("buyer and merchant journey copy includes every requested input and management detail", () => {
  for (const phrase of ["ملف PDF", "تسجيلًا صوتيًا", "واجهة واحدة", "إدارة فروعك", "واجهة منظمة سهلة الإدارة", "من مكان واحد"]) {
    assert.match(publicSite + siteContent, new RegExp(phrase));
  }
  assert.doesNotMatch(publicSite, /بدون تكرار أو تعقيد/);
  assert.doesNotMatch(publicSite, /مساحة موحدة لاستقبال الطلبات/);
  assert.doesNotMatch(publicSite, /من بوابة واحدة/);
});

test("merchant and support headings are explicitly balanced over two lines", () => {
  assert.match(publicSite, /merchant-main-title/);
  assert.match(publicSite, /كل ما تحتاجه للإدارة/);
  assert.match(publicSite, /support-title-line/);
  assert.match(publicSite, /احكِ لنا المشكلة/);
  assert.match(css, /merchant-main-title[\s\S]*display: grid/);
  assert.match(css, /support-section h1[\s\S]*display: grid/);
  assert.match(css, /how-section > \.section-head[\s\S]*text-align: center/);
  assert.match(css, /merchant-journey \.journey-head[\s\S]*text-align: center/);
  assert.doesNotMatch(css, /merchant-journey \.journey-head \{[^}]*text-align: start/);
});

test("billing copy references the website instead of the old portal-only wording", () => {
  assert.match(siteContent, /طلبات الدفع من الموقع الإلكتروني/);
  assert.match(authForms, /الدفع والاشتراك داخل الموقع الإلكتروني/);
  assert.doesNotMatch(authForms, /الدفع والاشتراك داخل البوابة فقط/);
});

test("registration and authentication layouts have guarded desktop typography", () => {
  assert.match(registration, /أنشئ حساب متجرك وأرسل بياناته للمراجعة/);
  assert.match(css, /registration-auth-layout aside h1/);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.15fr\) minmax\(390px, \.85fr\)/);
});

test("light mode uses brand-green panels instead of fixed near-black panels", () => {
  assert.match(css, /Brand-only light appearance/);
  assert.match(css, /html\[data-theme="light"\] \.merchant-section/);
  assert.match(css, /linear-gradient\(135deg, #315f2a 0%, #4d7f3c 55%, #6aa64b 100%\)/);
});

test("support form stores requests and queues its notification destination", () => {
  assert.match(supportRoute, /portal_submit_public_support_request/);
  assert.match(supportRoute, /admin_email_events/);
  assert.match(supportRoute, /SUPPORT_NOTIFICATION_EMAIL/);
  assert.match(supportRoute, /info@saarly\.app/);
});
