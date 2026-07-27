# إصلاح بناء Vercel

تم إصلاح خطأ prerender الخاص بصفحة `/_not-found`.

السبب كان استيراد الدالة `t` من ملف Client Component ثم استدعاؤها أثناء الرندر على السيرفر.

التعديل:
- نقل الدالة `t` إلى `src/lib/locale.ts` لتكون دالة مشتركة وآمنة للسيرفر والعميل.
- تحديث الاستيراد داخل `src/components/brand.tsx` و`src/components/public-site.tsx`.
- الإبقاء على إصلاح التحقق من وجود Supabase قبل `getSession`.
