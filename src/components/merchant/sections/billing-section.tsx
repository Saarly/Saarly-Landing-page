"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, row, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function BillingSection({ payload, locale, refresh, notify }: SectionProps) {
  const data = payload.data;
  const status = row(data.status);
  const flags = row(data.flags);
  const plans = rows(data.plans);
  const methods = rows(data.manualMethods);
  const subscriptions = rows(data.subscriptions);
  const requests = rows(data.paymentRequests);
  const gateways = rows(data.gateways);
  const currentPreference = text(payload.account.merchant.billing_preference, "monthly_subscription");
  const [preference, setPreference] = useState(currentPreference);
  const [savingPreference, setSavingPreference] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [contactEmail, setContactEmail] = useState(payload.account.email);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isOwner = payload.account.isOwner;

  const activeSubscription = subscriptions.find((item) => ["active", "trialing", "past_due"].includes(text(item.status))) ?? subscriptions[0];
  const chosenPlan = plans.find((plan) => text(plan.id) === selectedPlan);
  const chosenMethod = methods.find((method) => text(method.id) === selectedMethod);
  const automaticAvailable = flags.automaticPaymentEnabled === true && gateways.length > 0;
  const manualAvailable = flags.manualPaymentEnabled === true && methods.length > 0;

  async function savePreference(next: string) {
    if (!isOwner || next === preference) return;
    setSavingPreference(true);
    try {
      await portalPost("set_billing_preference", { preference: next });
      setPreference(next);
      notify(locale === "ar" ? "تم تحديث نظام المحاسبة." : "Billing model updated.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "billing_update_failed", "error"); }
    finally { setSavingPreference(false); }
  }

  async function submitManualPayment(event: FormEvent) {
    event.preventDefault();
    if (!proof || !selectedPlan || !selectedMethod) {
      notify(locale === "ar" ? "اختر الخطة ووسيلة التحويل وارفع إثبات الدفع." : "Select a plan and transfer method, then upload proof.", "error");
      return;
    }
    setSending(true); setUploadProgress(0);
    try {
      const uploaded = await portalUpload("payment-proof", proof, setUploadProgress);
      await portalPost("create_manual_payment", {
        planId: selectedPlan,
        methodId: selectedMethod,
        contactEmail,
        proofPath: uploaded.path,
        transferReference: reference,
        idempotencyKey: `portal-${payload.account.merchantId}-${selectedPlan}-${Date.now()}`,
      });
      notify(locale === "ar" ? "تم إرسال إثبات الدفع للمراجعة." : "Payment proof sent for review.", "success");
      setSelectedPlan(""); setSelectedMethod(""); setReference(""); setProof(null); setUploadProgress(0);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "payment_request_failed", "error"); }
    finally { setSending(false); }
  }

  return <div className="portal-section-stack">
    {!isOwner ? <Notice tone="warning">{locale === "ar" ? "إدارة الاشتراك والمدفوعات متاحة لصاحب المتجر فقط." : "Subscription and payments are available only to the store owner."}</Notice> : null}
    {flags.monetizationEnabled !== true ? <Notice tone="info" title={locale === "ar" ? "المحاسبة غير مفعلة حاليًا" : "Monetization is currently disabled"}>{locale === "ar" ? "يمكنك استخدام البوابة، وستظهر الخطط وطرق الدفع عند تفعيل النظام من الإدارة." : "You can use the portal; plans and payment methods will appear when enabled by administration."}</Notice> : null}

    <div className="metrics-grid billing-metrics">
      <article className="metric-card green"><span className="metric-icon"><Icon name="shield"/></span><div><p>{locale === "ar" ? "حالة الوصول" : "Access status"}</p><strong>{text(status.access_status, locale === "ar" ? "غير محدد" : "Unknown")}</strong><small>{status.can_receive_orders ? (locale === "ar" ? "يستقبل طلبات جديدة" : "Receiving new work") : (locale === "ar" ? "استقبال الطلبات متوقف" : "New work paused")}</small></div></article>
      <article className="metric-card blue"><span className="metric-icon"><Icon name="clock"/></span><div><p>{locale === "ar" ? "النهاية الحالية" : "Current end date"}</p><strong>{dateLabel(status.effective_access_until || activeSubscription?.ends_at, locale)}</strong><small>{text(activeSubscription?.status)}</small></div></article>
      <article className="metric-card gold"><span className="metric-icon"><Icon name="money"/></span><div><p>{locale === "ar" ? "الرصيد المستحق" : "Balance due"}</p><strong>{money(status.balance_due || activeSubscription?.balance_due, "EGP", locale)}</strong><small>{locale === "ar" ? "وفق السجل المحاسبي" : "Based on billing ledger"}</small></div></article>
    </div>

    <PortalPanel title={locale === "ar" ? "نظام محاسبة المتجر" : "Store billing model"} subtitle={locale === "ar" ? "اختر الاشتراك الشهري أو العمولة عندما تكون الأنظمة مفعلة من الإدارة." : "Choose monthly subscription or commission when those models are enabled by administration."}>
      <div className="billing-choice">
        <button type="button" className={preference === "monthly_subscription" ? "selected" : ""} disabled={!isOwner || savingPreference} onClick={() => void savePreference("monthly_subscription")}><Icon name="card"/><strong>{locale === "ar" ? "اشتراك" : "Subscription"}</strong><small>{locale === "ar" ? "خطة محددة المدة مع تجديد." : "A timed plan with renewal."}</small></button>
        <button type="button" className={preference === "commission" ? "selected" : ""} disabled={!isOwner || savingPreference || flags.commissionEnabled !== true} onClick={() => void savePreference("commission")}><Icon name="money"/><strong>{locale === "ar" ? "عمولة" : "Commission"}</strong><small>{flags.commissionEnabled === true ? (locale === "ar" ? "تُحسب العمولة على العمليات المؤهلة." : "Commission applies to eligible transactions.") : (locale === "ar" ? "غير مفعلة حاليًا." : "Currently disabled.")}</small></button>
      </div>
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "خطط الاشتراك" : "Subscription plans"} subtitle={locale === "ar" ? "الأسعار والخصومات الظاهرة تأتي من إعدادات الإدارة مباشرة." : "Displayed prices and discounts come directly from admin settings."}>
      {plans.length === 0 ? <EmptyState icon="card" title={locale === "ar" ? "لا توجد خطط متاحة" : "No plans available"} body={locale === "ar" ? "ستظهر الخطط هنا بعد تفعيلها من الإدارة." : "Plans will appear once enabled by administration."}/> : <div className="plan-grid">{plans.map((plan) => <article className={`plan-card ${selectedPlan === text(plan.id) ? "selected" : ""}`} key={text(plan.id)}><span>{text(locale === "ar" ? plan.plan_type || "خطة" : plan.plan_code || "Plan")}</span><h3>{text(locale === "ar" ? plan.name_ar : plan.name_en)}</h3><p>{text(locale === "ar" ? plan.description_ar : plan.description_en)}</p><div className="plan-price">{Number(plan.old_price) > Number(plan.monthly_price) ? <del>{money(plan.old_price, plan.currency, locale)}</del> : null}<strong>{money(plan.monthly_price, plan.currency, locale)}</strong><small>{locale === "ar" ? `${text(plan.duration_days, "30")} يوم` : `${text(plan.duration_days, "30")} days`}</small></div>{isOwner && manualAvailable ? <button className="button primary full" type="button" onClick={() => setSelectedPlan(text(plan.id))}>{locale === "ar" ? "اختيار للتحويل اليدوي" : "Select for manual transfer"}</button> : null}</article>)}</div>}
    </PortalPanel>

    {isOwner && selectedPlan && manualAvailable ? <PortalPanel title={locale === "ar" ? "إرسال إثبات تحويل" : "Submit transfer proof"} subtitle={locale === "ar" ? "يتم إنشاء الطلب بعد رفع الإثبات، وتراجع الإدارة المبلغ والخطة قبل التفعيل." : "The request is created after proof upload; administration reviews the amount and plan before activation."}>
      <form className="portal-form manual-payment-form" onSubmit={submitManualPayment}>
        <div className="form-grid two"><label>{locale === "ar" ? "الخطة" : "Plan"}<select required value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)}>{plans.map((plan) => <option key={text(plan.id)} value={text(plan.id)}>{text(locale === "ar" ? plan.name_ar : plan.name_en)} — {money(plan.monthly_price, plan.currency, locale)}</option>)}</select></label><label>{locale === "ar" ? "وسيلة التحويل" : "Transfer method"}<select required value={selectedMethod} onChange={(event) => setSelectedMethod(event.target.value)}><option value="">{locale === "ar" ? "اختر الوسيلة" : "Select a method"}</option>{methods.map((method) => <option key={text(method.id)} value={text(method.id)}>{text(locale === "ar" ? method.name_ar : method.name_en)}</option>)}</select></label><label>{locale === "ar" ? "بريد التواصل" : "Contact email"}<input required type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)}/></label><label>{locale === "ar" ? "مرجع التحويل (اختياري)" : "Transfer reference (optional)"}<input value={reference} onChange={(event) => setReference(event.target.value)}/></label></div>
        {chosenMethod ? <div className="payment-method-details"><strong>{text(chosenMethod.account_label)}</strong><span>{text(chosenMethod.account_number)}</span><small>{text(chosenMethod.account_holder_name)}</small><p>{text(locale === "ar" ? chosenMethod.instructions_ar : chosenMethod.instructions_en)}</p></div> : null}
        <label className="file-button"><Icon name="upload"/><span>{proof ? proof.name : (locale === "ar" ? "ارفع صورة أو PDF لإثبات الدفع" : "Upload image or PDF payment proof")}</span><input required type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setProof(event.target.files?.[0] ?? null)}/></label>
        {sending ? <div className="upload-progress"><span style={{ width: `${uploadProgress}%` }}/><small>{uploadProgress}%</small></div> : null}
        <div className="panel-footer-actions"><button className="button secondary" type="button" onClick={() => setSelectedPlan("")}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="submit" disabled={sending}>{sending ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "إرسال للمراجعة" : "Submit for review")}</button></div>
      </form>
    </PortalPanel> : null}

    {flags.automaticPaymentEnabled === true ? <PortalPanel title={locale === "ar" ? "الدفع الإلكتروني" : "Online payment"} subtitle={locale === "ar" ? "لا يظهر زر دفع إلا عند وجود بوابة متصلة فعليًا." : "A checkout button is shown only when a gateway is actually connected."}>{automaticAvailable ? <div className="gateway-grid">{gateways.map((gateway) => <article key={text(gateway.id)}><Icon name="card"/><div><strong>{text(locale === "ar" ? gateway.display_name_ar : gateway.display_name_en, text(gateway.provider))}</strong><small>{text(gateway.gateway_environment)}</small></div><StatusBadge value="active" locale={locale}/></article>)}</div> : <Notice tone="warning">{locale === "ar" ? "ميزة الدفع الإلكتروني مفعلة في الإعدادات، لكن لا توجد بوابة متصلة جاهزة لإنشاء Checkout حقيقي بعد." : "Online payments are enabled in settings, but no connected gateway is ready to create a real checkout yet."}</Notice>}</PortalPanel> : null}

    <PortalPanel title={locale === "ar" ? "طلبات الدفع السابقة" : "Previous payment requests"}>
      {requests.length === 0 ? <EmptyState icon="history" title={locale === "ar" ? "لا توجد طلبات دفع" : "No payment requests"} body={locale === "ar" ? "طلبات التحويل اليدوي التي ترسلها ستظهر هنا." : "Submitted manual transfer requests will appear here."}/> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "المبلغ" : "Amount"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "المرجع" : "Reference"}</th></tr></thead><tbody>{requests.map((request) => <tr key={text(request.id)}><td>{dateLabel(request.created_at, locale)}</td><td>{money(request.final_amount, request.currency, locale)}</td><td><StatusBadge value={request.status} locale={locale}/></td><td>{text(request.transfer_reference, "—")}</td></tr>)}</tbody></table></div>}
    </PortalPanel>
  </div>;
}
