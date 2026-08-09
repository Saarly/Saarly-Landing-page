"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, row, rows, statusLabel, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function StoreSection({ payload, locale, refresh, notify }: SectionProps) {
  const merchant = payload.account.merchant;
  const data = row(payload.data);
  const categories = rows(data.categories);
  const selectedInitial = rows(data.merchantCategories).map((item) => text(item.category_id)).filter(Boolean);
  const [form, setForm] = useState({
    storeName: text(merchant.store_name),
    managerName: text(merchant.manager_name),
    managerMobile: text(merchant.manager_mobile),
    contactMobile: text(merchant.contact_mobile),
    craftsmanAvailable: bool(merchant.craftsman_available),
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedInitial));
  const [saving, setSaving] = useState(false);
  const status = row(data.status);
  const approval = text(merchant.approval_status, "pending");

  function toggleCategory(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    if (selected.size === 0) {
      notify(locale === "ar" ? "اختر قسمًا واحدًا على الأقل." : "Select at least one category.", "error");
      return;
    }
    setSaving(true);
    try {
      await portalPost("save_store", { ...form, categoryIds: [...selected] });
      notify(locale === "ar" ? "تم حفظ بيانات المتجر." : "Store details saved.", "success");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "save_failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save();
  }

  return (
    <div className="portal-section-stack">
      {approval !== "approved" ? <Notice tone={approval === "rejected" ? "danger" : "warning"}>{approval === "rejected" ? (text(merchant.rejection_reason) || (locale === "ar" ? "تم رفض المتجر. راجع السبب وتواصل مع الدعم." : "The store was rejected. Review the reason and contact support.")) : (locale === "ar" ? "يمكن تعديل البيانات أثناء المراجعة، لكن التعديلات الجوهرية قد تحتاج مراجعة جديدة." : "Details can be edited during review, but material changes may require another review.")}</Notice> : null}
      <div className="portal-two-columns portal-store-grid">
        <PortalPanel title={locale === "ar" ? "بيانات المتجر" : "Store details"} subtitle={locale === "ar" ? "البيانات الأساسية الظاهرة داخل النظام." : "Core information used across the system."}>
          <form className="portal-form" onSubmit={submit}>
            <div className="form-grid two">
              <label>{locale === "ar" ? "اسم المتجر" : "Store name"}<input required minLength={2} value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })}/></label>
              <label>{locale === "ar" ? "اسم مدير المتجر" : "Store manager name"}<input required minLength={2} value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })}/></label>
              <label>{locale === "ar" ? "هاتف المدير" : "Manager phone"}<input required minLength={7} value={form.managerMobile} onChange={(event) => setForm({ ...form, managerMobile: event.target.value })} inputMode="tel"/></label>
              <label>{locale === "ar" ? "هاتف التواصل" : "Contact phone"}<input required minLength={7} value={form.contactMobile} onChange={(event) => setForm({ ...form, contactMobile: event.target.value })} inputMode="tel"/></label>
            </div>
            <label className="switch-row"><input type="checkbox" checked={form.craftsmanAvailable} onChange={(event) => setForm({ ...form, craftsmanAvailable: event.target.checked })}/><span><strong>{locale === "ar" ? "خدمة فني متاحة" : "Craftsman service available"}</strong><small>{locale === "ar" ? "فعّلها فقط إذا كان المتجر يقدم الخدمة حاليًا." : "Enable only when the store currently provides this service."}</small></span></label>
            <div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ البيانات" : "Save details")}<Icon name="check" size={18}/></button></div>
          </form>
        </PortalPanel>

        <PortalPanel title={locale === "ar" ? "حالة التشغيل" : "Operating status"} subtitle={locale === "ar" ? "هذه القيم تُحسب من النظام ولا يمكن تجاوزها من الواجهة." : "These values are calculated by the system and cannot be bypassed in the interface."}>
          <div className="detail-list">
            <div><span>{locale === "ar" ? "اعتماد المتجر" : "Approval"}</span><StatusBadge value={approval} locale={locale}/></div>
            <div><span>{locale === "ar" ? "طريقة التشغيل" : "Pricing mode"}</span><strong>{statusLabel(merchant.pricing_mode, locale)}</strong></div>
            <div><span>{locale === "ar" ? "حالة الوصول" : "Access status"}</span><StatusBadge value={status.access_status} locale={locale}/></div>
            <div><span>{locale === "ar" ? "استقبال الطلبات" : "Receiving requests"}</span><strong>{status.can_receive_orders ? (locale === "ar" ? "مفعّل" : "Enabled") : (locale === "ar" ? "متوقف" : "Paused")}</strong></div>
            <div><span>{locale === "ar" ? "رقم المؤسس" : "Founder number"}</span><strong>{text(merchant.founder_number, locale === "ar" ? "غير مسجل" : "Not assigned")}</strong></div><div><span>{locale === "ar" ? "شارة متجر مؤسس" : "Founding store badge"}</span><strong>{bool(merchant.founder_badge_enabled) ? (locale === "ar" ? "مفعّلة" : "Enabled") : (locale === "ar" ? "غير مفعّلة" : "Not enabled")}</strong></div><div><span>{locale === "ar" ? "شارة متجر موثوق" : "Trusted store badge"}</span><strong>{bool(merchant.trusted_badge_enabled) ? (locale === "ar" ? "مفعّلة" : "Enabled") : (locale === "ar" ? "غير مفعّلة" : "Not enabled")}</strong></div><div><span>{locale === "ar" ? "حساب اختبار" : "Test account"}</span><strong>{bool(merchant.is_test_account) ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}</strong></div>
          </div>
        </PortalPanel>
      </div>

      <PortalPanel title={locale === "ar" ? "أقسام المتجر" : "Store categories"} subtitle={locale === "ar" ? "اختر الأقسام التي يعمل بها المتجر. يلزم قسم واحد على الأقل." : "Select the categories served by the store. At least one is required."}>
        <div className="category-selector">{categories.map((category) => {
          const id = text(category.id);
          const active = selected.has(id);
          return <button type="button" className={active ? "active" : ""} key={id} onClick={() => toggleCategory(id)}><span className="category-check">{active ? <Icon name="check" size={16}/> : null}</span><div><strong>{text(locale === "ar" ? category.name_ar : category.name_en)}</strong><small>{text(category.slug)}</small></div></button>;
        })}</div>
        <div className="form-actions"><button className="button primary" type="button" disabled={saving} onClick={() => void save()}>{locale === "ar" ? "حفظ الأقسام" : "Save categories"}</button></div>
      </PortalPanel>
    </div>
  );
}
