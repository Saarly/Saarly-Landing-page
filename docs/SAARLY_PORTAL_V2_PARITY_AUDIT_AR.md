# تدقيق مطابقة بوابتي Saarly Web مع تطبيق الموبايل — Portal V2

**التاريخ:** 9 أغسطس 2026  
**مصادر الحقيقة التي تمت مراجعتها:**

- تطبيق Flutter المرفوع في `app.zip` — تمت مراجعته قراءة فقط، ولم يتم تعديل أي ملف داخله.
- Landing Page المرفوعة في `landing.zip` — هي المشروع الوحيد الذي تم تعديله.
- Admin Web المرفوع في `admin web(2).zip` — تمت مراجعته قراءة فقط، ولم يتم تعديل أي ملف داخله.
- مشروع Supabase الحالي `fyffdppaujafpalzdcsa` — تمت قراءة الـSchema/RPCs/Feature Flags/Edge Functions والبيانات اللازمة فقط، بدون أي SQL كتابة أو Migration أو Deploy أو تعديل بيانات.

## 1. قواعد التنفيذ

1. المحتوى، ترتيب الوظائف، القيود، الحالات، الـRPCs ومصادر البيانات مأخوذة من التطبيق الحالي وBackend/Admin الحاليين، وليس من الـPortal القديم.
2. Portal V2 يستخدم هوية اللاندنج الحالية وألوانها، لكنه يعيد توزيع نفس المحتوى على Web layouts أكثر وضوحًا واستجابة للشاشات الكبيرة والصغيرة.
3. الـPortal القديم محفوظ بالكامل تحت `src/components/legacy-portals/` كمرجع فقط، وغير مستورد من Runtime الحالي.
4. لم يتم إنشاء Database موازية أو Auth موازٍ أو Backend جديد.
5. لا يوجد Buyer payment داخل الويب؛ هذا مطابق للتطبيق الحالي الذي أوقف Buyer payment UI.
6. وضع المشتري داخل حساب المتجر معطل لأن Flutter الحالي يحدد `_merchantBuyerModeEnabled = false`. الـLegacy component محفوظ، لكن الـNavigation والـAPI الفعالة تمنع تشغيله.
7. الاشتراك والدفع الخاص بخدمة Saarly للمتجر موجود في **Merchant Web فقط** ويقرأ الباقات والخصومات وطرق الدفع والإعدادات من نفس Supabase/Admin الحاليين.
8. لا يتم اختراع Electronic Checkout: Backend الحالي لا يوفر Checkout-session function للواجهة؛ لذلك لا يظهر زر دفع إلكتروني زائف قبل تجهيز Gateway حقيقي.

---

# 2. رحلة الدخول وإنشاء الحساب — مصدرها Flutter

## 2.1 Splash / Onboarding / Language

تطبيق Flutter يبدأ بالترتيب:

1. Splash.
2. Onboarding من ثلاث شرائح.
3. اختيار اللغة.
4. صفحة البريد الإلكتروني.

في الويب تم تحويل الجزء المناسب للويب إلى Authentication experience نظيفة بدل تقليد Splash المحمول حرفيًا. هوية Saarly، اتجاه RTL/LTR واللغة مستمرة في كل الخطوات.

## 2.2 تسجيل الدخول بالبريد

المحتوى الوظيفي المطابق:

- حقل البريد الإلكتروني.
- تذكر الجهاز/الجلسة.
- إرسال رمز التحقق.
- رسائل الخطأ والحالات الجارية.
- اللغة الحالية ترسل مع Auth flow حتى تبقى الرسائل والواجهة متزامنة.

لا يوجد Password flow عادي مُخترع بدل OTP.

## 2.3 OTP

- إدخال رمز مكوّن من 6 أرقام.
- التحقق من الرمز.
- إعادة الإرسال بعد المؤقت.
- إمكانية الرجوع لتغيير البريد.
- حالات Loading/Error/Success.

## 2.4 إكمال الملف

حقول تطبيق Flutter التي تمت المحافظة على معناها:

- الاسم الكامل.
- رقم الهاتف.
- البريد الأساسي.
- البريد الاحتياطي عند توفره.
- كود الإحالة إن كان محفوظًا/قادماً من رابط دعوة.

## 2.5 اختيار نوع الحساب

- مشتري.
- متجر.

إذا اختار المستخدم مشتريًا ينتقل إلى Buyer Portal.
إذا اختار متجرًا ينتقل إلى رحلة Merchant Registration المطابقة لمصدر التطبيق.

