# Saarly Landing Page & Merchant Portal

المشروع يحتوي على:

- Landing Page ثنائية اللغة بهوية Saarly وحركات وتأثيرات متجاوبة.
- صفحات الخصوصية والشروط والاسترداد وحذف الحساب والدعم.
- تسجيل دخول واستعادة كلمة المرور للمتاجر.
- بوابة متجر كاملة لإدارة البيانات والمنتجات والطلبات وطلبات التسعير والفروع والموظفين والإشعارات والاشتراك والمدفوعات والإعدادات.

## التشغيل المحلي

انسخ `.env.example` إلى `.env.local` ثم املأ القيم الصحيحة:

```powershell
npm ci
npm run test
npm run typecheck
npm run lint
npm run build
npm run dev
```

افتح:

```text
http://localhost:3000
```

## ترتيب الربط

يجب تطبيق حزمة إصلاح Supabase أولًا ثم تشغيل الموقع؛ لأن بوابة المتاجر تعتمد على RPCs وسياسات Storage الجديدة.

## ملاحظات أمنية

- لا تضع `SUPABASE_SERVICE_ROLE_KEY` في متغير يبدأ بـ`NEXT_PUBLIC_`.
- ملفات المستندات وإثباتات الدفع ترفع إلى Buckets خاصة من مسارات سيرفر مصرح بها.
- الدفع الإلكتروني لا يظهر كعملية حقيقية ما لم يتم تركيب Adapter فعلي لمقدم دفع.

راجع:

- `LANDING_PORTAL_FIX_REPORT_AR.md`
- `DEPLOYMENT_GUIDE_AR.md`
