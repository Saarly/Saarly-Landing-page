"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { currencyLabel, money, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type DeliveryRow = { label: string; price: string; maxWeightKg?: string };
type Method = "flat" | "zone" | "weight";

function deliveryRows(value: unknown): DeliveryRow[] {
  return rows(value).map((item) => ({ label: text(item.label), price: text(item.price, "0"), maxWeightKg: text(item.max_weight_kg) }));
}

export function DeliverySection({ payload, locale, refresh, notify }: SectionProps) {
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  const current = row(payload.data.settings);
  const shipping = row(payload.data.shipping);
  const primaryBranch = row(payload.data.primaryBranch);
  const currency = text(payload.data.currencyCode, payload.account.currencyCode || "EGP");
  const table = useMemo(() => row(current.pricing_table), [current.pricing_table]);
  const enabledMap = row(table.enabled_methods);
  const [enabled, setEnabled] = useState<Record<Method, boolean>>({ flat: enabledMap.flat === true || (current.is_enabled === true && text(current.pricing_method) === "flat"), zone: enabledMap.zone === true || (current.is_enabled === true && text(current.pricing_method) === "zone"), weight: enabledMap.weight === true || (current.is_enabled === true && text(current.pricing_method) === "weight") });
  const [method, setMethod] = useState<Method>((["flat", "zone", "weight"].includes(text(current.pricing_method)) ? text(current.pricing_method) : "flat") as Method);
  const [methodRows, setMethodRows] = useState<Record<Method, DeliveryRow[]>>({
    flat: deliveryRows(table.flat_rows).length ? deliveryRows(table.flat_rows) : [{ label: locale === "ar" ? "التوصيل" : "Delivery", price: "0" }],
    zone: deliveryRows(table.zone_rows),
    weight: deliveryRows(table.weight_rows),
  });
  const [saving, setSaving] = useState(false);
  const [savingFreeDelivery, setSavingFreeDelivery] = useState(false);
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState(primaryBranch.free_delivery_enabled === true);
  const [freeDeliveryMinimum, setFreeDeliveryMinimum] = useState(text(primaryBranch.free_delivery_minimum));
  const companies = rows(shipping.companies);
  const batches = rows(shipping.batches);
  const [companyName, setCompanyName] = useState("");
  const [batch, setBatch] = useState({ companyId: "", min: "0", max: "1", price: "0" });

  function updateRow(index: number, patch: Partial<DeliveryRow>) { setMethodRows((currentRows) => ({ ...currentRows, [method]: currentRows[method].map((item, currentIndex) => currentIndex === index ? { ...item, ...patch } : item) })); }
  function addRow() { setMethodRows((currentRows) => ({ ...currentRows, [method]: [...currentRows[method], { label: "", price: "0" }] })); }
  async function removeRow(index: number) {
    if (!(await confirm({ title: locale === "ar" ? "حذف صف السعر" : "Delete pricing row", body: locale === "ar" ? "هيتم حذف الصف من المسودة الحالية. التغيير النهائي يتم عند حفظ الإعدادات." : "This row will be removed from the current draft. The change becomes final when settings are saved.", confirmLabel: locale === "ar" ? "حذف الصف" : "Delete row", tone: "danger" }))) return;
    setMethodRows((currentRows) => ({ ...currentRows, [method]: currentRows[method].filter((_, currentIndex) => currentIndex !== index) }));
  }

  async function savePrimaryFreeDelivery() {
    if (!text(primaryBranch.id)) return;
    const minimum = Number(freeDeliveryMinimum);
    if (freeDeliveryEnabled && (!Number.isFinite(minimum) || minimum <= 0)) {
      notify(locale === "ar" ? "أدخل حدًا أدنى أكبر من صفر." : "Enter a minimum greater than zero.", "error");
      return;
    }
    setSavingFreeDelivery(true);
    try {
      await portalPost("save_primary_branch_free_delivery", { branchId: text(primaryBranch.id), enabled: freeDeliveryEnabled, minimum: freeDeliveryEnabled ? minimum : null });
      notify(locale === "ar" ? "تم حفظ إعداد التوصيل المجاني للمتجر الأساسي." : "Main store free delivery setting was saved.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "free_delivery_save_failed", "error"); }
    finally { setSavingFreeDelivery(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const clean = (input: DeliveryRow[]) => input.filter((item) => item.label.trim() || Number(item.price) > 0).map((item) => ({ label: item.label.trim(), price: Math.max(0, Number(item.price) || 0), ...(item.maxWeightKg ? { max_weight_kg: Math.max(0, Number(item.maxWeightKg) || 0) } : {}) }));
      const pricingTable = { rows: clean(methodRows[method]), flat_rows: clean(methodRows.flat), zone_rows: clean(methodRows.zone), weight_rows: clean(methodRows.weight), enabled_methods: enabled };
      await portalPost("save_delivery", { isEnabled: Object.values(enabled).some(Boolean), pricingMethod: method, pricingTable });
      notify(locale === "ar" ? "تم حفظ طرق التوصيل والأسعار." : "Delivery methods and prices saved.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "delivery_save_failed", "error"); }
    finally { setSaving(false); }
  }

  async function saveCompany() {
    if (!companyName.trim()) return;
    try { await portalPost("save_shipping_company", { name: companyName.trim(), isActive: true }); setCompanyName(""); notify(locale === "ar" ? "تمت إضافة شركة الشحن." : "Shipping company added.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "company_save_failed", "error"); }
  }
  async function removeCompany(id: string) { if (!(await confirm({ title: locale === "ar" ? "حذف شركة الشحن" : "Delete shipping company", body: locale === "ar" ? "سيتم حذف شركة الشحن والشرائح المرتبطة بها." : "The shipping company and its related tiers will be deleted.", confirmLabel: locale === "ar" ? "حذف الشركة" : "Delete company", tone: "danger" }))) return; try { await portalPost("delete_shipping_company", { id }); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "company_delete_failed", "error"); } }
  async function saveBatch() {
    const min = Number(batch.min); const max = Number(batch.max); const price = Number(batch.price);
    if (!batch.companyId || !Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(price) || price < 0) {
      notify(locale === "ar" ? "راجع شركة الشحن وحدود الوزن والسعر قبل الحفظ." : "Check the company, weight range and price before saving.", "error"); return;
    }
    try { await portalPost("save_shipping_batch", { companyId: batch.companyId, minWeight: min, maxWeight: max, price }); setBatch({ companyId: "", min: "0", max: "1", price: "0" }); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "batch_save_failed", "error"); }
  }
  async function removeBatch(id: string) { if (!(await confirm({ title: locale === "ar" ? "حذف شريحة الشحن" : "Delete shipping tier", body: locale === "ar" ? "سيتم حذف شريحة الوزن والسعر دي." : "This weight and price tier will be deleted.", confirmLabel: locale === "ar" ? "حذف الشريحة" : "Delete tier", tone: "danger" }))) return; try { await portalPost("delete_shipping_batch", { id }); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "batch_delete_failed", "error"); } }

  return <div className="portal-section-stack">
    {text(primaryBranch.id) ? <PortalPanel title={locale === "ar" ? "التوصيل المجاني للمتجر الأساسي" : "Main store free delivery"} subtitle={locale === "ar" ? "فعّل التوصيل المجاني عندما يصل إجمالي المنتجات إلى حد أدنى تحدده. ويمكن ضبط كل فرع آخر بصورة مستقلة من صفحة الفروع." : "Enable free delivery when the products subtotal reaches a minimum you choose. Other branches can be configured independently from the Branches page."}>
      <div className="delivery-free-card">
        <label className="switch-row"><input type="checkbox" checked={freeDeliveryEnabled} onChange={(event) => setFreeDeliveryEnabled(event.target.checked)} disabled={savingFreeDelivery}/><span><strong>{locale === "ar" ? "تفعيل التوصيل المجاني" : "Enable free delivery"}</strong><small>{locale === "ar" ? `لـ ${text(primaryBranch.name, "المتجر الأساسي")}` : `For ${text(primaryBranch.name, "main store")}`}</small></span></label>
        {freeDeliveryEnabled ? <label className="delivery-free-minimum"><span>{locale === "ar" ? "الحد الأدنى لإجمالي المنتجات" : "Minimum products subtotal"}</span><div className="input-with-suffix"><input type="number" min="0.01" step="0.01" value={freeDeliveryMinimum} onChange={(event) => setFreeDeliveryMinimum(event.target.value)}/><span>{currencyLabel(currency, locale)}</span></div></label> : null}
        <div className="delivery-save-row"><button className="button secondary" disabled={savingFreeDelivery} onClick={() => void savePrimaryFreeDelivery()}><Icon name="check" size={18}/>{savingFreeDelivery ? (locale === "ar" ? "جارٍ الحفظ…" : "Saving…") : (locale === "ar" ? "حفظ إعداد التوصيل المجاني" : "Save free delivery setting")}</button></div>
      </div>
    </PortalPanel> : null}

    <PortalPanel title={locale === "ar" ? "طرق التوصيل المفعلة" : "Enabled delivery methods"} subtitle={locale === "ar" ? "فعّل أكتر من طريقة في نفس الوقت، وبعدها اختر الطريقة التي تريد تعديل تفاصيلها." : "Enable more than one method, then choose the method whose details you want to edit."} action={<button className="button primary compact" disabled={saving} onClick={() => void save()}><Icon name="check" size={18}/>{locale === "ar" ? "حفظ الإعدادات" : "Save settings"}</button>}>
      <div className="delivery-method-body">
        <div className="delivery-method-switches">{(["zone", "weight", "flat"] as Method[]).map((item) => <label className="switch-row" key={item}><input type="checkbox" checked={enabled[item]} onChange={(event) => setEnabled((currentEnabled) => ({ ...currentEnabled, [item]: event.target.checked }))}/><span><strong>{item === "zone" ? (locale === "ar" ? "حسب المنطقة" : "By zone") : item === "weight" ? (locale === "ar" ? "حسب الوزن" : "By weight") : (locale === "ar" ? "سعر ثابت" : "Flat rate")}</strong><small>{item === "zone" ? (locale === "ar" ? "سعر مختلف حسب المدينة أو المنطقة" : "Different price by city or area") : item === "weight" ? (locale === "ar" ? "شركات شحن وباقات وزن مستقلة" : "Shipping companies and weight tiers") : (locale === "ar" ? "سعر ثابت للتوصيل" : "One fixed delivery price")}</small></span></label>)}</div>
        <div className="delivery-method-picker">
          <p className="field-heading">{locale === "ar" ? "اختر الطريقة التي تريد تعديل تفاصيلها" : "Choose the method to edit"}</p>
          <div className="setting-options three">{(["zone", "weight", "flat"] as Method[]).map((item) => <button type="button" className={method === item ? "selected" : ""} onClick={() => setMethod(item)} key={item}><strong>{item === "zone" ? (locale === "ar" ? "حسب المنطقة" : "By zone") : item === "weight" ? (locale === "ar" ? "حسب الوزن" : "By weight") : (locale === "ar" ? "سعر ثابت" : "Flat rate")}</strong></button>)}</div>
        </div>
        {!enabled[method] ? <p className="form-notice">{locale === "ar" ? "هذه الطريقة غير مفعلة حاليًا، ويمكنك تعديل بياناتها ثم تفعيلها من الزر الخاص بها." : "This method is disabled. You can edit it first, then enable it from its switch."}</p> : null}
        {method !== "weight" ? <div className="delivery-row-list">{methodRows[method].map((item, index) => <article className="delivery-row-editor" key={`${method}-${index}`}><label><span>{method === "zone" ? (locale === "ar" ? "اسم المنطقة أو المدينة" : "Zone or city") : (locale === "ar" ? "الوصف" : "Label")}</span><input value={item.label} onChange={(event) => updateRow(index, { label: event.target.value })}/></label><label><span>{locale === "ar" ? "السعر" : "Price"}</span><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateRow(index, { price: event.target.value })}/></label><button className="icon-button danger" type="button" aria-label={locale === "ar" ? "حذف الصف" : "Delete row"} onClick={() => void removeRow(index)}><Icon name="trash" size={17}/></button></article>)}<button className="button secondary compact" type="button" onClick={addRow}><Icon name="plus" size={17}/>{locale === "ar" ? "إضافة صف سعر" : "Add price row"}</button></div> : <p className="form-notice">{locale === "ar" ? "استخدم شركات الشحن والشرائح تحت عشان تسعّر حسب الوزن." : "Use shipping companies and tiers below for weight pricing."}</p>}
      </div>
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "شركات الشحن وشرائح الوزن" : "Shipping companies and weight tiers"} subtitle={locale === "ar" ? "كل شركة ليها أكتر من شريحة وزن وسعر مستقل." : "Each company can have multiple independent weight tiers."}>
      <div className="delivery-shipping-body">
        <div className="inline-form"><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder={locale === "ar" ? "اسم شركة الشحن" : "Shipping company name"}/><button className="button secondary" onClick={() => void saveCompany()}><Icon name="plus" size={17}/>{locale === "ar" ? "إضافة شركة" : "Add company"}</button></div>
        {companies.length ? <div className="shipping-company-list">{companies.map((company) => <article key={text(company.id)}><strong>{text(company.name)}</strong><button className="icon-button danger" aria-label={locale === "ar" ? "حذف شركة الشحن" : "Delete shipping company"} onClick={() => void removeCompany(text(company.id))}><Icon name="trash" size={16}/></button></article>)}</div> : <EmptyState title={locale === "ar" ? "لا توجد شركات شحن" : "No shipping companies"} body={locale === "ar" ? "أضف شركة لو هتستخدم التسعير حسب الوزن." : "Add a company for weight-based pricing."}/>} 
        <div className="form-grid four"><label><span>{locale === "ar" ? "الشركة" : "Company"}</span><select value={batch.companyId} onChange={(event) => setBatch({ ...batch, companyId: event.target.value })}><option value="">—</option>{companies.map((company) => <option value={text(company.id)} key={text(company.id)}>{text(company.name)}</option>)}</select></label><label><span>{locale === "ar" ? "الوزن من" : "Minimum weight"}</span><input type="number" min="0" step="0.01" value={batch.min} onChange={(event) => setBatch({ ...batch, min: event.target.value })}/></label><label><span>{locale === "ar" ? "الوزن إلى" : "Maximum weight"}</span><input type="number" min="0.01" step="0.01" value={batch.max} onChange={(event) => setBatch({ ...batch, max: event.target.value })}/></label><label><span>{locale === "ar" ? "السعر" : "Price"}</span><input type="number" min="0" step="0.01" value={batch.price} onChange={(event) => setBatch({ ...batch, price: event.target.value })}/></label></div>
        <div className="delivery-tier-actions"><button className="button secondary" disabled={!batch.companyId} onClick={() => void saveBatch()}><Icon name="plus" size={17}/>{locale === "ar" ? "إضافة شريحة" : "Add tier"}</button></div>
        {batches.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "الشركة" : "Company"}</th><th>{locale === "ar" ? "الوزن" : "Weight"}</th><th>{locale === "ar" ? "السعر" : "Price"}</th><th/></tr></thead><tbody>{batches.map((item: PortalRow) => <tr key={text(item.id)}><td>{text(item.company_name, locale === "ar" ? "شركة شحن" : "Shipping company")}</td><td>{text(item.min_weight_kg)} - {text(item.max_weight_kg)} {locale === "ar" ? "كيلوجرام" : "kilograms"}</td><td>{money(item.price, currency, locale)}</td><td><button className="icon-button danger" aria-label={locale === "ar" ? "حذف الشريحة" : "Delete tier"} onClick={() => void removeBatch(text(item.id))}><Icon name="trash" size={16}/></button></td></tr>)}</tbody></table></div> : null}
      </div>
    </PortalPanel>
    {confirmDialog}
  </div>;
}
