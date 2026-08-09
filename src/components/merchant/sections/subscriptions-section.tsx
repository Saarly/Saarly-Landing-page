"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, dateLabel, localizedSystemText, money, numberValue, paymentProviderLabel, row, rows, statusLabel, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type ManualForm = {
  contactEmail: string;
  transferReference: string;
  proofPath: string;
  proofName: string;
  idempotencyKey: string;
};

function listText(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function featureList(plan: PortalRow, locale: "ar" | "en") {
  const direct = listText(locale === "ar" ? plan.features_ar : plan.features_en);
  if (direct.length) return direct;
  const features = row(plan.features);
  return listText(locale === "ar" ? features.ar : features.en);
}

function fileSize(bytes: unknown, locale: "ar" | "en") {
  const size = numberValue(bytes);
  if (!size) return locale === "ar" ? "غير محدد" : "Not set";
  return `${Math.ceil(size / 1024 / 1024)} ${locale === "ar" ? "ميجابايت" : "megabytes"}`;
}

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `merchant-web-${Date.now()}`;
}

export function SubscriptionsSection({ payload, locale, refresh, notify }: SectionProps) {
  const status = row(payload.data.status);
  const capabilities = row(payload.data.capabilities);
  const plans = rows(payload.data.plans);
  const manualMethods = rows(payload.data.manualMethods);
  const manualRequests = rows(payload.data.manualRequests);
  const transactions = rows(payload.data.transactions);
  const subscriptions = rows(payload.data.subscriptions);
  const paymentSettings = rows(payload.data.paymentSettings);
  const currency = text(status.currency || payload.account.currencyCode, "EGP");
  const [selectedPlanId, setSelectedPlanId] = useState(() => text(status.plan_id || plans[0]?.id));
  const [selectedMethodId, setSelectedMethodId] = useState(() => text(manualMethods[0]?.id));
  const [manual, setManual] = useState<ManualForm>(() => ({
    contactEmail: text(payload.account.email || payload.account.profile.primary_email),
    transferReference: "",
    proofPath: "",
    proofName: "",
    idempotencyKey: newIdempotencyKey(),
  }));
  const [busy, setBusy] = useState("");
  const [uploading, setUploading] = useState(0);

  const selectedPlan = useMemo(() => plans.find((plan) => text(plan.id) === selectedPlanId) ?? plans[0] ?? null, [plans, selectedPlanId]);
  const selectedMethod = useMemo(() => manualMethods.find((method) => text(method.id) === selectedMethodId) ?? manualMethods[0] ?? null, [manualMethods, selectedMethodId]);
  const activeSubscription = subscriptions.find((subscription) => ["active", "trialing", "past_due"].includes(text(subscription.status))) ?? subscriptions[0] ?? null;
  const monetizationEnabled = bool(capabilities.monetizationEnabled);
  const monthlyEnabled = bool(capabilities.monthlySubscriptionEnabled);
  const manualEnabled = bool(capabilities.manualPaymentEnabled);
  const canChooseBillingModel = bool(capabilities.canChooseBillingModel);
  const electronicFeatureEnabled = bool(capabilities.electronicPaymentFeatureEnabled);
  const electronicGatewayReady = bool(capabilities.electronicGatewayReady, bool(capabilities.electronicPaymentEnabled));
  const electronicCheckoutAvailable = bool(capabilities.electronicCheckoutAvailable);
  const manualAvailable = monetizationEnabled && monthlyEnabled && manualEnabled;
  const currentPlanName = text(locale === "ar" ? status.plan_name_ar || activeSubscription?.plan_name_ar : status.plan_name_en || activeSubscription?.plan_name_en, locale === "ar" ? "غير محددة" : "Not set");
  const billingModel = text(status.billing_model || activeSubscription?.billing_model, "monthly_subscription");
  const balanceDue = numberValue(status.balance_due || activeSubscription?.balance_due);
  const selectedOriginalPrice = numberValue(selectedPlan?.monthly_price);
  const selectedEffectivePrice = numberValue(selectedPlan?.effective_price, selectedOriginalPrice);
  const selectedDiscountAmount = numberValue(selectedPlan?.discount_amount);
  const selectedDiscountPercent = numberValue(selectedPlan?.discount_percent);
  const selectedDiscountName = text(locale === "ar" ? selectedPlan?.discount_name_ar : selectedPlan?.discount_name_en);
  const selectedAllowedMimeTypes = listText(selectedMethod?.allowed_mime_types);
  const selectedMaxFileSize = numberValue(selectedMethod?.max_file_size_bytes, 5 * 1024 * 1024);
  const proofAccept = (selectedAllowedMimeTypes.length ? selectedAllowedMimeTypes : ["image/jpeg", "image/png", "application/pdf"]).join(",");

  async function chooseBilling(preference: "monthly_subscription" | "commission") {
    setBusy(`billing:${preference}`);
    try {
      await portalPost("set_billing_preference", { preference });
      notify(locale === "ar" ? "تم حفظ طريقة المحاسبة." : "Billing method saved.", "success");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "billing_preference_failed", "error");
    } finally {
      setBusy("");
    }
  }

  async function uploadProof(file: File) {
    if (!selectedMethod) return;
    if (selectedAllowedMimeTypes.length && !selectedAllowedMimeTypes.includes(file.type)) {
      notify(locale === "ar" ? "نوع الملف غير مسموح لوسيلة التحويل المختارة." : "This file type is not allowed for the selected transfer method.", "error");
      return;
    }
    if (selectedMaxFileSize > 0 && file.size > selectedMaxFileSize) {
      notify(locale === "ar" ? `حجم الملف أكبر من الحد المسموح (${fileSize(selectedMaxFileSize, locale)}).` : `The file exceeds the allowed limit (${fileSize(selectedMaxFileSize, locale)}).`, "error");
      return;
    }
    setUploading(1);
    try {
      const result = await portalUpload("subscription-payment-proof", file, setUploading, { manualPaymentMethodId: text(selectedMethod.id) });
      setManual((current) => ({ ...current, proofPath: result.path, proofName: file.name, idempotencyKey: newIdempotencyKey() }));
      notify(locale === "ar" ? "تم رفع إثبات التحويل." : "Transfer proof uploaded.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "upload_failed", "error");
    } finally {
      setUploading(0);
    }
  }

  async function submitManualPayment(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlan || !selectedMethod) return;
    setBusy("manual-payment");
    try {
      await portalPost("create_manual_subscription_payment_request", {
        planId: text(selectedPlan.id),
        manualPaymentMethodId: text(selectedMethod.id),
        contactEmail: manual.contactEmail,
        proofStoragePath: manual.proofPath,
        transferReference: manual.transferReference,
        idempotencyKey: manual.idempotencyKey,
      });
      notify(locale === "ar" ? "تم إرسال طلب التحويل للمراجعة." : "Manual transfer request sent for review.", "success");
      setManual((current) => ({ ...current, transferReference: "", proofPath: "", proofName: "", idempotencyKey: newIdempotencyKey() }));
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "manual_payment_request_failed", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="portal-section-stack">
      <Notice tone={monetizationEnabled ? "success" : "warning"} title={locale === "ar" ? "اشتراك سعرلي من خلال الموقع فقط" : "Saarly subscription is available on the website only"}>
        {monetizationEnabled
          ? (locale === "ar" ? "هذه الصفحة مخصصة لاشتراك المتجر في سعرلي فقط. مشتريات العملاء من المتاجر تظل مسارًا منفصلًا داخل الطلبات." : "This page is only for the merchant subscription paid to Saarly. Buyer purchases from stores remain a separate orders flow.")
          : (locale === "ar" ? "الاشتراكات والمدفوعات غير مفعلة حاليًا، لذلك يمكنك متابعة حالة الحساب إلى أن تصبح متاحة." : "Subscriptions and payments are not active yet, so you can review the account status until they become available.")}
      </Notice>

      <div className="metrics-grid billing-metrics">
        <MetricCard icon="shield" label={locale === "ar" ? "حالة الحساب" : "Account status"} value={statusLabel(status.access_status || status.subscription_status, locale)} note={currentPlanName}/>
        <MetricCard icon="money" label={locale === "ar" ? "طريقة المحاسبة" : "Billing method"} value={statusLabel(billingModel, locale)} tone="blue"/>
        <MetricCard icon="receipt" label={locale === "ar" ? "المستحق الحالي" : "Current due"} value={money(balanceDue, currency, locale)} tone={balanceDue > 0 ? "gold" : "green"}/>
        <MetricCard icon="clock" label={locale === "ar" ? "نهاية الفترة" : "Period ends"} value={dateLabel(status.access_ends_at || status.free_trial_ends_at || status.current_period_end || activeSubscription?.ends_at, locale)} tone="gray"/>
      </div>

      <PortalPanel title={locale === "ar" ? "اختيار طريقة المحاسبة" : "Billing model"} subtitle={locale === "ar" ? "إذا كان تغيير طريقة المحاسبة متاحًا ستقدر تختار هنا، وإلا ستظهر الطريقة الحالية فقط." : "If changing the billing method is available, you can choose here; otherwise only the current method is shown."}>
        <div className="billing-choice">
          <button type="button" className={billingModel === "monthly_subscription" ? "selected" : ""} disabled={!canChooseBillingModel || busy === "billing:monthly_subscription"} onClick={() => void chooseBilling("monthly_subscription")}>
            <Icon name="receipt"/><strong>{locale === "ar" ? "اشتراك شهري" : "Monthly subscription"}</strong><small>{locale === "ar" ? "اختر خطة واطلب مراجعة التحويل من خلال الموقع." : "Choose a plan and request transfer review through the website."}</small>
          </button>
          <button type="button" className={billingModel === "commission" ? "selected" : ""} disabled={!canChooseBillingModel || busy === "billing:commission"} onClick={() => void chooseBilling("commission")}>
            <Icon name="money"/><strong>{locale === "ar" ? "نظام العمولة" : "Commission model"}</strong><small>{locale === "ar" ? "تُحسب المستحقات حسب إعدادات العمولة الحالية." : "Dues are calculated according to the current commission settings."}</small>
          </button>
        </div>
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "خطط الاشتراك" : "Subscription plans"} subtitle={locale === "ar" ? "الخطط والأسعار تظهر حسب الإعدادات الحالية." : "Plans and prices follow the current settings."}>
        {plans.length ? <div className="plan-grid">{plans.map((plan) => {
          const id = text(plan.id);
          const features = featureList(plan, locale);
          const effectivePrice = numberValue(plan.effective_price, numberValue(plan.monthly_price));
          const hasDiscount = Boolean(text(plan.discount_id)) && effectivePrice < numberValue(plan.monthly_price);
          const discountName = text(locale === "ar" ? plan.discount_name_ar : plan.discount_name_en);
          return <article className={`plan-card ${id === text(selectedPlan?.id) ? "selected" : ""}`} key={id}>
            <span className="eyebrow"><Icon name="receipt" size={17}/>{locale === "ar" ? "باقة سعرلي" : "Saarly plan"}</span>
            <h3>{text(locale === "ar" ? plan.name_ar : plan.name_en)}</h3>
            <p>{text(locale === "ar" ? plan.description_ar : plan.description_en)}</p>
            {hasDiscount ? <span className="plan-discount-chip"><Icon name="star" size={15}/>{discountName || (locale === "ar" ? "خصم مفعّل" : "Active discount")}{numberValue(plan.discount_percent) > 0 ? ` · ${numberValue(plan.discount_percent)}%` : ""}</span> : null}
            <span className="plan-price">
              <strong>{money(effectivePrice, plan.currency || currency, locale)}</strong>
              {hasDiscount ? <del>{money(plan.monthly_price, plan.currency || currency, locale)}</del> : numberValue(plan.old_price) > numberValue(plan.monthly_price) ? <del>{money(plan.old_price, plan.currency || currency, locale)}</del> : null}
              <small>{locale === "ar" ? `${numberValue(plan.duration_days, 30)} يوم` : `${numberValue(plan.duration_days, 30)} days`}</small>
            </span>
            {hasDiscount && text(locale === "ar" ? plan.discount_description_ar : plan.discount_description_en) ? <p className="plan-discount-note">{text(locale === "ar" ? plan.discount_description_ar : plan.discount_description_en)}</p> : null}
            {features.length ? <ul>{features.slice(0, 8).map((feature) => <li key={feature}><Icon name="check" size={16}/>{feature}</li>)}</ul> : null}
            <button className="button secondary full" type="button" disabled={!monthlyEnabled} onClick={() => setSelectedPlanId(id)}>{id === text(selectedPlan?.id) ? (locale === "ar" ? "الخطة المختارة" : "Selected plan") : (locale === "ar" ? "اختيار الخطة" : "Select plan")}</button>
          </article>;
        })}</div> : <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد خطط مفعلة" : "No active plans"} body={locale === "ar" ? "عند تفعيل خطط جديدة ستظهر هنا تلقائيًا." : "Newly enabled plans will appear here automatically."}/>}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "طلب مراجعة تحويل يدوي" : "Manual transfer review"} subtitle={locale === "ar" ? "ارفع إثبات تحويل واضح، ثم تتم مراجعته قبل تفعيل أو تمديد الاشتراك." : "Upload a clear transfer proof. It will be reviewed before the subscription is activated or extended."}>
        {!manualAvailable ? <Notice tone="warning">{locale === "ar" ? "التحويل اليدوي أو الاشتراكات غير متاحة حاليًا." : "Manual transfers or subscriptions are not available right now."}</Notice> : null}
        {manualMethods.length ? <div className="gateway-grid">{manualMethods.map((method) => {
          const id = text(method.id);
          return <article key={id} className={id === text(selectedMethod?.id) ? "selected" : ""}>
            <Icon name="card"/><div><strong>{text(locale === "ar" ? method.name_ar : method.name_en, locale === "ar" ? "وسيلة تحويل" : "Transfer method")}</strong><small>{locale === "ar" ? "رقم التحويل" : "Transfer number"}: {text(method.account_number)}</small></div>
            <button className="button secondary compact" type="button" disabled={!manualAvailable} onClick={() => setSelectedMethodId(id)}>{id === text(selectedMethod?.id) ? (locale === "ar" ? "مختارة" : "Selected") : (locale === "ar" ? "اختيار" : "Choose")}</button>
          </article>;
        })}</div> : <EmptyState icon="card" title={locale === "ar" ? "لا توجد وسائل تحويل مفعلة" : "No active transfer methods"} body={locale === "ar" ? "ستظهر وسائل التحويل المتاحة هنا عند تفعيلها." : "Available transfer methods will appear here when enabled."}/>}
        {selectedMethod ? <form className="portal-form manual-payment-form" onSubmit={submitManualPayment}>
          {selectedPlan ? <div className="subscription-checkout-summary">
            <div>
              <span>{locale === "ar" ? "الباقة المختارة" : "Selected plan"}</span>
              <strong>{text(locale === "ar" ? selectedPlan.name_ar : selectedPlan.name_en)}</strong>
              <small>{locale === "ar" ? `${numberValue(selectedPlan.duration_days, 30)} يوم` : `${numberValue(selectedPlan.duration_days, 30)} days`}</small>
            </div>
            <div className="subscription-checkout-price">
              {selectedDiscountAmount > 0 ? <small>{selectedDiscountName || (locale === "ar" ? "خصم مفعّل" : "Active discount")}{selectedDiscountPercent > 0 ? ` · ${selectedDiscountPercent}%` : ""}</small> : null}
              <strong>{money(selectedEffectivePrice, selectedPlan.currency || currency, locale)}</strong>
              {selectedDiscountAmount > 0 ? <del>{money(selectedOriginalPrice, selectedPlan.currency || currency, locale)}</del> : null}
            </div>
          </div> : null}
          {selectedDiscountAmount > 0 ? <Notice tone="success">{locale === "ar" ? "تم احتساب الخصم المتاح في السعر المبدئي، وتظهر القيمة النهائية عند إرسال طلب التحويل." : "The available discount is included in this preview, and the final price appears when the transfer request is submitted."}</Notice> : null}
          <div className="payment-method-details">
            <strong>{locale === "ar" ? "بيانات التحويل" : "Transfer details"}</strong>
            <span>{locale === "ar" ? "رقم التحويل" : "Transfer number"}: {text(selectedMethod.account_number)}</span>
            {text(selectedMethod.account_holder_name) ? <span>{locale === "ar" ? "اسم صاحب الحساب" : "Account holder"}: {text(selectedMethod.account_holder_name)}</span> : null}
            {text(locale === "ar" ? selectedMethod.instructions_ar : selectedMethod.instructions_en) ? <small>{text(locale === "ar" ? selectedMethod.instructions_ar : selectedMethod.instructions_en)}</small> : null}
            <small>{locale === "ar" ? "الحد الأقصى للملف" : "File limit"}: {fileSize(selectedMethod.max_file_size_bytes, locale)}</small>
            <small>{locale === "ar" ? "نوع الملف المسموح" : "Allowed file type"}: {selectedAllowedMimeTypes.some((item) => item === "application/pdf") ? (locale === "ar" ? "صورة أو مستند" : "Image or document") : (locale === "ar" ? "صورة" : "Image")}</small>
          </div>
          <div className="form-grid two">
            <label>{locale === "ar" ? "بريد التواصل" : "Contact email"}<input required type="email" value={manual.contactEmail} onChange={(event) => setManual({ ...manual, contactEmail: event.target.value })}/></label>
            <label>{locale === "ar" ? "رقم أو مرجع التحويل" : "Transfer reference"}<input value={manual.transferReference} onChange={(event) => setManual({ ...manual, transferReference: event.target.value })}/></label>
          </div>
          <label className="file-button button secondary compact">
            <Icon name="upload" size={17}/>
            {uploading ? `${uploading}%` : manual.proofName || (locale === "ar" ? "رفع إثبات التحويل" : "Upload transfer proof")}
            <input type="file" accept={proofAccept} disabled={!manualAvailable || uploading > 0} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProof(file); event.currentTarget.value = ""; }}/>
          </label>
          <div className="form-actions"><button className="button primary" type="submit" disabled={!manualAvailable || !selectedPlan || !selectedMethod || !manual.proofPath || !manual.contactEmail || busy === "manual-payment"}>{busy === "manual-payment" ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال للمراجعة" : "Send for review")}</button></div>
        </form> : null}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "الدفع الإلكتروني" : "Electronic payment"} subtitle={locale === "ar" ? "سيظهر الدفع الإلكتروني بعد تفعيل خدمة الدفع في سعرلي." : "Electronic payment will appear after the payment service is activated in Saarly."}>
        <div className="gateway-grid">{paymentSettings.length ? paymentSettings.map((provider) => {
          const ready = bool(provider.ready);
          return <article key={text(provider.provider)} className={ready ? "ready" : ""}>
            <Icon name="card"/><div><strong>{text(locale === "ar" ? provider.display_name_ar : provider.display_name_en, paymentProviderLabel(provider.provider, locale))}</strong><small>{locale === "ar" ? "خدمة دفع إلكتروني" : "Electronic payment service"}</small></div><StatusBadge value={ready ? "connected" : provider.config_status} locale={locale}/>
          </article>;
        }) : <article><Icon name="info"/><div><strong>{locale === "ar" ? "لا توجد خدمات دفع متاحة" : "No payment services available"}</strong><small>{locale === "ar" ? "تظهر هنا عند تفعيلها." : "Shown here when enabled."}</small></div></article>}</div>
        {!electronicFeatureEnabled ? <Notice tone="info">{locale === "ar" ? "الدفع الإلكتروني غير متاح حاليًا." : "Electronic payment is not available right now."}</Notice> : null}
        {electronicFeatureEnabled && !electronicGatewayReady ? <Notice tone="info">{locale === "ar" ? "الدفع الإلكتروني غير موصول حاليًا، لذلك لا توجد صفحة دفع إلكترونية مفعلة." : "Electronic payment is not connected right now, so no active payment page is shown."}</Notice> : null}
        {electronicGatewayReady && !electronicCheckoutAvailable ? <Notice tone="warning">{locale === "ar" ? "خدمة الدفع متصلة، وسيظهر زر الدفع بعد اكتمال تفعيلها." : "A payment service is connected, and the payment button will appear after it is fully enabled."}</Notice> : null}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "طلبات التحويل السابقة" : "Previous transfer requests"}>
        {manualRequests.length ? <div className="compact-table-wrap"><table><thead><tr><th>{locale === "ar" ? "الباقة" : "Plan"}</th><th>{locale === "ar" ? "المبلغ" : "Amount"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "الإثبات" : "Proof"}</th></tr></thead><tbody>{manualRequests.map((request) => <tr key={text(request.id)}><td>{text(locale === "ar" ? request.plan_name_ar || row(request.plan_snapshot).name_ar : request.plan_name_en || row(request.plan_snapshot).name_en, locale === "ar" ? "باقة سعرلي" : "Saarly plan")}</td><td>{money(request.final_amount, request.currency || currency, locale)}</td><td><StatusBadge value={request.status} locale={locale}/>{text(request.rejection_reason) ? <small>{localizedSystemText(request.rejection_reason, locale, locale === "ar" ? "راجع سبب الرفض مع الدعم." : "Contact support for rejection details.")}</small> : null}</td><td>{dateLabel(request.created_at, locale)}</td><td>{text(request.proof_signed_url) ? <a className="button secondary compact" href={text(request.proof_signed_url)} target="_blank" rel="noreferrer">{locale === "ar" ? "عرض" : "Open"}</a> : <span>{locale === "ar" ? "غير متاح" : "Unavailable"}</span>}</td></tr>)}</tbody></table></div> : <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد طلبات تحويل" : "No transfer requests"} body={locale === "ar" ? "بعد إرسال إثبات التحويل سيظهر الطلب هنا بحالته." : "After sending a transfer proof, the request appears here with its status."}/>}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "سجل الاشتراكات والمعاملات" : "Subscriptions and transactions history"}>
        <div className="detail-list">
          {subscriptions.slice(0, 5).map((subscription) => <div key={text(subscription.id)}><span>{text(locale === "ar" ? subscription.plan_name_ar : subscription.plan_name_en, currentPlanName)}</span><strong><StatusBadge value={subscription.status} locale={locale}/></strong><small>{dateLabel(subscription.starts_at, locale)} - {dateLabel(subscription.ends_at, locale)}</small></div>)}
          {transactions.slice(0, 8).map((transaction) => <div key={text(transaction.id)}><span>{statusLabel(transaction.purpose, locale)} - {paymentProviderLabel(transaction.provider, locale)}</span><strong>{money(transaction.amount, transaction.currency || currency, locale)}</strong><small>{statusLabel(transaction.status, locale)} - {dateLabel(transaction.created_at, locale)}</small></div>)}
          {!subscriptions.length && !transactions.length ? <div><span>{locale === "ar" ? "لا يوجد سجل بعد" : "No history yet"}</span><strong>{locale === "ar" ? "سيظهر هنا بعد أول اشتراك أو معاملة" : "It will appear after the first subscription or transaction"}</strong></div> : null}
        </div>
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "الفواتير" : "Invoices"}>
        <EmptyState icon="receipt" title={locale === "ar" ? "الفواتير غير متاحة حاليًا" : "Invoices are not available yet"} body={locale === "ar" ? "ميزة الفواتير غير مفعلة حاليًا. ستظهر الفواتير هنا عند تفعيلها." : "Invoices are not enabled yet. They will appear here when the feature becomes available."}/>
      </PortalPanel>
    </div>
  );
}