## 2.6 تسجيل المتجر

الويب يحتفظ بعناصر رحلة التسجيل الفعلية التي يحتاجها Backend الحالي، وتشمل:

- بيانات المتجر.
- بيانات المالك/المسؤول والمدير.
- رقم الهاتف ووسائل الاتصال.
- طريقة تشغيل الأسعار: `catalog` أو `manual_quote`.
- الفئات.
- المدينة/المحافظة/الدولة.
- الموقع والإحداثيات واستخدام GPS/الخريطة حيث ينطبق.
- صورة واجهة المتجر.
- المستندات والهوية والسجل المطلوبة حسب حالة التسجيل.
- بيانات الإحالة وإشارات الجهاز المستخدمة في عد الإحالات.
- حالة المراجعة Approved/Pending/Rejected ورسالة الرفض عند وجودها.

لا يتم تجاوز Approval logic الموجود في Backend.

---

# 3. Buyer Portal — المطابقة الكاملة

## 3.1 ترتيب التنقل الأساسي

الترتيب الأساسي مطابق للـBottom Navigation في Flutter:

1. **الرئيسية**
2. **الطلبات/طلبات التسعير**
3. **المفضلة**
4. **المتاجر**
5. **الإعدادات**

وعلى الويب توجد مجموعة Activity مستقلة للوصول السريع إلى:

- طلبات الشراء.
- تنبيهات الأسعار.
- الإشعارات.

ومجموعة Account:

- الدعوات والمكافآت.
- الدعم.

في الموبايل الصغير تظهر الخمسة الأساسية في Bottom Dock، والباقي في More/Sidebar المناسب للشاشة.

## 3.2 الرئيسية — الترتيب الأساسي مطابق للتطبيق

أول المحتوى، بدون تقديم Widgets ويب على العناصر الأصلية:

1. عنوان Saarly وفكرة كتابة الاحتياجات ومقارنة العروض.
2. بطاقة **سعّرلي / PriceMe** وتحتوي طرق إدخال الطلب:
   - كتابة يدوية.
   - صورة/كاميرا.
   - PDF.
   - صوت/تسجيل مباشر.
3. **إعلانات قريبة** من `ads_banners` حسب Location targeting والـplacement.
4. **أحدث الطلبات**.

بعد هذه المجموعة يمكن للويب إظهار Summary cards/اختصارات إضافية، لكنها لا تستبدل العناصر الأصلية.

## 3.3 طلبات التسعير

### إنشاء طلب

طرق الإدخال الفعلية:

- Manual.
- Image.
- PDF.
- Voice.

للملفات/الصوت:

- رفع الملف بشكل مؤمّن.
- إرسال المحتوى لنفس مسار التحليل الحالي.
- عرض نتيجة AI للمراجعة قبل اعتمادها.

### مراجعة التحليل

- عرض البنود المستخرجة.
- الاسم/الكمية/الوحدة والبيانات التي يسمح المصدر الحالي بمراجعتها.
- عدم إرسال الطلب للمتاجر قبل الاعتماد.
- حالة الخطأ أو `needs_review` تظهر للمستخدم بدل دفنها.

### نطاق البحث

يحافظ على Location scope الموجود في التطبيق:

- مدينة.
- محافظة.
- دولة.

### العروض

الويب يدعم نفس منطق العرض والترتيب:

- الأرخص.
- الأقرب.
- نسبة التغطية.
- التقييم.

تفاصيل العرض تشمل حسب البيانات المتاحة:

- المتجر.
- كل بند وسعر الوحدة والإجمالي.
- التوفر الحالي.
- السعر الحالي snapshot/current result حيث يقدمه Backend.
- نسبة التغطية.
- التحذيرات.
- تفاصيل التوصيل.
- التوصيل المجاني وشروطه.
- ضبط كميات القبول قبل التنفيذ.

### قبول العرض

الـAPI يستخدم نفس RPCs الفعلية:

- `preview_offer_acceptance`
- `accept_offer_with_quantities`

ويتم عرض Preview قبل التأكيد النهائي عندما يحتاج الـflow ذلك.

### RFQ للبنود غير المغطاة

- إنشاء RFQ للبنود غير المتاحة من العرض.
- Direct RFQ لمتجر معين عند اختيار المستخدم ذلك.
- انتهاء صلاحية الطلب والـdelivery type كما يسمح الـBackend.

### ردود RFQ

- مراجعة بنود الرد.
- قبول أو رفض الرد.
- اختيار شركة/شريحة الشحن إن كان تسعير الشحن بالوزن.
- حساب تكلفة الشحن والإجمالي قبل القبول.

