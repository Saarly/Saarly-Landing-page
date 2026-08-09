# تقرير تنفيذ Saarly Buyer/Merchant Portal V2

## ما تم تعديله

تم تعديل **Landing Page فقط**. لم يتم تعديل:

- Flutter app.
- Admin Web.
- Supabase schema/data/functions/edge deployments.

تم استعمال Supabase كقراءة فقط للتحقق من الـcontracts الفعلية بدل التخمين.

## البنية الجديدة

### Active Buyer
- `src/components/buyer-portal.tsx`
- `src/components/buyer/sections/*`
- `src/app/api/buyer/portal/route.ts`
- Buyer auth/upload routes and shared portal utilities.

### Active Merchant
- `src/components/merchant-portal.tsx`
- `src/components/merchant/sections/*`
- `src/app/api/merchant/portal/route.ts`
- `src/app/api/merchant/upload/route.ts`
- `src/lib/merchant-auth.ts`

### Shared Portal V2
- `src/components/portal-v2/portal-shell.tsx`
- `src/components/portal-v2/referral-workspace.tsx`
- `src/components/portal-v2/support-workspace.tsx`
- Portal V2 CSS inside `src/app/globals.css`.

### Legacy preserved

المصدر القديم محفوظ تحت:

`src/components/legacy-portals/`

وعدد الملفات فيه 38 ملفًا وقت التحقق. لا يوجد Active TS/TSX import منه.

## أبرز التصحيحات مقارنة بالعمل القديم

1. إعادة بناء Navigation hierarchy حول ترتيب Flutter الفعلي بدل ترتيب Portal قديم.
2. Buyer core mobile navigation مطابق Home/Requests/Favorites/Stores/Settings.
3. Merchant core navigation مطابق ترتيب Flutter الحالي.
4. تعطيل Merchant Buyer Mode فعليًا في UI وGET/API actions بدل بقائه Hidden URL.
5. Buyer portal أصبح Buyer-only مثل فصل الأدوار الحالي في التطبيق.
6. Buyer payment يظل Disabled ولا يوجد Checkout مخترع.
7. Home Buyer يعرض PriceMe ثم Nearby Ads ثم Recent Requests قبل إضافات الويب.
8. Store/cart/physical purchase-order flow مكتمل بدون خلطه مع Payment.
9. RFQ shipping/acceptance/actions مربوطة بنفس RPCs الحالية.
10. Staff permissions تم تصحيحها لتطابق Flutter: `billing` وليس permission جديد للإشعارات، و`[]` للفروع = All branches.
11. Branch page استكملت Product availability + sales + craftsperson + free-delivery quick interaction + unassigned sales.
12. Product Import workbook أصبح 3 Sheets و15 عمودًا مطابقًا لقالب Flutter، مع الاحتفاظ بالصفوف الخاطئة للمراجعة.
13. Ads query تم تصحيحها لتتوافق مع Live `ads_banners` الذي لا يحتوي `title_ar/title_en`.
14. Referral workspace أصبح يعرض Banner/share/copy/total/progress/remaining/reward/latest status.
15. Account Status بقي Read-only مثل الموبايل، والاشتراك منفصل داخل Merchant Web.
16. Subscription UI تستخدم plans/discounts/manual methods/requests/payment status من نفس Admin/Supabase.
17. لم يتم اختراع Electronic checkout لعدم وجود Checkout-session contract فعلي.
18. تم تقوية Responsive shell وMobile More sheet وModals/Empty states/RTL-LTR.

## Supabase الذي تمت مراجعته قراءة فقط

Project ref: `fyffdppaujafpalzdcsa`.

تم فحص:

- Tables/views/columns الضرورية.
- RPC signatures وتعريفات عدد من الـRPCs الحساسة.
- Feature flags.
- Subscription plans/discount state.
- Payment gateway readiness.
- Edge function inventory.

لم يتم تنفيذ INSERT/UPDATE/DELETE/DDL/Deploy.

## Admin Web الذي تمت مراجعته

تمت مراجعة Monetization Console وAPI المرتبطة به لفهم:

- Flags.
- Plans.
- Discounts.
- Manual payment methods/requests.
- Payment gateway configuration/test state.
- Founder tiers and merchant billing settings.
- Commissions.
- Referrals/rewards.
- Email/report controls.

الPortal يستهلك نفس المصادر ولا يكرر Control plane جديدًا.

## التحقق المنفذ

- TypeScript/TSX AST syntax parse على **135 ملفًا**: `0` أخطاء Parsing في آخر فحص قبل التقرير.
- Node test suite بعد استكمال parity: **71/71 PASS**.
- Portal V2 parity test يغطي legacy inactivity، nav order، branch interactions، import workbook، live ads schema، referrals، payment restrictions، responsive/modal hooks.
- XLSX الناتج تم توليده وفحصه كـZIP/OpenXML: الملفات الداخلية سليمة وSheets الثلاثة موجودة.
- Legacy runtime import search: لا توجد imports نشطة.

## Build limitation في بيئة التنفيذ

ملفات المشروع المرفوعة لا تحتوي Dependencies مثبتة. محاولة `npm ci` لم تستطع جلب بعض الحزم بسبب عدم توفر Registry/Network لهذه البيئة، لذلك لا يوجد ادعاء بأن `next build` تم بنجاح هنا.

هذا لا يساوي Build failure في المشروع نفسه؛ هو **Environment dependency-install limitation**. تم بدلًا منه تشغيل Parsing واختبارات المصدر المتاحة بدون Dependencies.

## ملفات Environment غير المرفوعة

لا توجد `.env*` في ZIP، وهذا جيد أمنيًا. التشغيل المحلي/Deployment يحتاج Environment الحالي الخاص بالمشروع، ومنه على الأقل:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EMAIL_DISPATCH_SECRET`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `SUPPORT_NOTIFICATION_EMAIL`

لا تضف Service Role إلى Client ولا ترفع Secrets في Source archive.

## ملاحظة Product Import

التطبيق والقالب يحملان بيانات images/delivery/weight، لكن Live `import_my_products_web`/approval الداخلي لا يكتبان كل هذه الحقول للمنتج. لم يتم تغيير Supabase لأن المهمة تمنع ذلك. الـPortal لا يدعي نجاح Persist لشيء لا يدعمه Backend الحالي.

## ملاحظة Electronic Payment

`payment_settings` والـwebhook موجودان، لكن بوابات الدفع الحية كانت غير configured/connected وقت الفحص، ولا توجد Checkout-session API جاهزة للFrontend. لذلك لا يوجد زر دفع إلكتروني وهمي. التحويل اليدوي هو مسار Web المتصل فعليًا عندما تسمح الـflags.
