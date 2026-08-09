import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const activeFiles = [
  'src/components/app-entry.tsx',
  'src/components/auth-forms.tsx',
  'src/components/buyer-auth-form.tsx',
  'src/components/invite-page.tsx',
  'src/components/merchant-registration-form.tsx',
  'src/components/buyer-portal.tsx',
  'src/components/merchant-portal.tsx',
  'src/components/merchant/portal-utils.ts',
  ...walk('src/components/buyer'),
  ...walk('src/components/merchant/sections'),
  ...walk('src/components/portal-v2'),
];

function walk(rel) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) return walk(child);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [child] : [];
  });
}

const source = activeFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

test('portal UI has no known raw technical copy', () => {
  const forbidden = [
    'admin configuration', 'admin review', 'administration approval',
    'Geolocation is not supported', 'Browser permission', 'Portal notifications',
    'Electronic payment gateway', 'No gateways registered',
    'Manual RFQ', 'Min kg', 'Max kg', 'AI assistant',
    'JPG, PNG', 'Excel أو CSV', 'من الخادم', 'قاعدة البيانات الحالية',
  ];
  for (const token of forbidden) assert.equal(source.includes(token), false, `found forbidden visible copy: ${token}`);
});

test('localization helpers protect system values', () => {
  const utils = fs.readFileSync(path.join(root, 'src/components/merchant/portal-utils.ts'), 'utf8');
  for (const helper of ['localizedSystemText', 'currencyLabel', 'unitLabel', 'staffRoleLabel', 'paymentProviderLabel', 'humanError']) {
    assert.match(utils, new RegExp(`function ${helper}\\b|const ${helper}\\b|export function ${helper}\\b`));
  }
  assert.match(utils, /Not specified/);
  assert.match(utils, /غير محدد/);
});

test('maps and portal brands follow selected language', () => {
  const map = fs.readFileSync(path.join(root, 'src/components/portal-v2/coordinate-map-picker.tsx'), 'utf8');
  assert.match(map, /locale === "ar" \? "ar" : "en-GB"/);
  for (const file of ['src/components/buyer-portal.tsx', 'src/components/merchant-portal.tsx']) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(body, /<Brand locale=\{locale\}/);
    assert.doesNotMatch(body, /<Brand locale="ar"/);
  }
});

test('portal API defaults do not force Arabic units for English users', () => {
  for (const file of ['src/app/api/buyer/portal/route.ts', 'src/app/api/merchant/portal/route.ts']) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(body, /preferred_language/);
    assert.match(body, /piece/);
    assert.match(body, /قطعة/);
  }
});