## 3.4 المتاجر Storefront

### البحث والاستكشاف

- بحث بالاسم/الفئة.
- فئات المتاجر والمنتجات.
- إخفاء متجر المستخدم نفسه عند وجود حالة غير متوقعة من البيانات.
- فتح متجر محدد من روابط داخل الواجهة.
- دعم `?q=`, `?focus=`, `?product=` لتوجيه المستخدم للنتيجة الصحيحة داخل Portal دون إنشاء تجربة مختلفة.

### صفحة المتجر

- اسم المتجر.
- الصورة.
- الفئات.
- الشارات Founder/Trusted إن كانت مفعلة.
- الفروع المتاحة.
- المنتجات.
- حالة التوفر والسعر والوحدة.
- صور المنتج والـbrand/size/color حيث توجد.
- إضافة/إزالة المفضلة.
- تشغيل/إيقاف تنبيه سعر للمنتج.

### Direct Quote من المتجر

نفس طرق الإدخال:

- Manual.
- Image.
- PDF.
- Voice.

ويتم استهداف المتجر/الفرع في الطلب، لا إنشاء مسار Backend جديد.

## 3.5 السلة وطلب شراء السلع

السلة على الويب محلية لكل متجر، ولا تخلط منتجات متاجر متعددة في Checkout واحد.

عند الضغط على السلة تظهر واجهة مراجعة تتضمن:

- المنتجات.
- الكميات.
- سعر الوحدة.
- الإجمالي.
- توافر المنتج.
- إعداد التوصيل.
- Preview للتوصيل والتكلفة.
- التوصيل المجاني عند تحقق الحد الأدنى.
- التأكيد النهائي لإنشاء Purchase Order للسلع.

**هذه ليست عملية دفع Saarly أو In-App Payment.** لا يوجد Buyer payment dashboard في Portal V2.

## 3.6 طلبات الشراء Orders

- قائمة الطلبات وحالتها.
- تفاصيل المتجر والبنود.
- تأكيدات المتجر وحالة Buyer decision.
- بيانات التواصل المتاحة بعد الحالة الصحيحة.
- Chat مع المتجر عندما يسمح الـBackend.
- إرسال رسالة.
- تقييم الطلب/المتجر بعد الأهلية.
- إلغاء الطلب عندما تسمح الحالة.
- حذف العنصر من سجل المستخدم عندما يسمح المصدر.
- History والحالات والتواريخ.

لا يظهر زر دفع أو Payment Dashboard للمشتري.

## 3.7 المفضلة

تتعامل مع الأنواع الفعلية:

- متجر.
- منتج.
- Search/بحث محفوظ إذا أعاده Backend.

ومن المفضلة يمكن الرجوع للمتجر/المنتج المناسب.

## 3.8 تنبيهات الأسعار

- تنبيه مرتبط بمنتج.
- تنبيه نصي Free-text.
- عرض الفلاتر/الشروط الحالية.
- فتح المنتج من التنبيه عند توفره.
- إيقاف التنبيه بأمان.
- عدم ترك Alert نشط بعد إزالة Favorite المرتبط به إذا كان Backend يربطهما.

## 3.9 الإشعارات

- عرض إشعارات المشتري فقط وعدم خلط Merchant workflow notifications.
- حالة مقروء/غير مقروء.
- Mark one as read.
- Mark all as read.
- فتح Deep Link المناسب داخل تجربة Buyer.

## 3.10 الدعوات والمكافآت

يستخدم `my_referral_dashboard_for('buyer')` ونفس الحقول الحالية:

- رابط الدعوة.
- الكود.
- نسخ الرابط.
- Web Share إن كان المتصفح يدعمه، مع Clipboard fallback.
- إجمالي التسجيلات المقبولة.
- تقدم المكافأة الحالية.
- المتبقي للوصول للهدف.
- نوع/اسم المكافأة من Backend.
- حالة آخر مكافأة: pending/approved/delivered/rejected.
- Banner الإحالات والإعلانات ذات الصلة إذا كانت معدة.

## 3.11 الدعم

- فتح محادثة دعم بعنوان واضح.
- Chatbot أولًا طبقًا للـBackend الحالي.
- تحويل لخدمة العملاء عند الحاجة.
- إرسال الرسائل.
- قراءة الرسائل.
- إغلاق المحادثة.
- تقييم المحادثة بالنجوم/التعليق.

