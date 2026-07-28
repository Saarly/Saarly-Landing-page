# إصلاح TypeScript الخاص ببناء Vercel

## الخطأ

كان Next.js يستنتج أن ناتج `loadOffers` هو مصفوفة من عناصر تحتوي على `items` فقط، ولذلك ظهر الخطأ:

```text
Property 'status' does not exist on type '{ items: Row[]; }'.
```

## الإصلاح

تم تثبيت عقد النوع الخاص بالدالة والصفوف الناتجة صراحة:

```ts
async function loadOffers(context: BuyerContext, limit = 120): Promise<Row[]>
```

وكذلك:

```ts
return offerRows.map((offer): Row => ({
  ...offer,
  items: itemMap.get(value(offer.id)) ?? [],
}));
```

كما تم تثبيت نوع عناصر النسخة الاحتياطية عند استرجاع بنود الطلب لتجنب أخطاء `implicit any` اللاحقة.

## التحقق

- فحص TypeScript معزول لجميع ملفات API نجح دون أخطاء.
- اختبارات المشروع: 39 اختبارًا ناجحًا.
- لم يتم تشغيل `next build` محليًا لأن بيئة العمل لا تستطيع الوصول إلى npm لتنزيل الحزم؛ Vercel سيجري البناء الكامل بعد رفع النسخة.
