"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type BranchForm = {
  id: string; name: string; cityId: string; latitude: string; longitude: string; managerName: string; managerMobile: string; frontImageUrl: string; deliveryEnabled: boolean; deliveryPricingMethod: string; craftsmanAvailable: boolean; managerIdFrontPath: string; managerIdBackPath: string; usesParentCommercialRegister: boolean; commercialRegisterPath: string;
};
const empty: BranchForm = { id: "", name: "", cityId: "", latitude: "30.0444", longitude: "31.2357", managerName: "", managerMobile: "", frontImageUrl: "", deliveryEnabled: false, deliveryPricingMethod: "flat", craftsmanAvailable: false, managerIdFrontPath: "", managerIdBackPath: "", usesParentCommercialRegister: true, commercialRegisterPath: "" };

export function BranchesSection({ payload, locale, refresh, notify }: SectionProps) {
  const branches = rows(payload.data.branches);
  const cities = rows(payload.data.cities);
  const documents = rows(payload.data.documents);
  const [form, setForm] = useState<BranchForm>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"front" | "back" | "register" | "">("");
  const docMap = useMemo(() => {
    const map = new Map<string, PortalRow[]>();
    documents.forEach((document) => { const key = text(document.branch_id); map.set(key, [...(map.get(key) ?? []), document]); });
    return map;
  }, [documents]);

  function edit(branch?: PortalRow) {
    if (!branch) setForm(empty);
    else setForm({
      id: text(branch.id), name: text(branch.name), cityId: text(branch.city_id), latitude: text(branch.latitude), longitude: text(branch.longitude), managerName: "", managerMobile: text(branch.manager_mobile), frontImageUrl: text(branch.front_image_url), deliveryEnabled: bool(branch.delivery_enabled), deliveryPricingMethod: text(branch.delivery_pricing_method, "flat"), craftsmanAvailable: bool(branch.craftsman_available), managerIdFrontPath: "", managerIdBackPath: "", usesParentCommercialRegister: branch.uses_parent_commercial_register !== false, commercialRegisterPath: "",
    });
    setOpen(true);
  }

  async function upload(side: "front" | "back" | "register", file: File) {
    setUploading(side);
    try {
      const result = await portalUpload(side === "register" ? "branch-commercial-register" : `branch-manager-${side}`, file);
      setForm((current) => ({ ...current, [side === "front" ? "managerIdFrontPath" : side === "back" ? "managerIdBackPath" : "commercialRegisterPath"]: result.path }));
      notify(side === "register" ? (locale === "ar" ? "تم رفع السجل التجاري المستقل." : "Separate commercial register uploaded.") : (locale === "ar" ? `تم رفع ${side === "front" ? "وجه" : "ظهر"} البطاقة.` : `${side === "front" ? "Front" : "Back"} ID uploaded.`), "success");
    } catch (error) { notify(error instanceof Error ? error.message : "upload_failed", "error"); }
    finally { setUploading(""); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.id && (!form.managerIdFrontPath || !form.managerIdBackPath)) { notify(locale === "ar" ? "ارفع وجه وظهر بطاقة مدير الفرع." : "Upload both sides of the branch manager ID.", "error"); return; }
    if ((form.managerIdFrontPath && !form.managerIdBackPath) || (!form.managerIdFrontPath && form.managerIdBackPath)) { notify(locale === "ar" ? "يجب رفع الوجه والظهر معًا." : "Both ID sides must be uploaded together.", "error"); return; }
    if (!form.usesParentCommercialRegister && !form.id && !form.commercialRegisterPath) { notify(locale === "ar" ? "ارفع السجل التجاري المستقل للفرع أو اختر استخدام سجل المتجر الرئيسي." : "Upload the branch commercial register or use the main store register.", "error"); return; }
    setSaving(true);
    try {
      await portalPost("save_branch", { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) });
      notify(locale === "ar" ? "تم حفظ الفرع وإرساله للمراجعة عند الحاجة." : "Branch saved and sent for review when required.", "success");
      setOpen(false); setForm(empty); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "save_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack"><Notice>{locale === "ar" ? "إضافة فرع جديد تتطلب بيانات مدير الفرع ووجه وظهر بطاقة الهوية. تحفظ الملفات في تخزين خاص وتراجع من الأدمن." : "A new branch requires manager details and both sides of the manager ID. Files are stored privately and reviewed by an admin."}</Notice><PortalPanel title={locale === "ar" ? "فروع المتجر" : "Store branches"} subtitle={locale === "ar" ? "إدارة مواقع الفروع وخدمات التوصيل والفني." : "Manage branch locations, delivery, and craftsman services."} action={<button className="button primary compact" type="button" onClick={() => edit()}><Icon name="plus" size={18}/>{locale === "ar" ? "إضافة فرع" : "Add branch"}</button>}>
    {branches.length === 0 ? <EmptyState icon="branch" title={locale === "ar" ? "لا توجد فروع" : "No branches"} body={locale === "ar" ? "أضف الفرع الأول وأرفق مستندات مديره." : "Add the first branch and attach its manager documents."} action={<button className="button primary compact" type="button" onClick={() => edit()}>{locale === "ar" ? "إضافة فرع" : "Add branch"}</button>}/> : <div className="branch-grid">{branches.map((branch) => { const branchDocs = docMap.get(text(branch.id)) ?? []; const front = branchDocs.find((doc) => text(doc.kind).endsWith("front")); const back = branchDocs.find((doc) => text(doc.kind).endsWith("back")); return <article className="branch-card" key={text(branch.id)}><header><span className="branch-icon"><Icon name="branch"/></span><div><h3>{text(branch.name)}</h3><p>{text(branch.governorate_name)} · {text(branch.city_name)}</p></div><StatusBadge value={branch.approval_status} locale={locale}/></header><div className="detail-list compact"><div><span>{locale === "ar" ? "هاتف المدير" : "Manager phone"}</span><strong>{text(branch.manager_mobile)}</strong></div><div><span>{locale === "ar" ? "التوصيل" : "Delivery"}</span><strong>{bool(branch.delivery_enabled) ? (locale === "ar" ? "مفعّل" : "Enabled") : (locale === "ar" ? "غير مفعّل" : "Disabled")}</strong></div><div><span>{locale === "ar" ? "الفني" : "Craftsman"}</span><strong>{bool(branch.craftsman_available) ? (locale === "ar" ? "متاح" : "Available") : (locale === "ar" ? "غير متاح" : "Unavailable")}</strong></div><div><span>{locale === "ar" ? "مستندات المدير" : "Manager documents"}</span><span className="document-statuses"><StatusBadge value={front?.status ?? "pending"} locale={locale}/><StatusBadge value={back?.status ?? "pending"} locale={locale}/></span></div><div><span>{locale === "ar" ? "السجل التجاري" : "Commercial register"}</span><strong>{branch.uses_parent_commercial_register !== false ? (locale === "ar" ? "سجل المتجر الرئيسي" : "Main store register") : (locale === "ar" ? "سجل مستقل" : "Separate register")}</strong></div></div>{text(branch.rejection_reason) ? <p className="inline-error">{text(branch.rejection_reason)}</p> : null}<button className="button secondary full" type="button" onClick={() => edit(branch)}><Icon name="edit" size={17}/>{locale === "ar" ? "تعديل الفرع" : "Edit branch"}</button></article>; })}</div>}
  </PortalPanel>

  {open ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="branch" size={17}/>{form.id ? (locale === "ar" ? "تعديل فرع" : "Edit branch") : (locale === "ar" ? "فرع جديد" : "New branch")}</span><h2>{locale === "ar" ? "بيانات الفرع ومديره" : "Branch and manager details"}</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submit}><div className="form-grid two"><label>{locale === "ar" ? "اسم الفرع" : "Branch name"}<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>{locale === "ar" ? "المدينة" : "City"}<select required value={form.cityId} onChange={(event) => setForm({ ...form, cityId: event.target.value })}><option value="">{locale === "ar" ? "اختر المدينة" : "Choose city"}</option>{cities.map((city) => <option key={text(city.id)} value={text(city.id)}>{text(locale === "ar" ? city.name_ar : city.name_en)} — {text(locale === "ar" ? city.governorate_ar : city.governorate_en)}</option>)}</select></label><label>{locale === "ar" ? "خط العرض" : "Latitude"}<input required type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })}/></label><label>{locale === "ar" ? "خط الطول" : "Longitude"}<input required type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })}/></label><label>{locale === "ar" ? "اسم مدير الفرع" : "Branch manager name"}<input required={!form.id} minLength={2} value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })}/></label><label>{locale === "ar" ? "هاتف مدير الفرع" : "Branch manager phone"}<input required minLength={7} value={form.managerMobile} onChange={(event) => setForm({ ...form, managerMobile: event.target.value })}/></label></div><div className="id-upload-grid"><DocumentUpload side="front" locale={locale} path={form.managerIdFrontPath} busy={uploading === "front"} onFile={(file) => void upload("front", file)}/><DocumentUpload side="back" locale={locale} path={form.managerIdBackPath} busy={uploading === "back"} onFile={(file) => void upload("back", file)}/></div><label className="switch-row"><input type="checkbox" checked={form.usesParentCommercialRegister} onChange={(event) => setForm({ ...form, usesParentCommercialRegister: event.target.checked, commercialRegisterPath: event.target.checked ? "" : form.commercialRegisterPath })}/><span><strong>{locale === "ar" ? "استخدام السجل التجاري للمتجر الرئيسي" : "Use the main store commercial register"}</strong><small>{locale === "ar" ? "اتركه مفعلاً إذا كان الفرع تابعًا لنفس الكيان القانوني." : "Keep enabled when the branch belongs to the same legal entity."}</small></span></label>{!form.usesParentCommercialRegister ? <CommercialRegisterUpload locale={locale} path={form.commercialRegisterPath} busy={uploading === "register"} onFile={(file) => void upload("register", file)}/> : null}<div className="switch-grid"><label className="switch-row"><input type="checkbox" checked={form.deliveryEnabled} onChange={(event) => setForm({ ...form, deliveryEnabled: event.target.checked })}/><span><strong>{locale === "ar" ? "التوصيل متاح" : "Delivery enabled"}</strong></span></label><label className="switch-row"><input type="checkbox" checked={form.craftsmanAvailable} onChange={(event) => setForm({ ...form, craftsmanAvailable: event.target.checked })}/><span><strong>{locale === "ar" ? "فني متاح" : "Craftsman available"}</strong></span></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="submit" disabled={saving || Boolean(uploading)}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الفرع" : "Save branch")}</button></div></form></section></div> : null}
  </div>;
}