يستخدم نفس `chat_conversations`, `chat_messages`, support RPCs و`support-chatbot`.

## 3.12 الإعدادات

الويب يحافظ على وظائف التطبيق المناسبة للويب:

- الموقع ونطاق البحث.
- إعدادات الإشعارات المتاحة من الـBackend.
- اللغة AR/EN.
- Light/Dark theme.
- بيانات الملف الشخصي القابلة للتعديل.
- روابط Saarly الاجتماعية/القانونية.
- سياسة الخصوصية والشروط وسياسات الموقع.
- حذف الحساب مع Confirmation flow.

---

# 4. Merchant Portal — المطابقة الكاملة

## 4.1 الترتيب الأساسي كما يظهر في Flutter الحالي

1. **لوحة التحكم**
2. **الطلبات** — permission `orders`
3. **طلبات التسعير المخصصة RFQ** — permission `rfqs`
4. **المنتجات** — لا تظهر في `manual_quote`
5. **استيراد المنتجات** — لا تظهر في `manual_quote`
6. **مواعيد العمل**
7. **التوصيل**
8. **حالة الحساب** — لا تظهر لموظف محدود بفروع
9. **الدعوات والمكافآت** عندما تكون متاحة
10. **الفروع**
11. **الإعدادات**
12. **الدعم**

ثم توجد أدوات Web management إضافية لا تغير ترتيب Core app:

- الملف/بيانات المتجر.
- التقارير.
- التقييمات.
- الموظفون.
- اشتراك Saarly Web للمالك فقط.
- الإشعارات.

### وضع المشتري داخل المتجر

Flutter الحالي يحتوي الكود القديم لكنه يضبط:

`_merchantBuyerModeEnabled = false`

لذلك Portal V2:

- لا يعرض `/merchant/buyer`.
- لا يستورد `BuyerModeSection` في الـRuntime.
- GET المباشر للقسم `buyer` يعاد كـ`merchant_buyer_mode_disabled`.
- Buyer-mode POST actions القديمة محمية بحاجز يعيد Disabled.
- المصدر القديم محفوظ للمراجعة ولا يتم حذفه.

## 4.2 لوحة التحكم

الـ6 Metrics الأساسية:

- عدد المنتجات.
- الطلبات الجديدة.
- التقييم.
- إجمالي المبيعات.
- الطلبات المؤكدة.
- عدد التقييمات.

Growth sections:

- المنتجات الأقوى.
- الفئات الأقوى.
- مخزون منخفض.
- منتجات تحتاج تحديث بيانات/سعر.

مع بيانات الحساب والشارات والاختصارات المناسبة للشاشة الكبيرة.

## 4.3 الطلبات Orders

Filter الأساسي مطابق للتطبيق:

- الكل.
- مخصوص / Direct.
- عام / Broadcast.

ولكل طلب:

- بيانات البنود.
- الإجمالي snapshot.
- الفرع.
- المهلة/Countdown.
- حالة التأكيد.
- بيانات المشتري عند السماح.
- Chat بعد القبول/التأكيد المناسب.

### تأكيد الطلب

- Confirm.

### إلغاء من المتجر

الأسباب المطابقة:

- `out_of_stock`
- `price_changed`
- `other`

مع حقل **توضيح للعميل** اختياري، وإذا ترك فارغًا يستعمل السبب كـfallback مثل التطبيق.

## 4.4 RFQ / Custom pricing

- All/Direct/Broadcast filtering.
- عرض كل البنود المطلوب الرد عليها.
- لا يسمح بإرسال رد ناقص: Backend يشترط الإجابة على جميع البنود.
- اختيار فرع Approved ومسموح للموظف به.
- لكل بند: `priced` أو `rejected`.
- السعر والوحدة.
- ربط بمنتج من الكتالوج أو تسعير خارج الكتالوج.
- عند ربط منتج يتم مراعاة Active/Available/Quantity وتوفره في الفرع.
- ETA/Note حين تسمح الـpayload.
- إجمالي البنود المسعرة قبل الإرسال.

الـRPC الفعلي `submit_rfq_response` يستخدم نفس الـbranch/product validation في Backend.

## 4.5 المنتجات

عناصر Product editor:

- الفئة — مطلوبة.
- الاسم — مطلوب.
- السعر > 0.
- الوحدة — مطلوبة.
- الكمية >= 0.
- الماركة اختيارية.
- المقاس/السعة اختيارية.
- اللون اختياري.
- حالة متاح حاليًا.
- حالة المنتج Active.
- صور المنتج: صورة واحدة على الأقل، وحتى 6 في تجربة Web الحالية.
- الصورة الرئيسية هي الأولى.
- حذف صورة وإضافة صور.
- طريقة حساب التوصيل: flat / zone / weight.
- وزن الشحن مطلوب عندما تكون الطريقة `weight`.

