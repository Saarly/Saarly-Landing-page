export type PortalRow = Record<string, unknown>;
export type PortalPayload = {
  account: {
    userId: string;
    email: string;
    profile: PortalRow;
    merchant: PortalRow;
    merchantId: string;
    isOwner: boolean;
    staff: PortalRow | null;
    branchIds?: string[];
    currencyCode?: string;
    unreadNotifications?: number;
  };
  section: string;
  data: PortalRow;
};

export function row(value: unknown): PortalRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PortalRow : {};
}

export function rows(value: unknown): PortalRow[] {
  return Array.isArray(value) ? value.filter((item): item is PortalRow => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

export function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  if (!result || ["null", "undefined", "not_provided", "not provided"].includes(result.toLowerCase())) return fallback;
  return result;
}

export function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function dateLabel(value: unknown, locale: "ar" | "en") {
  const raw = text(value);
  if (!raw) return locale === "ar" ? "غير محدد" : "Not set";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return locale === "ar" ? "غير محدد" : "Not set";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function money(value: unknown, currency: unknown = "EGP", locale: "ar" | "en" = "ar") {
  const currencyCode = text(currency, "EGP").toUpperCase();
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-GB", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(numberValue(value));
  } catch {
    return `${numberValue(value).toFixed(2)} ${currencyCode}`;
  }
}

export const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد الانتظار", en: "Pending" },
  awaiting_confirmation: { ar: "بانتظار تأكيد المتجر", en: "Awaiting store confirmation" },
  pending_merchant_confirmation: { ar: "بانتظار تأكيد المتجر", en: "Awaiting store confirmation" },
  pending_review: { ar: "بانتظار المراجعة", en: "Pending review" },
  approved: { ar: "معتمد", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  error: { ar: "يحتاج تصحيح", en: "Needs correction" },
  active: { ar: "فعّال", en: "Active" },
  inactive: { ar: "غير فعّال", en: "Inactive" },
  trialing: { ar: "فترة مجانية", en: "Free trial" },
  free_trial: { ar: "فترة مجانية", en: "Free trial" },
  pre_launch_access: { ar: "وصول قبل بدء المحاسبة", en: "Pre-launch access" },
  subscription_active: { ar: "اشتراك فعّال", en: "Active subscription" },
  commission_active: { ar: "نظام العمولة فعّال", en: "Commission active" },
  grace_period: { ar: "فترة سماح", en: "Grace period" },
  past_due: { ar: "مستحق", en: "Past due" },
  suspended: { ar: "موقوف", en: "Suspended" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
  expired: { ar: "منتهي", en: "Expired" },
  submitted: { ar: "تم الإرسال", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  confirmed: { ar: "مؤكد", en: "Confirmed" },
  completed: { ar: "مكتمل", en: "Completed" },
  cancelled_by_merchant: { ar: "ألغاه المتجر", en: "Cancelled by store" },
  open: { ar: "مفتوح", en: "Open" },
  bot: { ar: "المساعد الآلي", en: "AI assistant" },
  transferred: { ar: "مع خدمة العملاء", en: "With customer support" },
  connected: { ar: "متصل", en: "Connected" },
  configured: { ar: "معدّ", en: "Configured" },
  not_configured: { ar: "غير معدّ", en: "Not configured" },
  in_support: { ar: "مع فريق الدعم", en: "With support" },
  escalated: { ar: "تم التصعيد", en: "Escalated" },
  resolved: { ar: "تم الحل", en: "Resolved" },
  closed: { ar: "مغلق", en: "Closed" },
  manual_quote: { ar: "تسعير يدوي", en: "Manual quote" },
  catalog: { ar: "كتالوج وأسعار", en: "Catalog" },
  monthly_subscription: { ar: "اشتراك شهري", en: "Monthly subscription" },
  commission: { ar: "عمولة على المبيعات", en: "Sales commission" },
  flat: { ar: "سعر ثابت", en: "Flat rate" },
  zone: { ar: "حسب المنطقة", en: "By zone" },
  weight: { ar: "حسب الوزن", en: "By weight" },
  uploaded: { ar: "تم الرفع", en: "Uploaded" },
  parsing: { ar: "جارٍ التحليل", en: "Parsing" },
  reviewed: { ar: "تمت المراجعة", en: "Reviewed" },
  accepted: { ar: "مقبول", en: "Accepted" },
  undecided: { ar: "لم يقرر العميل", en: "Buyer has not decided" },
  tshirt: { ar: "تيشرت", en: "T-shirt" },
  football: { ar: "كرة قدم", en: "Football" },
  cap: { ar: "كاب", en: "Cap" },
  waiting: { ar: "بانتظار التحديث", en: "Waiting" },
  best_price: { ar: "أفضل سعر", en: "Best price" },
  price_drop: { ar: "انخفاض سعر", en: "Price drop" },
  store: { ar: "متجر", en: "Store" },
  product: { ar: "منتج", en: "Product" },
  debit: { ar: "خصم", en: "Debit" },
  credit: { ar: "إضافة رصيد", en: "Credit" },
  charge: { ar: "رسوم", en: "Charge" },
  payment: { ar: "دفعة", en: "Payment" },
  adjustment: { ar: "تسوية", en: "Adjustment" },
  due: { ar: "مستحق", en: "Due" },
  paid: { ar: "مدفوع", en: "Paid" },
  overdue: { ar: "متأخر", en: "Overdue" },
  direct: { ar: "طلب مخصوص", en: "Direct request" },
  broadcast: { ar: "طلب عام", en: "Broadcast request" },
  processing: { ar: "جارٍ المعالجة", en: "Processing" },
  failed: { ar: "فشل", en: "Failed" },
  needs_review: { ar: "يحتاج مراجعة", en: "Needs review" },
  draft: { ar: "مسودة", en: "Draft" },
  offer_ready: { ar: "العروض جاهزة", en: "Offers ready" },
  partially_confirmed: { ar: "مؤكد جزئيًا", en: "Partially confirmed" },
  merchant_confirmed: { ar: "أكد المتجر", en: "Store confirmed" },
  buyer_accepted: { ar: "وافق المشتري", en: "Buyer accepted" },
  not_required: { ar: "غير مطلوب", en: "Not required" },
  pending_payment: { ar: "بانتظار الدفع", en: "Pending payment" },
  price_changed: { ar: "السعر اتغيّر", en: "Price changed" },
  price_up: { ar: "السعر زاد", en: "Price increased" },
  price_down: { ar: "السعر انخفض", en: "Price decreased" },
  no_change: { ar: "بدون تغيير", en: "No change" },
  available: { ar: "متاح", en: "Available" },
  unavailable: { ar: "غير متاح", en: "Unavailable" },
};

export function statusLabel(value: unknown, locale: "ar" | "en") {
  const key = text(value, "unknown").toLowerCase();
  return STATUS_LABELS[key]?.[locale] ?? (locale === "ar" ? "غير محدد" : "Not specified");
}

export function statusTone(value: unknown) {
  const key = text(value).toLowerCase();
  if (["approved", "active", "confirmed", "completed", "resolved", "subscription_active", "commission_active", "accepted"].includes(key)) return "success";
  if (["rejected", "suspended", "cancelled", "cancelled_by_merchant", "expired", "error"].includes(key)) return "danger";
  if (["pending", "under_review", "pending_review", "trialing", "free_trial", "grace_period", "past_due", "pending_merchant_confirmation", "awaiting_confirmation", "escalated"].includes(key)) return "warning";
  return "neutral";
}

const ERROR_LABELS: Record<string, { ar: string; en: string }> = {
  authentication_required: { ar: "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.", en: "Your session ended. Sign in again." },
  buyer_access_required: { ar: "الحساب غير متاح في بوابة المشتري.", en: "This account cannot access the buyer portal." },
  buyer_section_not_found: { ar: "صفحة المشتري المطلوبة غير موجودة.", en: "The requested buyer page does not exist." },
  buyer_action_not_found: { ar: "الإجراء المطلوب غير متاح.", en: "The requested action is unavailable." },
  buyer_portal_request_failed: { ar: "تعذر تنفيذ الطلب في بوابة المشتري.", en: "The buyer portal request failed." },
  support_title_too_short: { ar: "اكتب عنوانًا واضحًا للشكوى من 15 حرفًا على الأقل.", en: "Enter a clear complaint title of at least 15 characters." },
  support_conversation_not_found: { ar: "محادثة الدعم غير موجودة أو لا تخص حسابك.", en: "The support conversation was not found for your account." },
  support_load_failed: { ar: "تعذر تحميل محادثة الدعم.", en: "Could not load the support conversation." },
  support_send_failed: { ar: "تعذر إرسال رسالة الدعم.", en: "Could not send the support message." },
  support_create_failed: { ar: "تعذر إنشاء شكوى جديدة.", en: "Could not create a new complaint." },
  support_close_failed: { ar: "تعذر إنهاء محادثة الدعم.", en: "Could not close the support conversation." },
  support_rating_failed: { ar: "تعذر حفظ تقييم الدعم.", en: "Could not save the support rating." },
  profile_data_required: { ar: "اكتب الاسم ورقم الهاتف بشكل صحيح.", en: "Enter a valid name and phone number." },
  full_name_required: { ar: "اكتب الاسم بالكامل.", en: "Enter your full name." },
  mobile_required: { ar: "اكتب رقم الهاتف.", en: "Enter your phone number." },
  quote_not_found_for_current_buyer: { ar: "طلب التسعير غير موجود أو لا يخص حسابك.", en: "The quote request was not found for your account." },
  offers_require_approved_quote: { ar: "راجع عناصر الطلب واعتمدها قبل جلب العروض.", en: "Review and approve the request items before generating offers." },
  rfq_requires_approved_quote: { ar: "اعتمد الطلب قبل إرساله للمتاجر.", en: "Approve the request before sending it to stores." },
  rfq_has_no_uncovered_items: { ar: "كل المنتجات مغطاة بالفعل ولا يوجد ما يحتاج طلبًا إضافيًا.", en: "All items are already covered; no extra RFQ is needed." },
  rfq_response_not_found: { ar: "رد المتجر غير موجود أو لم يعد متاحًا.", en: "The store response was not found or is no longer available." },
  shipping_weight_not_covered: { ar: "الوزن المدخل غير مغطى في باقات شركة الشحن.", en: "The entered weight is not covered by the shipping tiers." },
  order_not_found: { ar: "الطلب غير موجود أو لا يخص حسابك.", en: "The order was not found for your account." },
  invalid_favorite_type: { ar: "نوع المفضلة غير صحيح.", en: "Invalid favorite type." },
  search_text_required: { ar: "اكتب كلمة البحث أولًا.", en: "Enter a search phrase first." },
  upload_failed: { ar: "تعذر رفع الملف. حاول مرة أخرى.", en: "The file could not be uploaded. Try again." },
  analysis_failed: { ar: "تعذر تحليل الملف. جرّب ملفًا أوضح أو اكتب الطلب يدويًا.", en: "The file could not be analyzed. Try a clearer file or enter the request manually." },
  ai_not_configured: { ar: "تحليل الملفات غير متاح مؤقتًا. استخدم الإدخال اليدوي.", en: "File analysis is temporarily unavailable. Use manual entry." },
  invalid_session: { ar: "جلسة الدخول غير صالحة. سجّل الدخول من جديد.", en: "The session is invalid. Sign in again." },
  profile_incomplete: { ar: "بيانات الحساب غير مكتملة.", en: "The account profile is incomplete." },
  buyer_account_not_allowed: { ar: "هذا البريد مسجل كمشتري. استخدم حساب متجر أو أنشئ حساب متجر جديد.", en: "This email belongs to a buyer account. Use or create a merchant account." },
  merchant_account_required: { ar: "الحساب غير مرتبط بمتجر.", en: "The account is not linked to a store." },
  merchant_registration_required: { ar: "أكمل تسجيل المتجر أو ادخل بحساب مشتري.", en: "Complete store registration or sign in with a buyer account." },
  merchant_pending_approval: { ar: "طلب المتجر ما زال قيد المراجعة.", en: "The store application is still under review." },
  merchant_registration_rejected: { ar: "طلب المتجر مرفوض. افتح صفحة التسجيل لمراجعة السبب وإعادة الإرسال.", en: "The store application was rejected. Open registration to review the reason and resubmit." },
  merchant_suspended: { ar: "المتجر موقوف من الإدارة. تواصل مع الدعم.", en: "The store is suspended by administration. Contact support." },
  account_blocked: { ar: "الحساب موقوف. تواصل مع الدعم.", en: "The account is blocked. Contact support." },
  merchant_owner_required: { ar: "الإجراء متاح لصاحب المتجر فقط.", en: "This action is available only to the store owner." },
  section_permission_required: { ar: "ليس لديك صلاحية لفتح هذا القسم.", en: "You do not have permission to open this section." },
  branch_scope_required: { ar: "ليس لديك صلاحية لهذا الفرع.", en: "You do not have permission for this branch." },
  file_too_large: { ar: "حجم الملف أكبر من المسموح.", en: "The file is larger than allowed." },
  unsupported_file_type: { ar: "نوع الملف غير مدعوم.", en: "This file type is not supported." },
  both_manager_id_sides_required: { ar: "ارفع وجهي بطاقة مدير الفرع.", en: "Upload both sides of the branch manager ID." },
  message_required: { ar: "اكتب رسالة قبل الإرسال.", en: "Write a message before sending." },
  chat_available_after_acceptance: { ar: "المحادثة تصبح متاحة بعد قبول الطلب.", en: "Chat becomes available after the order is accepted." },
  own_store_hidden_in_buyer_mode: { ar: "متجرك لا يظهر لك في وضع المشتري.", en: "Your own store is hidden in buyer mode." },
  phone_already_used: { ar: "رقم الهاتف مستخدم في حساب آخر.", en: "The phone number is used by another account." },
  merchant_role_required: { ar: "الحساب لازم يكون مسجل كمتجر.", en: "The account must be registered as a merchant." },
  missing_required_registration_data: { ar: "أكمل كل بيانات التسجيل المطلوبة.", en: "Complete all required registration details." },
  document_storage_object_not_owned: { ar: "أحد الملفات غير مرتبط بالحساب. أعد اختياره ثم أرسل الطلب.", en: "One file is not linked to the account. Select it again and resubmit." },
  branch_data_incomplete: { ar: "أكمل اسم الفرع وبيانات المدير.", en: "Complete the branch and manager details." },
  invalid_branch_location: { ar: "موقع الفرع غير صحيح. استخدم موقعك الحالي أو راجع الإحداثيات.", en: "The branch location is invalid. Use your current location or review the coordinates." },
  commercial_register_required: { ar: "ارفع السجل التجاري المستقل أو اختر استخدام سجل المتجر الرئيسي.", en: "Upload a separate commercial register or use the main store register." },
  import_rows_required: { ar: "الملف لا يحتوي على صفوف منتجات قابلة للقراءة.", en: "The file has no readable product rows." },
  import_rows_limit_exceeded: { ar: "الحد الأقصى 500 منتج في عملية الاستيراد الواحدة.", en: "A single import is limited to 500 products." },
  spreadsheet_has_no_valid_products: { ar: "لم نجد منتجات سليمة داخل الملف. راجع أسماء الأعمدة والقيم.", en: "No valid products were found. Review column names and values." },
  import_permission_required: { ar: "ليس لديك صلاحية استيراد المنتجات.", en: "You do not have product import permission." },
  product_permission_required: { ar: "ليس لديك صلاحية إدارة المنتجات.", en: "You do not have product management permission." },
  order_permission_required: { ar: "ليس لديك صلاحية إدارة الطلبات.", en: "You do not have order management permission." },
  buyer_mode_permission_required: { ar: "وضع المشتري غير متاح لصلاحيات هذا الحساب.", en: "Buyer mode is not available for this account's permissions." },
  unsupported_upload_kind: { ar: "نوع الرفع غير مدعوم.", en: "This upload type is not supported." },
  file_required: { ar: "اختر ملفًا أولًا.", en: "Choose a file first." },
  buyer_store_not_available: { ar: "المتجر غير متاح حاليًا في وضع المشتري.", en: "This store is not currently available in buyer mode." },
  buyer_product_not_available: { ar: "المنتج غير متاح حاليًا.", en: "This product is not currently available." },
  city_not_found: { ar: "المدينة غير متاحة. اختر مدينة أخرى.", en: "The city is unavailable. Choose another city." },
  quote_items_required: { ar: "أضف منتجًا واحدًا على الأقل للطلب.", en: "Add at least one item to the request." },
  price_alert_text_required: { ar: "اكتب اسم المنتج أو وصفه لإضافة التنبيه.", en: "Enter a product name or description for the alert." },
  price_alert_not_found: { ar: "تنبيه السعر غير موجود أو تم إيقافه بالفعل.", en: "The price alert was not found or is already stopped." },
  quote_items_limit_exceeded: { ar: "الحد الأقصى 50 منتجًا في الطلب الواحد.", en: "A direct request is limited to 50 items." },
  target_merchant_unavailable: { ar: "المتجر لا يستقبل طلبات جديدة حاليًا.", en: "The store is not receiving new requests right now." },
  target_branch_unavailable: { ar: "الفرع المحدد غير متاح حاليًا.", en: "The selected branch is not currently available." },
  target_merchant_own_store: { ar: "لا يمكن إرسال طلب مخصوص لمتجرك نفسه.", en: "You cannot send a direct request to your own store." },
  category_has_products: { ar: "لا يمكن إزالة قسم مرتبط بمنتجات فعالة. انقل المنتجات أو أوقفها أولًا.", en: "A category with active products cannot be removed. Move or deactivate those products first." },
  at_least_one_category_required: { ar: "اختر قسمًا واحدًا على الأقل.", en: "Select at least one category." },
  invalid_merchant_category: { ar: "أحد الأقسام المحددة غير صالح أو غير متاح.", en: "One selected category is invalid or unavailable." },
  monetization_not_enabled: { ar: "نظام الاشتراكات غير مفعل حاليًا من الإدارة.", en: "The subscription system is not currently enabled by administration." },
  monthly_subscriptions_disabled: { ar: "اشتراكات المتاجر الشهرية غير مفعلة حاليًا.", en: "Monthly merchant subscriptions are not currently enabled." },
  manual_payment_disabled: { ar: "التحويل اليدوي غير متاح حاليًا.", en: "Manual transfer is not currently available." },
  billing_model_choice_disabled: { ar: "تغيير طريقة المحاسبة غير متاح حاليًا.", en: "Changing billing model is not currently available." },
  billing_preference_required: { ar: "اختر طريقة محاسبة صحيحة.", en: "Choose a valid billing method." },
  manual_payment_method_required: { ar: "اختر طريقة تحويل صحيحة.", en: "Choose a valid transfer method." },
  manual_payment_method_not_available: { ar: "طريقة التحويل المختارة غير متاحة حاليًا.", en: "The selected transfer method is not available right now." },
  subscription_plan_required: { ar: "اختر باقة اشتراك صحيحة.", en: "Choose a valid subscription plan." },
  subscription_plan_not_available: { ar: "الباقة المختارة غير متاحة حاليًا.", en: "The selected plan is not available right now." },
  contact_email_required: { ar: "اكتب بريدًا إلكترونيًا صحيحًا للتواصل.", en: "Enter a valid contact email." },
  payment_proof_required: { ar: "ارفع إثبات التحويل أولًا.", en: "Upload the transfer proof first." },
  payment_proof_not_found: { ar: "لم نجد ملف إثبات التحويل. ارفعه مرة أخرى.", en: "The transfer proof file was not found. Upload it again." },
  payment_proof_not_owned_by_merchant: { ar: "إثبات التحويل غير مرتبط بهذا المتجر.", en: "The transfer proof is not linked to this store." },
  payment_proof_type_not_allowed: { ar: "نوع ملف إثبات التحويل غير مسموح.", en: "The transfer proof file type is not allowed." },
  payment_proof_file_too_large: { ar: "حجم إثبات التحويل أكبر من المسموح.", en: "The transfer proof file is larger than allowed." },
  payment_provider_not_ready: { ar: "بوابة الدفع الإلكتروني لم تكتمل من الإدارة بعد.", en: "The electronic payment gateway is not ready yet." },
};

export function humanError(error: unknown, locale: "ar" | "en") {
  const raw = error instanceof Error ? error.message : text(error, "portal_request_failed");
  const code = raw.split(":")[0].trim();
  if (ERROR_LABELS[code]) return ERROR_LABELS[code][locale];
  if (/duplicate key|unique constraint/i.test(raw)) return locale === "ar" ? "البيانات مستخدمة من قبل. راجع البريد أو رقم الهاتف." : "These details are already in use. Check the email or phone number.";
  if (/permission|denied|row-level security/i.test(raw)) return locale === "ar" ? "ليس لديك صلاحية لتنفيذ الإجراء." : "You do not have permission to perform this action.";
  if (/network|fetch/i.test(raw)) return locale === "ar" ? "تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى." : "Could not reach the service. Check your connection and try again.";
  return locale === "ar" ? "حدثت مشكلة أثناء تنفيذ الطلب. حاول مرة أخرى، وإذا استمرت تواصل مع الدعم." : "Something went wrong while processing the request. Try again or contact support.";
}

export function safeExternalUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  try {
    const url = new URL(normalized);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
}

export function notificationTarget(deepLink: unknown, payloadValue: unknown = {}) {
  const raw = text(deepLink).replace(/^saarly:\/\//, "").replace(/^\/+/, "");
  const payload = row(payloadValue);
  const embeddedUuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  const id = text(
    payload.fulfillment_id || payload.order_id || payload.rfq_request_id || payload.quote_request_id ||
    payload.product_id || payload.branch_id || payload.conversation_id || embeddedUuid,
  );
  if (/rfq|quote/.test(raw)) return `/merchant/requests${id ? `?focus=${encodeURIComponent(id)}` : ""}`;
  if (/order|fulfillment/.test(raw)) return `/merchant/orders${id ? `?focus=${encodeURIComponent(id)}` : ""}`;
  if (/product|catalog|price/.test(raw)) return `/merchant/products${id ? `?focus=${encodeURIComponent(id)}` : ""}`;
  if (/branch/.test(raw)) return `/merchant/branches${id ? `?focus=${encodeURIComponent(id)}` : ""}`;
  if (/billing|subscription|payment|renew/.test(raw)) return "/merchant/subscriptions";
  if (/referral|invite/.test(raw)) return "/merchant/referrals";
  if (/support|chat/.test(raw)) return `/merchant/support${id ? `?focus=${encodeURIComponent(id)}` : ""}`;
  if (/delivery|shipping/.test(raw)) return "/merchant/delivery";
  if (/review|rating/.test(raw)) return "/merchant/reviews";
  return "/merchant";
}

export function buyerNotificationTarget(deepLink: unknown, payloadValue: unknown = {}) {
  const raw = text(deepLink).replace(/^saarly:\/\//, "").replace(/^\/+/, "");
  const payload = row(payloadValue);
  const embeddedUuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  const orderId = text(payload.order_id || embeddedUuid);
  const quoteId = text(payload.quote_request_id || payload.rfq_request_id || embeddedUuid);
  const productId = text(payload.product_id || embeddedUuid);
  const conversationId = text(payload.conversation_id || embeddedUuid);
  if (/support/.test(raw)) return `/buyer/support${conversationId ? `?focus=${encodeURIComponent(conversationId)}` : ""}`;
  if (/chat/.test(raw)) return `/buyer/orders${orderId ? `?focus=${encodeURIComponent(orderId)}` : ""}`;
  if (/offer|quote|rfq|request/.test(raw)) return `/buyer/requests${quoteId ? `?focus=${encodeURIComponent(quoteId)}` : ""}`;
  if (/order|fulfillment|confirmation/.test(raw)) return `/buyer/orders${orderId ? `?focus=${encodeURIComponent(orderId)}` : ""}`;
  if (/price-alert|price_alert|product|price/.test(raw)) return `/buyer/alerts${productId ? `?focus=${encodeURIComponent(productId)}` : ""}`;
  if (/store|merchant|catalog/.test(raw)) return "/buyer/stores";
  if (/favorite/.test(raw)) return "/buyer/favorites";
  if (/referral|invite/.test(raw)) return "/buyer/referrals";
  if (/settings|profile|location/.test(raw)) return "/buyer/settings";
  return "/buyer";
}
