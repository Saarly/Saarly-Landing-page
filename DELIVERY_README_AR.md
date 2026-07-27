# Landing Page — نسخة المراجعة الثانية

1. غيّر اسم مجلد `Landing Page` الحالي إلى `Landing Page OLD`.
2. ضع هذا المجلد مكانه باسم `Landing Page`.
3. انسخ `.env.local` من النسخة القديمة.
4. أضف إلى `.env.local`:

```env
NEXT_PUBLIC_SUPPORT_EMAIL=info@saarly.app
SUPPORT_NOTIFICATION_EMAIL=info@saarly.app
EMAIL_DISPATCH_SECRET=نفس السر الموجود في Supabase
```

5. شغّل:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

6. افتح `http://localhost:3100` وراجع الصفحة الرئيسية باللغتين والوضعين، ثم صفحة `/merchant-login` وصفحة `/support`.

لا تشغّل أي SQL ولا تنقل ملفات قاعدة بيانات إلى هذا المشروع؛ تعديلات هذه النسخة تخص الواجهة والربط الموجود فقط.