## 4.6 استيراد المنتجات

الـTemplate الجديد يطابق قالب التطبيق في **3 Sheets**:

### `products`
15 عمودًا بالترتيب:

1. اسم المنتج
2. الفئة الفرعية
3. السعر
4. الوحدة
5. الكمية
6. متاح للبيع
7. طريقة التوصيل للمنتج
8. وزن الشحن كجم
9. العلامة التجارية (اختياري)
10. المقاس (اختياري)
11. اللون
12. رابط الصورة 1
13. رابط الصورة 2
14. رابط الصورة 3
15. ملاحظات

### `الفئات الفرعية`

- الاسم العربي.
- الاسم الإنجليزي.
- ID.

### `تعليمات`

توضح:

- العمل على Sheet products فقط.
- الحقول المطلوبة.
- الصور حتى 3 روابط.
- قيم متاح/غير متاح.
- طرق التوصيل.
- ضرورة الوزن عند weight.
- عدم تغيير أسماء الأعمدة.
- إمكانية إضافة الصور لاحقًا إذا لم توجد روابط.

### Preview ومراجعة الصفوف

- الصف الصحيح يظهر.
- الصف غير الصحيح غير الفارغ **لا يتم إسقاطه**؛ يظهر بخطأ للمستخدم حتى يصلحه أو يحذفه.
- Valid/Error count.
- تعديل Row.
- حذف Row.
- إضافة Row.
- Cancel preview.
- اعتماد الاستيراد بعد المراجعة.

### قيد Backend الحالي الموثق

`import_my_products_web` و`private.approve_product_import_internal` الحاليان يحفظان فعليًا:

- name/category/price/unit/quantity/brand/size/color/is_active.

ولا يحفظان حاليًا image links/delivery/weight في الـapproval الداخلي. Portal V2 **لا يخترع كتابة خارج Contract الموجود**؛ يحتفظ بالقيم في Preview/Template ويترك Backend الحالي مصدر الحقيقة. تغيير هذا يحتاج تعديل Supabase وهو ممنوع في هذه المهمة.

## 4.7 مواعيد العمل

- 7 أيام.
- لكل يوم Open/Closed.
- القوائم الزمنية 30 دقيقة من 00:00 حتى 23:30.
- وقت فتح/غلق مطلوب عند Open.
- Save لكل السبعة أيام.

نفس البيانات تغذي Quiet Hours/تشغيل المتجر حسب Backend الموجود.

## 4.8 التوصيل

- Enabled/Disabled.
- Pricing method: flat / zone / weight.
- Pricing rows/configuration حسب الطريقة.
- Warning عندما يكون التوصيل متوقفًا.
- عند weight: شركات شحن وشُرَح أوزان.
- إضافة/تعديل/حذف شركة شحن.
- إضافة/تعديل/حذف Weight batch.
- Primary branch free-delivery switch + minimum.

## 4.9 حالة الحساب

واجهة Read-only مطابقة لفكرة تطبيق الموبايل وليست صفحة شراء:

- حالة الحساب.
- هل يستقبل طلبات/عمل جديد.
- وضع التشغيل.
- lifecycle/status.
- سبب الإيقاف.
- رقم المؤسس إن وجد.
- بداية/نهاية الفترة المجانية.
- بداية/نهاية الحالة الحالية.
- الأيام المتبقية.
- نهاية فترة السماح وطولها.
- تاريخ الإيقاف إن وجد.

للمالك يوجد انتقال **داخل موقع Saarly Web** إلى صفحة إدارة الاشتراك. هذه الإضافة مقصودة لأن الاشتراك الجديد Web-only.

## 4.10 الدعوات والمكافآت

نفس `ReferralWorkspace` المستخدم منطقيًا مع audience=merchant:

- Banner.
- رابط وكود الدعوة.
- Share/Copy.
- إجمالي التسجيلات.
- Progress للهدف الحالي.
- المتبقي.
- Reward label من Backend.
- أول هدف منخفض إذا جاء المستخدم بدعوة وكان Backend يعيده.
- آخر مكافأة وحالتها.

## 4.11 الفروع — تم استكمال كل الـInteractions المهمة

بطاقة كل فرع تعرض:

