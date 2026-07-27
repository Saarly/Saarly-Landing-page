# دليل نشر Landing Page وبوابة المتاجر

## قبل تشغيل الموقع

1. خذ Backup من Supabase.
2. طبّق ملف `APPLY_IN_SUPABASE_SQL_EDITOR.sql` الموجود في حزمة إصلاح Supabase.
3. شغّل `VERIFY_AFTER_APPLY.sql` وتأكد من ظهور رسالة النجاح.
4. انشر Edge Functions الخاصة بالبريد واضبط Secrets.
5. انشر Admin Web.
6. انشر Landing Page وبوابة المتاجر.
7. ابنِ تطبيق Flutter بعد ذلك.

## متغيرات البيئة

انسخ `.env.example` إلى `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPPORT_EMAIL
NEXT_PUBLIC_SUPPORT_PHONE
NEXT_PUBLIC_GOOGLE_PLAY_URL
NEXT_PUBLIC_APP_STORE_URL
NEXT_PUBLIC_FACEBOOK_URL
NEXT_PUBLIC_INSTAGRAM_URL
NEXT_PUBLIC_LINKEDIN_URL
```

`SUPABASE_SERVICE_ROLE_KEY` متغير Server-only ولا يوضع في Flutter أو في متغير يبدأ بـ`NEXT_PUBLIC_`.

## أوامر الفحص والبناء

```powershell
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npm run dev
```

## سيناريوهات الاختبار الضرورية

- تسجيل دخول صاحب متجر معتمد.
- منع حساب مشتري عادي من البوابة.
- اختبار موظف بصلاحية محدودة ومحاولة فتح رابط قسم غير مسموح.
- إضافة وتعديل منتج ورفع صورته.
- استيراد CSV وXLSX ومراجعة أخطاء الصفوف.
- الرد على طلب تسعير عام ومخصوص.
- إدارة فرع ورفع وجهي بطاقة المدير.
- إنشاء موظف وتغيير صلاحياته.
- إنشاء طلب دفع يدوي ورفع إثبات خاص.
- اختبار الدعم وحذف الحساب واستعادة كلمة المرور.
- اختبار العربية والإنجليزية وRTL/LTR والثيم والموبايل.
