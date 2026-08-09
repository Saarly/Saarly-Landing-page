"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, dateLabel, money, numberValue, row, rows, statusLabel, text, type PortalRow } from "@/components/merchant/portal-utils";
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
  return `${Math.ceil(size / 1024 / 1024)} ${locale === "ar" ? "ميجابايت" : "MB"}`;
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
    setUploading(1);
    try {
      const result = await portalUpload("subscription-payment-proof", file, setUploading);
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
      <Notice tone={monetizationEnabled ? "success" : "warning"} title={locale === "ar" ? "اشتراك سعرلي على الويب فقط" : "Saarly subscription is web-only"}>
        {monetizationEnabled
          ? (locale === "ar" ? "هذه الصفحة مخصصة لاشتراك المتجر في سعرلي فقط. مشتريات العملاء من المتاجر تظل مسارًا منفصلًا داخل الطلبات." : "This page is only for the merchant subscription paid to Saarly. Buyer purchases from stores remain a separate orders flow.")
          : (locale === "ar" ? "النظام المالي غير مفعل حاليًا من لوحة الإدارة، لذلك يمكنك متابعة الحالة فقط إلى أن يتم تشغيله." : "The financial system is not enabled from Admin yet, so you can review the status until it is turned on.")}
      </Notice>

      <div className="metrics-grid billing-metrics">
        <MetricCard icon="shield" label={locale === "ar" ? "حالة الحساب" : "Account status"} value={statusLabel(status.access_status || status.subscription_status, locale)} note={currentPlanName}/>
        <MetricCard icon="money" label={locale === "ar" ? "طريقة المحاسبة" : "Billing method"} value={statusLabel(billingModel, locale)} tone="blue"/>
        <MetricCard icon="receipt" label={locale === "ar" ? "المستحق الحالي" : "Current due"} value={money(balanceDue, currency, locale)} tone={balanceDue > 0 ? "gold" : "green"}/>
        <MetricCard icon="clock" label={locale === "ar" ? "نهاية الفترة" : "Period ends"} value={dateLabel(status.access_ends_at || status.free_trial_ends_at || status.current_period_end || activeSubscription?.ends_at, locale)} tone="gray"/>
      </div>

      <PortalPanel title={locale === "ar" ? "اختيار طريقة المحاسبة" : "Billing model"} subtitle={locale === "ar" ? "يتحكم الأدمن في السماح بالاختيار. عند إيقافه تظهر الطريقة الحالية فقط." : "Admin controls whether stores may choose. If disabled, only the current model is shown."}>
        <div className="billing-choice">
          <button type="button" className={billingModel === "monthly_subscription" ? "selected" : ""} disabled={!canChooseBillingModel || busy === "billing:monthly_subscription"} onClick={() => void chooseBilling("monthly_subscription")}>
            <Icon name="receipt"/><strong>{locale === "ar" ? "اشتراك شهري" : "Monthly subscription"}</strong><small>{locale === "ar" ? "اختر خطة واطلب مراجعة التحويل من الويب." : "Choose a plan and request transfer review from the web."}</small>
          </button>
          <button type="button" className={billingModel === "commission" ? "selected" : ""} disabled={!canChooseBillingModel || busy === "billing:commission"} onClick={() => void chooseBilling("commission")}>
            <Icon name="money"/><strong>{locale === "ar" ? "نظام العمولة" : "Commission model"}</strong><small>{locale === "ar" ? "تُحسب المستحقات حسب إعدادات العمولة في الإدارة." : "Dues are calculated by the commission settings in Admin."}</small>
          </button>
        </div>
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "خطط الاشتراك" : "Subscription plans"} subtitle={locale === "ar" ? "الخطط والأسعار تُقرأ من نفس إعدادات لوحة الإدارة." : "Plans and prices are read from the same Admin settings."}>
        {plans.length ? <div className="plan-grid">{plans.map((plan) => {
          const id = text(plan.id);
          const features = featureList(plan, locale);
          return <article className={`plan-card ${id === text(selectedPlan?.id) ? "selected" : ""}`} key={id}>
            <span className="eyebrow"><Icon name="receipt" size={17}/>{text(plan.plan_code, locale === "ar" ? "باقة سعرلي" : "Saarly plan")}</span>
            <h3>{text(locale === "ar" ? plan.name_ar : plan.name_en)}</h3>
            <p>{text(locale === "ar" ? plan.description_ar : plan.description_en)}</p>
            <span className="plan-price"><strong>{money(plan.monthly_price, plan.currency || currency, locale)}</strong>{numberValue(plan.old_price) > 0 ? <del>{money(plan.old_price, plan.currency || currency, locale)}</del> : null}<small>{locale === "ar" ? `${numberValue(plan.duration_days, 30)} يوم` : `${numberValue(plan.duration_days, 30)} days`}</small></span>
            {features.length ? <ul>{features.slice(0, 6).map((feature) => <li key={feature}><Icon name="check" size={16}/>{feature}</li>)}</ul> : null}
            <button className="button secondary full" type="button" disabled={!monthlyEnabled} onClick={() => setSelectedPlanId(id)}>{id === text(selectedPlan?.id) ? (locale === "ar" ? "الخطة المختارة" : "Selected plan") : (locale === "ar" ? "اختيار الخطة" : "Select plan")}</button>
          </article>;
        })}</div> : <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد خطط مفعلة" : "No active plans"} body={locale === "ar" ? "عند تفعيل الخطط من لوحة الإدارة ستظهر هنا تلقائيًا." : "Plans enabled from Admin will appear here automatically."}/>}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "طلب مراجعة تحويل يدوي" : "Manual transfer review"} subtitle={locale === "ar" ? "ارفع إثبات تحويل واضح، ثم تراجعه الإدارة قبل تفعيل أو تمديد الاشتراك." : "Upload a clear transfer proof. Admin reviews it before activating or extending the subscription."}>
        {!manualAvailable ? <Notice tone="warning">{locale === "ar" ? "التحويل اليدوي أو الاشتراكات غير مفعلة حاليًا من لوحة الإدارة." : "Manual transfers or subscriptions are not currently enabled from Admin."}</Notice> : null}
        {manualMethods.length ? <div className="gateway-grid">{manualMethods.map((method) => {
          const id = text(method.id);
          return <article key={id} className={id === text(selectedMethod?.id) ? "selected" : ""}>
            <Icon name="card"/><div><strong>{text(locale === "ar" ? method.name_ar : method.name_en)}</strong><small>{text(method.account_label)} - {text(method.account_number)}</small></div>
            <button className="button secondary compact" type="button" disabled={!manualAvailable} onClick={() => setSelectedMethodId(id)}>{id === text(selectedMethod?.id) ? (locale === "ar" ? "مختارة" : "Selected") : (locale === "ar" ? "اختيار" : "Choose")}</button>
          </article>;
        })}</div> : <EmptyState icon="card" title={locale === "ar" ? "لا توجد وسائل تحويل مفعلة" : "No active transfer methods"} body={locale === "ar" ? "وسائل التحويل تُدار من لوحة الإدارة." : "Transfer methods are managed from Admin."}/>}
        {selectedMethod ? <form className="portal-form manual-payment-form" onSubmit={submitManualPayment}>
          <div className="payment-method-details">
            <strong>{locale === "ar" ? "بيانات التحويل" : "Transfer details"}</strong>
            <span>{text(selectedMethod.account_label)}: {text(selectedMethod.account_number)}</span>
            {text(selectedMethod.account_holder_name) ? <span>{locale === "ar" ? "اسم صاحب الحساب" : "Account holder"}: {text(selectedMethod.account_holder_name)}</span> : null}
            {text(locale === "ar" ? selectedMethod.instructions_ar : selectedMethod.instructions_en) ? <small>{text(locale === "ar" ? selectedMethod.instructions_ar : selectedMethod.instructions_en)}</small> : null}
            <small>{locale === "ar" ? "الحد الأقصى للملف" : "File limit"}: {fileSize(selectedMethod.max_file_size_bytes, locale)}</small>
          </div>
          <div className="form-grid two">
            <label>{locale === "ar" ? "بريد التواصل" : "Contact email"}<input required type="email" value={manual.contactEmail} onChange={(event) => setManual({ ...manual, contactEmail: event.target.value })}/></label>
            <label>{locale === "ar" ? "رقم أو مرجع التحويل" : "Transfer reference"}<input value={manual.transferReference} onChange={(event) => setManual({ ...manual, transferReference: event.target.value })}/></label>
          </div>
          <label className="file-button button secondary compact">
            <Icon name="upload" size={17}/>
            {uploading ? `${uploading}%` : manual.proofName || (locale === "ar" ? "رفع إثبات التحويل" : "Upload transfer proof")}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!manualAvailable || uploading > 0} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProof(file); event.currentTarget.value = ""; }}/>
          </label>
          <div className="form-actions"><button className="button primary" type="submit" disabled={!manualAvailable || !selectedPlan || !selectedMethod || !manual.proofPath || !manual.contactEmail || busy === "manual-payment"}>{busy === "manual-payment" ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال للمراجعة" : "Send for review")}</button></div>
        </form> : null}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "الدفع الإلكتروني" : "Electronic payment"} subtitle={locale === "ar" ? "لن يظهر دفع إلكتروني حقيقي إلا بعد ربط بوابة اختبار/إنتاج موثقة من الإدارة." : "Real electronic payment only appears after Admin connects a verified test/production gateway."}>
        <div className="gateway-grid">{paymentSettings.length ? paymentSettings.map((provider) => {
          const ready = bool(provider.ready);
          return <article key={text(provider.provider)} className={ready ? "ready" : ""}>
            <Icon name="card"/><div><strong>{text(locale === "ar" ? provider.display_name_ar : provider.display_name_en, text(provider.provider))}</strong><small>{text(provider.gateway_environment, "test")}</small></div><StatusBadge value={ready ? "connected" : provider.config_status} locale={locale}/>
          </article>;
        }) : <article><Icon name="info"/><div><strong>{locale === "ar" ? "لا توجد بوابات مسجلة" : "No gateways registered"}</strong><small>{locale === "ar" ? "تدار من لوحة الإدارة." : "Managed from Admin."}</small></div></article>}</div>
        {!electronicFeatureEnabled ? <Notice tone="info">{locale === "ar" ? "الدفع الإلكتروني غير مفعل حاليًا من لوحة الإدارة." : "Electronic payment is not enabled from Admin right now."}</Notice> : null}
        {electronicFeatureEnabled && !electronicGatewayReady ? <Notice tone="info">{locale === "ar" ? "الدفع الإلكتروني غير موصول حاليًا، لذلك لا يوجد Checkout إلكتروني نشط." : "Electronic payment is not connected right now, so no active electronic checkout is shown."}</Notice> : null}
        {electronicGatewayReady && !electronicCheckoutAvailable ? <Notice tone="warning">{locale === "ar" ? "بوابة الدفع ظاهرة كمتصلة من لوحة الإدارة، وسيظهر زر الدفع بعد تفعيل الربط النهائي للبوابة." : "A payment gateway is connected from Admin, and the payment button will appear after the final gateway connection is enabled."}</Notice> : null}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "طلبات التحويل السابقة" : "Previous transfer requests"}>
        {manualRequests.length ? <div className="compact-table-wrap"><table><thead><tr><th>{locale === "ar" ? "الباقة" : "Plan"}</th><th>{locale === "ar" ? "المبلغ" : "Amount"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "الإثبات" : "Proof"}</th></tr></thead><tbody>{manualRequests.map((request) => <tr key={text(request.id)}><td>{text(locale === "ar" ? request.plan_name_ar : request.plan_name_en, text(row(request.plan_snapshot).name_ar || row(request.plan_snapshot).name_en))}</td><td>{money(request.final_amount, request.currency || currency, locale)}</td><td><StatusBadge value={request.status} locale={locale}/>{text(request.rejection_reason) ? <small>{text(request.rejection_reason)}</small> : null}</td><td>{dateLabel(request.created_at, locale)}</td><td>{text(request.proof_signed_url) ? <a className="button secondary compact" href={text(request.proof_signed_url)} target="_blank" rel="noreferrer">{locale === "ar" ? "عرض" : "Open"}</a> : <span>{locale === "ar" ? "غير متاح" : "Unavailable"}</span>}</td></tr>)}</tbody></table></div> : <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد طلبات تحويل" : "No transfer requests"} body={locale === "ar" ? "بعد إرسال إثبات التحويل سيظهر الطلب هنا بحالته." : "After sending a transfer proof, the request appears here with its status."}/>}
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "سجل الاشتراكات والمعاملات" : "Subscriptions and transactions history"}>
        <div className="detail-list">
          {subscriptions.slice(0, 5).map((subscription) => <div key={text(subscription.id)}><span>{text(locale === "ar" ? subscription.plan_name_ar : subscription.plan_name_en, currentPlanName)}</span><strong><StatusBadge value={subscription.status} locale={locale}/></strong><small>{dateLabel(subscription.starts_at, locale)} - {dateLabel(subscription.ends_at, locale)}</small></div>)}
          {transactions.slice(0, 8).map((transaction) => <div key={text(transaction.id)}><span>{statusLabel(transaction.purpose, locale)} - {text(transaction.provider)}</span><strong>{money(transaction.amount, transaction.currency || currency, locale)}</strong><small>{statusLabel(transaction.status, locale)} - {dateLabel(transaction.created_at, locale)}</small></div>)}
          {!subscriptions.length && !transactions.length ? <div><span>{locale === "ar" ? "لا يوجد سجل بعد" : "No history yet"}</span><strong>{locale === "ar" ? "سيظهر هنا بعد أول اشتراك أو معاملة" : "It will appear after the first subscription or transaction"}</strong></div> : null}
        </div>
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "الفواتير" : "Invoices"}>
        <EmptyState icon="receipt" title={locale === "ar" ? "الفواتير غير متاحة حاليًا" : "Invoices are not available yet"} body={locale === "ar" ? "لم نجد جدول فواتير فعلي في قاعدة البيانات الحالية، لذلك لا يتم إنشاء أو عرض فواتير وهمية." : "No real invoices table exists in the current database, so no fake invoices are created or shown."}/>
      </PortalPanel>
    </div>
  );
}