- اسم الفرع.
- المدينة/المحافظة.
- حالة الموافقة.
- صورة الواجهة.
- هاتف المدير.
- حالة التوصيل/Inheritance.
- عدد المنتجات غير المتاحة في الفرع، أو أن كل المنتجات متاحة.
- إجمالي مبيعات الفرع من `merchant_branch_sales_summary`.
- عدد الطلبات المؤكدة.
- حالة مستندات وجه/ظهر هوية المدير.
- استخدام سجل المتجر أو سجل مستقل.
- التوصيل المجاني وحده الأدنى.
- سبب الرفض إن وجد.

Interactions:

- فتح الموقع على الخريطة.
- تفعيل/إيقاف **صنايعي متاح في هذا الفرع** inline، مثل التطبيق.
- إدارة توفر كل Product بالفرع في Modal مستقل وحفظه عبر `set_branch_product_availability`.
- Owner: إعداد سريع للتوصيل المجاني للفرع عبر `set_my_branch_free_delivery`.
- Owner: Edit branch.
- Owner: Delete branch.
- إعادة رفع/تحديث المستندات من Edit flow؛ حالات المستندات والرفض تظل ظاهرة.

إن كانت هناك مبيعات قديمة غير مرتبطة بفرع، يعرض الويب Summary مستقل `Unassigned branch sales` مثل Snapshot التطبيق.

### Add/Edit Branch

- اسم الفرع.
- المدينة.
- اسم مدير الفرع.
- هاتف المدير.
- Latitude/Longitude.
- Use current location.
- Map preview.
- Delivery inherit/enabled/disabled.
- Delivery pricing method.
- Craftsman availability.
- Free delivery + minimum.
- Storefront photo.
- Manager ID front/back.
- استخدام السجل التجاري الرئيسي أو رفع سجل مستقل.
- عند التعديل الجوهري يعود الفرع للمراجعة حسب Backend.

## 4.12 الموظفون والصلاحيات

الـRole label حقل نصي حر، مع مثال Branch lead.

الصلاحيات بنفس المفاتيح والترتيب الموجود في Flutter:

1. dashboard
2. orders
3. rfqs
4. products
5. imports
6. branches
7. hours
8. delivery
9. reports
10. billing — الاسم المعروض **حالة الحساب**
11. referrals
12. buyer_mode — محفوظ كمفتاح Backend تاريخي لكن Runtime Buyer mode معطل
13. support
14. settings

Defaults:

- dashboard = true
- orders = true
- rfqs = true
- support = true
- الباقي false

Branch scope:

- اختيار **كل الفروع** يرسل قائمة فارغة، وهو نفس Contract في Backend: `[]` = كل فروع المتجر.
- أو اختيار فروع محددة.
- الموظف Branch-scoped لا يرى حالة الحساب/الاشتراك.
- API يتحقق من `assertBranchAccess` في الإجراءات الحساسة.

## 4.13 الدعم

نفس رحلة Buyer، لكن مع permission `support` وحساب المتجر الحالي.

## 4.14 الإعدادات وStore profile

- إعدادات الحساب/اللغة/الثيم.
- بيانات المتجر القابلة للتعديل للمالك.
- Categories/Manager/Contact/Craftsman حسب Contract الحالي.
- Sign out.
- Delete account مع Confirmation المناسب.

## 4.15 التقارير والتقييمات — Web expanded surfaces

Flutter يحتوي Domain/Reports data، بينما الـWeb يعطي مساحة أوسع للجداول والتحليل:

- Sales summary.
- Branch summaries.
- Ratings/reviews.
- Top/low-stock/stale product signals.

ولا يغير أي record خارج الإجراءات الصريحة.

## 4.16 الإشعارات

- قائمة الإشعارات.
- Read/unread.
- Mark one/all.
- نفس Backend notification records.

---

# 5. اشتراك Saarly Web — مصدره Admin + Supabase

هذه الواجهة **ليست نسخة من صفحة Account Status في الموبايل**؛ هي Web-only management surface مقصودة.

## 5.1 الباقات

تقرأ من `subscription_plans`:

- `name_ar/name_en`
- description
- السعر الحالي
- old price
- العملة
- duration_days
- grace_months
- features_ar/features_en
- is_active
- sort_order
- plan_code / plan_type

القيم الحية وقت المراجعة:

- 30 يومًا — 499 EGP.
- 182 يومًا — 2499 EGP، old price 2999.
- 365 يومًا — 4499 EGP، old price 5499.

لا توجد خصومات نشطة في `subscription_discounts` وقت المراجعة.

