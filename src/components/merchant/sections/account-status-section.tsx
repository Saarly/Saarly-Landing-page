"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, dateLabel, numberValue, row, statusLabel, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function AccountStatusSection({ payload, locale }: SectionProps) {
  const status = row(payload.data.status || payload.data);
  const merchant = payload.account.merchant;
  const approval = text(merchant.approval_status, "pending");
  const access = text(status.access_status || status.account_status, approval === "approved" ? "pre_launch_access" : approval);
  const canReceiveWork = bool(status.can_receive_new_work, bool(status.can_receive_orders, approval === "approved"));
  const stopReason = text(status.stop_reason || merchant.rejection_reason);
  const detailRows = [
    { labelAr: "طريقة التشغيل", labelEn: "Operating mode", value: statusLabel(status.pricing_mode || merchant.pricing_mode, locale) },
    { labelAr: "استقبال الطلبات", labelEn: "Receiving requests", value: canReceiveWork ? (locale === "ar" ? "مفعل" : "Enabled") : (locale === "ar" ? "متوقف" : "Paused") },
    ...(text(status.subscription_status) ? [{ labelAr: "حالة الصلاحية", labelEn: "Access lifecycle", value: statusLabel(status.subscription_status, locale) }] : []),
    ...(stopReason ? [{ labelAr: "سبب التوقف", labelEn: "Pause reason", value: statusLabel(stopReason, locale) }] : []),
    ...(status.founder_number != null ? [{ labelAr: "رقم المؤسس", labelEn: "Founder number", value: String(numberValue(status.founder_number)) }] : []),
    ...(status.free_trial_starts_at ? [{ labelAr: "بداية الفترة المجانية", labelEn: "Free period start", value: dateLabel(status.free_trial_starts_at, locale) }] : []),
    ...(status.free_trial_ends_at ? [{ labelAr: "نهاية الفترة المجانية", labelEn: "Free period end", value: dateLabel(status.free_trial_ends_at, locale) }] : []),
    ...(status.subscription_starts_at ? [{ labelAr: "بداية الحالة الحالية", labelEn: "Current status start", value: dateLabel(status.subscription_starts_at, locale) }] : []),
    ...(status.subscription_ends_at ? [{ labelAr: "نهاية الحالة الحالية", labelEn: "Current status end", value: dateLabel(status.subscription_ends_at, locale) }] : []),
    ...(status.days_remaining != null ? [{ labelAr: "الأيام المتبقية", labelEn: "Days remaining", value: String(numberValue(status.days_remaining)) }] : []),
    ...(status.grace_period_ends_at ? [{ labelAr: "نهاية فترة السماح", labelEn: "Grace period end", value: dateLabel(status.grace_period_ends_at, locale) }] : []),
    ...(status.grace_period_days != null ? [{ labelAr: "مدة السماح", labelEn: "Grace period length", value: locale === "ar" ? `${numberValue(status.grace_period_days)} يوم` : `${numberValue(status.grace_period_days)} days` }] : []),
    ...(status.blocked_from_new_work_at ? [{ labelAr: "توقف استقبال الطلبات", labelEn: "Paused since", value: dateLabel(status.blocked_from_new_work_at, locale) }] : []),
  ];

  return <div className="portal-section-stack">
    {!canReceiveWork ? <Notice tone="danger" title={locale === "ar" ? "استقبال الطلبات متوقف" : "New requests paused"}>{locale === "ar" ? "حساب المتجر غير نشط حاليًا، لذلك تم إيقاف استقبال الطلبات الجديدة. ما زال بإمكانك الدخول ومراجعة حالة الحساب." : "The store account is currently inactive, so new requests are paused. You can still access the portal and review account status."}</Notice> : null}

    <div className="metrics-grid account-status-metrics">
      <MetricCard icon="shield" label={locale === "ar" ? "حالة الحساب" : "Account status"} value={statusLabel(access, locale)} note={statusLabel(approval, locale)}/>
      <MetricCard icon="quote" label={locale === "ar" ? "استقبال الطلبات" : "Receiving requests"} value={canReceiveWork ? (locale === "ar" ? "مفعل" : "Enabled") : (locale === "ar" ? "متوقف" : "Paused")} tone={canReceiveWork ? "green" : "gold"}/>
    </div>

    <PortalPanel title={locale === "ar" ? "تفاصيل الحساب" : "Account details"} subtitle={locale === "ar" ? "نفس تفاصيل حالة الحساب التي يعرضها تطبيق المتجر، للمتابعة فقط." : "The same read-only account status details shown in the merchant app."}>
      <div className="detail-list">
        {detailRows.map((item) => <div key={item.labelEn}><span>{locale === "ar" ? item.labelAr : item.labelEn}</span><strong>{item.value || "—"}</strong></div>)}
      </div>
    </PortalPanel>

    {payload.account.isOwner ? <PortalPanel title={locale === "ar" ? "إدارة اشتراك سعرلي" : "Manage Saarly subscription"} subtitle={locale === "ar" ? "الدفع والتجديد متاحان في بوابة الويب فقط ولا يظهران داخل تطبيق الموبايل." : "Payment and renewal are available in the web portal only and are not exposed in the mobile app."}>
      <div className="settings-links"><Link href="/merchant/subscriptions"><Icon name="card"/><span><strong>{locale === "ar" ? "الاشتراكات والدفع" : "Subscriptions & payments"}</strong><small>{locale === "ar" ? "الخطط، الخصومات، التحويل اليدوي وسجل المعاملات حسب إعدادات الإدارة." : "Plans, discounts, manual transfer, and transaction history according to Admin settings."}</small></span><Icon name="arrow"/></Link></div>
    </PortalPanel> : null}
  </div>;
}