function DocumentUpload({ side, locale, path, busy, onFile }: { side: "front" | "back"; locale: "ar" | "en"; path: string; busy: boolean; onFile: (file: File) => void }) {
  return <label className={`document-upload ${path ? "complete" : ""}`}><span><Icon name={path ? "check" : "card"} size={27}/></span><strong>{side === "front" ? (locale === "ar" ? "وجه بطاقة المدير" : "Manager ID front") : (locale === "ar" ? "ظهر بطاقة المدير" : "Manager ID back")}</strong><p>{path ? (locale === "ar" ? "تم الرفع ويمكن إعادة الاختيار." : "Uploaded. You can choose again.") : (locale === "ar" ? "صورة أو PDF بحد أقصى 10 ميجابايت." : "Image or PDF up to 10 MB.")}</p><em>{busy ? (locale === "ar" ? "جارٍ الرفع" : "Uploading") : (locale === "ar" ? "اختيار ملف" : "Choose file")}</em><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }}/></label>;
}


function CommercialRegisterUpload({ locale, path, busy, onFile }: { locale: "ar" | "en"; path: string; busy: boolean; onFile: (file: File) => void }) {
  return <label className={`document-upload ${path ? "complete" : ""}`}><span><Icon name={path ? "check" : "receipt"} size={27}/></span><strong>{locale === "ar" ? "السجل التجاري المستقل للفرع" : "Separate branch commercial register"}</strong><p>{path ? (locale === "ar" ? "تم الرفع ويمكن إعادة الاختيار." : "Uploaded. You can choose again.") : (locale === "ar" ? "ارفعه فقط إذا كان الفرع كيانًا قانونيًا مستقلاً." : "Upload only when the branch is a separate legal entity.")}</p><em>{busy ? (locale === "ar" ? "جارٍ الرفع" : "Uploading") : (locale === "ar" ? "اختيار ملف" : "Choose file")}</em><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }}/></label>;
}