## 5.2 الخصومات

حساب السعر لا يتم في الـClient بالافتراض؛ يعتمد على Contract الخادم `private.subscription_price_snapshot` و`private.best_subscription_discount`:

- Active window.
- usage limit العام.
- first_subscription / renewal / both.
- plan targeting.
- merchant targeting.
- priority.
- percent أو fixed amount.

وبالتالي أي خصم يضيفه Admin لاحقًا يصل للPortal من نفس المصدر.

## 5.3 التحويل اليدوي

عند تشغيل `manual_payments_enabled` ووجود Method فعال:

- يختار المتجر الباقة.
- يختار طريقة التحويل.
- يرى Account label/number/holder/instructions كما يحددها Admin.
- Contact email.
- Transfer reference.
- رفع إثبات الدفع ضمن MIME/max size الموجودين في `manual_payment_methods`.
- إنشاء الطلب عبر `portal_create_manual_subscription_payment_request`.
- السعر النهائي snapshot يحسبه Backend، لا يتم الوثوق في قيمة Client.
- تظهر الطلبات السابقة وحالتها وسبب الرفض وإثباتها الموقّع.

## 5.4 الدفع الإلكتروني

تمت مراجعة:

- `payment_settings`
- Feature flags.
- `payment-webhook` Edge Function.
- RPCs التي تنشئ `payment_transactions`.

لكن لا يوجد حاليًا Frontend Checkout Session contract مكتمل يُرجع Payment URL/session للمتصفح. لذلك Portal V2:

- يعرض حالة Gateway/Availability بشكل واضح.
- لا يعرض زر **ادفع الآن** إلكترونيًا إذا لم توجد Integration فعلية.
- لا ينشئ رابطًا وهميًا أو Provider redirect من عنده.

وقت المراجعة Visa/Wallet/Vodafone Cash/Meeza كلها disabled/not configured/not connected.

## 5.5 Feature Flags الحية وقت المراجعة

القيم المهمة التي قُرئت بدون تعديل:

- `monetization_enabled = false`
- `monetization_enforcement_enabled = false`
- `merchant_monthly_subscription_enabled = false`
- `merchant_can_choose_billing_model = false`
- `merchant_commission_enabled = false`
- `manual_payments_enabled = true`
- `electronic_payments_enabled = true`
- `automatic_payment_enabled = false`
- `billing_grace_enabled = false`
- `grace_period_enabled = true`
- `referrals_enabled = true`
- `price_alerts = true`

Portal V2 لا hardcode قرار تشغيل النظام؛ يقرأ الإعدادات الحالية، ولذلك تشغيل الميزات من Admin ينعكس على Web contracts الموجودة، مع بقاء Electronic Checkout غير متاح حتى يصبح Gateway contract حقيقيًا.

---

# 6. ما تمت مراجعته في Admin Web

واجهة Monetization الحالية في Admin تحتوي tabs:

1. الملخص.
2. التحويلات اليدوية.
3. الدفع الإلكتروني.
4. الباقات والخصومات.
5. طرق الدفع.
6. المؤسسون والمتاجر.
7. العمولات.
8. الدعوات والمكافآت.
9. البريد والتقارير.

وتتحكم في:

- Monetization master switch.
- Enforcement.
- Merchant subscriptions.
- Commission mode.
- السماح للمتجر باختيار Billing model.
- Manual payments.
- Electronic payments.
- Grace period.
- Receiving during grace.
- Billing reminders.
- Founder counting.
- Founder free trial.
- Plans.
- Discounts وتوجيهها لخطة/متجر.
- Manual payment methods ومعلومات التحويل والـMIME/max file size.
- Gateway provider/config/test state.
- مراجعة manual payment requests: approve/reject وتعديل الخطة عند الحاجة حسب Admin flow.
- Founder tiers حسب رقم المتجر.
- Test account.
- Billing preference لكل متجر.
- Founder/Trusted badges.
- Commission settings.
- Referral/reward controls.

Portal V2 لا ينسخ Admin logic داخله؛ يقرأ نفس الجداول/RPCs التي يديرها Admin، وبالتالي يظل Admin هو Control plane.

---

# 7. Supabase contracts التي تم تتبعها

تمت مراجعة جداول/RPCs المرتبطة بالوظائف، ومنها:

