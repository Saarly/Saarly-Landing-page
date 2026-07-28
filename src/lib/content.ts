export type Lang = "ar" | "en";

export const publicLinks = [
  { href: "/", ar: "الرئيسية", en: "Home" },
  { href: "/support", ar: "الدعم", en: "Support" },
  { href: "/privacy", ar: "الخصوصية", en: "Privacy" },
  { href: "/terms", ar: "الشروط", en: "Terms" },
  { href: "/login", ar: "دخول المشتري", en: "Buyer login" },
  { href: "/merchant-login", ar: "دخول التاجر", en: "Merchant login" }
];


export const buyerLinks = [
  { href: "/buyer", ar: "الرئيسية", en: "Home" },
  { href: "/buyer/requests", ar: "طلباتي والعروض", en: "Requests & offers" },
  { href: "/buyer/orders", ar: "الطلبات المقبولة", en: "Orders" },
  { href: "/buyer/stores", ar: "المتاجر والمنتجات", en: "Stores & products" },
  { href: "/buyer/favorites", ar: "المفضلة", en: "Favorites" },
  { href: "/buyer/alerts", ar: "تنبيهات الأسعار", en: "Price alerts" },
  { href: "/buyer/notifications", ar: "الإشعارات", en: "Notifications" },
  { href: "/buyer/referrals", ar: "ادعُ أصحابك", en: "Referrals" },
  { href: "/buyer/support", ar: "الدعم والمساعدة", en: "Support" },
  { href: "/buyer/settings", ar: "الإعدادات", en: "Settings" },
];

export const buyerSections = new Set([
  "requests", "orders", "stores", "favorites", "alerts", "notifications", "referrals", "support", "settings",
]);

export const merchantLinks = [
  { href: "/merchant", ar: "الرئيسية", en: "Overview" },
  { href: "/merchant/store", ar: "المتجر", en: "Store" },
  { href: "/merchant/products", ar: "المنتجات", en: "Products" },
  { href: "/merchant/imports", ar: "استيراد المنتجات", en: "Product imports" },
  { href: "/merchant/requests", ar: "التسعير", en: "Requests" },
  { href: "/merchant/orders", ar: "الطلبات", en: "Orders" },
  { href: "/merchant/branches", ar: "الفروع", en: "Branches" },
  { href: "/merchant/hours", ar: "مواعيد العمل", en: "Working hours" },
  { href: "/merchant/delivery", ar: "التوصيل والشحن", en: "Delivery" },
  { href: "/merchant/reports", ar: "التقارير", en: "Reports" },
  { href: "/merchant/reviews", ar: "التقييمات", en: "Reviews" },
  { href: "/merchant/employees", ar: "الموظفون", en: "Employees" },
  { href: "/merchant/notifications", ar: "الإشعارات", en: "Notifications" },
  { href: "/merchant/referrals", ar: "الدعوات", en: "Referrals" },
  { href: "/merchant/support", ar: "دعم سعرلي", en: "Saarly support" },
  { href: "/buyer", ar: "وضع المشتري", en: "Buyer mode" },
  { href: "/merchant/billing", ar: "الاشتراك", en: "Billing" },
  { href: "/merchant/payments", ar: "المدفوعات", en: "Payments" },
  { href: "/merchant/settings", ar: "الإعدادات", en: "Settings" }
];

export const merchantSections = new Set([
  "store", "products", "imports", "requests", "orders", "branches", "hours", "delivery", "reports", "reviews", "employees", "notifications", "referrals", "support", "buyer", "billing", "payments", "settings"
]);

export const policies = {
  privacy: {
    arTitle: "سياسة الخصوصية",
    enTitle: "Privacy Policy",
    ar: [
      "نستخدم بيانات الحساب والموقع والطلبات لتشغيل خدمة المقارنة والتسعير والتواصل الآمن بين المشتري والتاجر.",
      "لا نعرض رقم هاتف المتجر أو بيانات التواصل الخاصة إلا في المواضع المسموح بها بعد نجاح الطلب.",
      "لا نبيع بيانات المستخدمين. قد نستخدم مزودي خدمة آمنين للتشغيل والتحليلات والإشعارات."
    ],
    en: [
      "We use account, location, and request data to run comparisons, quotes, and safe buyer-store communication.",
      "Store contact details are not shown publicly and only appear in allowed flows after a successful request.",
      "We do not sell user data. Trusted providers may help with hosting, analytics, and notifications."
    ]
  },
  terms: {
    arTitle: "شروط الاستخدام",
    enTitle: "Terms of Use",
    ar: [
      "استخدام سعرلي يعني الالتزام بإدخال بيانات صحيحة وعدم إساءة استخدام الطلبات أو الرسائل.",
      "الأسعار والعروض يحددها التجار وقد تتغير حسب التوفر ومكان التسليم.",
      "إدارة اشتراك التاجر والمدفوعات الخاصة به تتم من بوابة التاجر فقط."
    ],
    en: [
      "Using Saarly means providing accurate data and avoiding misuse of requests or messages.",
      "Prices and offers are set by stores and may change based on availability and delivery location.",
      "Merchant subscriptions and merchant payments are managed only through the merchant portal."
    ]
  },
  refund: {
    arTitle: "سياسة الاسترداد",
    enTitle: "Refund Policy",
    ar: [
      "أي استرداد مرتبط باشتراك التاجر أو مدفوعاته تتم مراجعته من خلال بوابة التاجر والدعم.",
      "طلبات الشراء بين المشتري والتاجر تخضع لتأكيد الطرفين وسياسة المتجر والقانون المحلي.",
      "نراجع الطلبات العادلة بسرعة ونبلغ صاحب الحساب عبر البريد المسجل."
    ],
    en: [
      "Refunds related to merchant subscriptions or payments are reviewed through the merchant portal and support.",
      "Buyer-store purchase requests depend on both parties, store policy, and local law.",
      "Fair requests are reviewed promptly and updates are sent to the registered email."
    ]
  },
  deleteAccount: {
    arTitle: "حذف الحساب",
    enTitle: "Delete Account",
    ar: [
      "يمكنك طلب حذف الحساب من داخل التطبيق أو من نموذج الدعم في هذه الصفحة.",
      "قد نحتفظ بسجلات محدودة مطلوبة للالتزامات القانونية أو منع إساءة الاستخدام.",
      "بعد المراجعة، سيتم إرسال تأكيد إلى البريد المسجل."
    ],
    en: [
      "You can request account deletion from the app or from the support form on this page.",
      "Limited records may be retained for legal obligations or abuse prevention.",
      "After review, confirmation is sent to the registered email."
    ]
  }
};