- users / merchants / branches / merchant_documents / merchant_staff_members.
- products / categories / branch_product_availability / product imports.
- quote_requests / quote_items / offers / buyer_offer_results.
- rfq_requests / rfq_request_items / rfq_responses.
- orders / order_merchant_fulfillments / fulfillment items.
- favorites / price_alerts.
- reviews.
- notifications.
- merchant_working_hours.
- delivery settings / shipping companies / shipping batches.
- chat_conversations / chat_messages / support ratings.
- subscription_plans / subscription_discounts / joins.
- merchant_subscriptions.
- manual_payment_methods / manual_payment_requests.
- payment_settings / payment_transactions.
- referrals / referral rewards.
- feature_flags.

RPCs الأساسية التي تم تتبعها تشمل، دون أن تكون هذه قائمة للـSchema بالكامل:

- Buyer offer/RFQ acceptance and preview RPCs.
- `my_merchant_rfq_requests`.
- `submit_rfq_response`.
- `merchant_branch_sales_summary`.
- `set_branch_product_availability`.
- `set_my_branch_free_delivery`.
- `upsert_my_merchant_staff_member`.
- `import_my_products_web`.
- `my_monetization_dashboard`.
- `portal_create_manual_subscription_payment_request`.
- `my_referral_dashboard_for`.
- Support conversation RPCs.

لا توجد Migration أو Function أو Row تم تعديلها أثناء هذه المهمة.

---

# 8. UI/UX Web adaptation

المحتوى مطابق للتطبيق، لكن الشكل ليس Mobile screen مكبّرة. التنفيذ يعتمد على:

- Responsive sidebar على Desktop.
- Top bar واضح.
- Bottom navigation للعناصر الأساسية على الشاشات الصغيرة.
- More sheet للمحتوى الثانوي على Mobile.
- Cards للأعمال السريعة والـmetrics.
- Tables للبيانات الكثيفة على Desktop مع wrappers للشاشات الأصغر.
- Modals للعمليات المركزة: فرع، توفر المنتجات، التوصيل المجاني، تفاصيل/تأكيدات.
- Progressive disclosure: الخيارات المعقدة تظهر عند الحاجة فقط.
- Focused forms مع groupings واضحة.
- Empty/error/loading/success states.
- RTL/LTR حقيقي.
- Light/Dark.
- Touch-friendly controls.
- `role="dialog"` و`aria-modal="true"` في الـmodals المهمة.
- عدم وضع العملية الأساسية خلف عدة clicks بلا داعٍ.

تمت مراجعة مبادئ التصميم من Material Design adaptive layouts/components وحالات التفاعل، WCAG target sizing، وIBM Carbon patterns للجداول والحوارات، وتم تطبيق المبادئ التي تناسب Saarly بدل نسخ شكل Design System خارجي.

---

# 9. نقاط Backend تم احترامها بدل اختراع سلوك

1. **Buyer payment:** غير متاح، ولم يتم إحياؤه.
2. **Merchant Buyer Mode:** معطل، ولم يتم إحياؤه.
3. **Electronic subscription checkout:** لا توجد Checkout API جاهزة؛ لم يتم اختراع واحدة.
4. **Product import advanced columns:** Template/Preview يحافظان عليها، لكن Backend الحالي لا يحفظ بعضها؛ لم يتم تعديل Supabase.
5. **Account status:** مصدره `my_monetization_dashboard`، لا Calculation محلي بديل.
6. **Plan/discount price:** مصدره Backend snapshot rules، وليس Client assumptions.
7. **Admin flags:** لا يتم Override من الواجهة.

---

# 10. ملفات البيئة المطلوبة للتشغيل الفعلي

ملفات `.env*` لم تكن موجودة داخل الملفات المضغوطة، وهذا طبيعي وأفضل أمنيًا. لم يتم اعتبار Secrets ملفات ناقصة يجب رفعها هنا.

Landing Runtime يحتاج على الأقل حسب الكود الحالي:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EMAIL_DISPATCH_SECRET`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `SUPPORT_NOTIFICATION_EMAIL`

وقد يستخدم اختياريًا إعدادات Site/Social/Store URL/Support phone الموجودة في المشروع.

يجب وضع Secrets في بيئة التطوير/الاستضافة فقط، وليس إرسالها في المحادثة أو إضافتها إلى ZIP عام.

---

# 11. النتيجة

Portal V2 الحالي يعامل Flutter + Admin + Supabase كمصادر حقيقة مستقلة للقراءة، ويعدل Landing فقط. الـCore Buyer/Merchant flows وترتيبها وأفعالها وحالاتها مغطاة، والـWeb-only subscription management مربوط بنفس Admin/Supabase contracts بدل النظام القديم للPortal.
