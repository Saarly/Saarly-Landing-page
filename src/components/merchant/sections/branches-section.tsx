"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { CoordinateMapPicker } from "@/components/portal-v2/coordinate-map-picker";
import { bool, money, numberValue, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type DeliveryChoice = "inherit" | "enabled" | "disabled";
type UploadKind = "front" | "managerFront" | "managerBack" | "register" | "";
type BranchForm = {
  id: string;
  name: string;
  cityId: string;
  latitude: string;
  longitude: string;
  managerName: string;
  managerMobile: string;
  frontImageUrl: string;
  frontPreviewUrl: string;
  deliveryChoice: DeliveryChoice;
  deliveryPricingMethod: string;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinimum: string;
  craftsmanAvailable: boolean;
  managerIdFrontPath: string;
  managerIdFrontPreviewUrl: string;
  managerIdBackPath: string;
  managerIdBackPreviewUrl: string;
  usesParentCommercialRegister: boolean;
  commercialRegisterPath: string;
  commercialRegisterPreviewUrl: string;
};

const empty: BranchForm = {
  id: "", name: "", cityId: "", latitude: "30.0444", longitude: "31.2357",
  managerName: "", managerMobile: "", frontImageUrl: "", frontPreviewUrl: "",
  deliveryChoice: "inherit", deliveryPricingMethod: "flat", freeDeliveryEnabled: false, freeDeliveryMinimum: "",
  craftsmanAvailable: false,
  managerIdFrontPath: "", managerIdFrontPreviewUrl: "", managerIdBackPath: "", managerIdBackPreviewUrl: "", usesParentCommercialRegister: true,
  commercialRegisterPath: "", commercialRegisterPreviewUrl: "",
};

function normalizePlace(input: unknown) {
  return String(input ?? "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
}


export function BranchesSection({ payload, locale, refresh, notify }: SectionProps) {
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  const branches = rows(payload.data.branches);
  const cities = rows(payload.data.cities);
  const documents = rows(payload.data.documents);
  const products = rows(payload.data.products);
  const availability = rows(payload.data.availability);
  const branchSales = rows(payload.data.branchSales);
  const unassignedSales = payload.data.unassignedSales && typeof payload.data.unassignedSales === "object" ? payload.data.unassignedSales as PortalRow : null;
  const isOwner = payload.account.isOwner;
  const [form, setForm] = useState<BranchForm>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<UploadKind>("");
  const [availabilityBranch, setAvailabilityBranch] = useState<PortalRow | null>(null);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingBranchService, setSavingBranchService] = useState("");
  const [freeDeliveryBranch, setFreeDeliveryBranch] = useState<PortalRow | null>(null);
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState(false);
  const [freeDeliveryMinimum, setFreeDeliveryMinimum] = useState("");

  const docMap = useMemo(() => {
    const map = new Map<string, PortalRow[]>();
    documents.forEach((document) => {
      const key = text(document.branch_id);
      map.set(key, [...(map.get(key) ?? []), document]);
    });
    return map;
  }, [documents]);

  const salesMap = useMemo(() => new Map(branchSales.map((item) => [text(item.branch_id), item])), [branchSales]);

  function unavailableCount(branchId: string) {
    return availability.filter((entry) => text(entry.branch_id) === branchId && entry.is_available === false).length;
  }

  function edit(branch?: PortalRow) {
    if (!isOwner) return;
    if (!branch) setForm(empty);
    else {
      const branchDocs = docMap.get(text(branch.id)) ?? [];
      const managerFrontDoc = branchDocs.find((doc) => text(doc.kind) === "branch_manager_id_front");
      const managerBackDoc = branchDocs.find((doc) => text(doc.kind) === "branch_manager_id_back");
      const commercialRegisterDoc = branchDocs.find((doc) => text(doc.kind) === "commercial_register");
      const managerDoc = managerFrontDoc ?? managerBackDoc;
      const deliveryChoice: DeliveryChoice = branch.delivery_enabled === null || branch.delivery_enabled === undefined
        ? "inherit" : bool(branch.delivery_enabled) ? "enabled" : "disabled";
      setForm({
        id: text(branch.id), name: text(branch.name), cityId: text(branch.city_id),
        latitude: text(branch.latitude), longitude: text(branch.longitude),
        managerName: text(managerDoc?.manager_name), managerMobile: text(branch.manager_mobile),
        frontImageUrl: text(branch.front_image_url), frontPreviewUrl: text(branch.front_signed_url),
        deliveryChoice, deliveryPricingMethod: text(branch.delivery_pricing_method, "flat"),
        freeDeliveryEnabled: bool(branch.free_delivery_enabled),
        freeDeliveryMinimum: branch.free_delivery_minimum == null ? "" : text(branch.free_delivery_minimum),
        craftsmanAvailable: bool(branch.craftsman_available),
        managerIdFrontPath: text(managerFrontDoc?.storage_path), managerIdFrontPreviewUrl: text(managerFrontDoc?.preview_signed_url),
        managerIdBackPath: text(managerBackDoc?.storage_path), managerIdBackPreviewUrl: text(managerBackDoc?.preview_signed_url),
        usesParentCommercialRegister: branch.uses_parent_commercial_register !== false,
        commercialRegisterPath: text(commercialRegisterDoc?.storage_path), commercialRegisterPreviewUrl: text(commercialRegisterDoc?.preview_signed_url),
      });
    }
    setOpen(true);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      notify(locale === "ar" ? "الجهاز لا يدعم تحديد الموقع." : "Location is not supported on this device.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })),
      () => notify(locale === "ar" ? "تعذر قراءة الموقع. اسمح للموقع باستخدامه وحاول تاني." : "Could not read your location. Allow location access and try again.", "error"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function updateMapLocation(latitude: string, longitude: string, resolved?: { city?: string; governorate?: string; country?: string }) {
    setForm((current) => {
      let cityId = current.cityId;
      if (resolved) {
        const city = normalizePlace(resolved.city);
        const governorate = normalizePlace(resolved.governorate);
        const country = normalizePlace(resolved.country);
        const matched = cities.find((item) => {
          const cityNames = [item.name_ar, item.name_en].map(normalizePlace);
          const govNames = [item.governorate_ar, item.governorate_en].map(normalizePlace);
          const countryNames = [item.country_ar, item.country_en].map(normalizePlace);
          const cityMatch = !city || cityNames.some((name) => name && (name === city || name.includes(city) || city.includes(name)));
          const govMatch = !governorate || govNames.some((name) => name && (name === governorate || name.includes(governorate) || governorate.includes(name)));
          const countryMatch = !country || countryNames.some((name) => name && (name === country || name.includes(country) || country.includes(name)));
          return cityMatch && govMatch && countryMatch;
        });
        if (matched) cityId = text(matched.id);
      }
      return { ...current, latitude, longitude, cityId };
    });
  }

  async function upload(kind: Exclude<UploadKind, "">, file: File) {
    setUploading(kind);
    try {
      const uploadKind = kind === "front" ? "branch-front" : kind === "managerFront" ? "branch-manager-front" : kind === "managerBack" ? "branch-manager-back" : "branch-commercial-register";
      const result = await portalUpload(uploadKind, file);
      setForm((current) => ({
        ...current,
        ...(kind === "front" ? { frontImageUrl: result.path, frontPreviewUrl: result.url || URL.createObjectURL(file) } : {}),
        ...(kind === "managerFront" ? { managerIdFrontPath: result.path, managerIdFrontPreviewUrl: result.url || URL.createObjectURL(file) } : {}),
        ...(kind === "managerBack" ? { managerIdBackPath: result.path, managerIdBackPreviewUrl: result.url || URL.createObjectURL(file) } : {}),
        ...(kind === "register" ? { commercialRegisterPath: result.path, commercialRegisterPreviewUrl: result.url || URL.createObjectURL(file) } : {}),
      }));
      notify(locale === "ar" ? "تم رفع الملف بنجاح." : "File uploaded successfully.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "upload_failed", "error"); }
    finally { setUploading(""); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isOwner) return;
    if (!form.frontImageUrl) {
      notify(locale === "ar" ? "أضف صورة واجهة الفرع قبل الإرسال للمراجعة." : "Add the branch storefront image before submitting for review.", "error"); return;
    }
    if (!form.id && (!form.managerIdFrontPath || !form.managerIdBackPath)) {
      notify(locale === "ar" ? "ارفع وجه وظهر بطاقة مدير الفرع." : "Upload both sides of the branch manager ID.", "error"); return;
    }
    if ((form.managerIdFrontPath && !form.managerIdBackPath) || (!form.managerIdFrontPath && form.managerIdBackPath)) {
      notify(locale === "ar" ? "يجب رفع الوجه والظهر معًا." : "Both ID sides must be uploaded together.", "error"); return;
    }
    if (!form.usesParentCommercialRegister && !form.id && !form.commercialRegisterPath) {
      notify(locale === "ar" ? "ارفع السجل التجاري المستقل أو استخدم سجل المتجر الرئيسي." : "Upload a separate commercial register or use the main store register.", "error"); return;
    }
    if (form.freeDeliveryEnabled && Number(form.freeDeliveryMinimum) <= 0) {
      notify(locale === "ar" ? "اكتب حدًا أدنى أكبر من صفر للتوصيل المجاني." : "Enter a minimum greater than zero for free delivery.", "error"); return;
    }
    setSaving(true);
    try {
      await portalPost("save_branch", {
        ...form,
        latitude: Number(form.latitude), longitude: Number(form.longitude),
        deliveryEnabled: form.deliveryChoice === "inherit" ? null : form.deliveryChoice === "enabled",
      });
      notify(locale === "ar" ? "تم حفظ الفرع وإرساله للمراجعة." : "Branch saved and submitted for review.", "success");
      setOpen(false); setForm(empty); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "save_failed", "error"); }
    finally { setSaving(false); }
  }

  function openAvailability(branch: PortalRow) {
    const branchId = text(branch.id);
    setUnavailableIds(new Set(availability
      .filter((entry) => text(entry.branch_id) === branchId && entry.is_available === false)
      .map((entry) => text(entry.product_id))
      .filter(Boolean)));
    setAvailabilityBranch(branch);
  }

  function toggleAvailability(productId: string, available: boolean) {
    setUnavailableIds((current) => {
      const next = new Set(current);
      if (available) next.delete(productId); else next.add(productId);
      return next;
    });
  }

  async function saveAvailability() {
    const branchId = text(availabilityBranch?.id);
    if (!branchId || products.length === 0) return;
    setSavingAvailability(true);
    try {
      await portalPost("save_branch_availability", { branchId, unavailableProductIds: [...unavailableIds] });
      notify(locale === "ar" ? "تم حفظ توفر المنتجات في الفرع." : "Branch product availability saved.", "success");
      setAvailabilityBranch(null);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "availability_save_failed", "error"); }
    finally { setSavingAvailability(false); }
  }

  async function setCraftsman(branch: PortalRow, available: boolean) {
    const branchId = text(branch.id);
    if (!branchId) return;
    setSavingBranchService(`craftsman:${branchId}`);
    try {
      await portalPost("set_branch_craftsman", { branchId, available });
      notify(available
        ? (locale === "ar" ? "تم تفعيل توفر الفني في الفرع." : "Craftsperson availability enabled for this branch.")
        : (locale === "ar" ? "تم إيقاف توفر الفني في الفرع." : "Craftsperson availability disabled for this branch."), "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "branch_craftsman_save_failed", "error"); }
    finally { setSavingBranchService(""); }
  }

  function openFreeDelivery(branch: PortalRow) {
    setFreeDeliveryBranch(branch);
    setFreeDeliveryEnabled(bool(branch.free_delivery_enabled));
    setFreeDeliveryMinimum(branch.free_delivery_minimum == null ? "" : text(branch.free_delivery_minimum));
  }

  async function saveFreeDelivery() {
    const branchId = text(freeDeliveryBranch?.id);
    if (!branchId) return;
    if (freeDeliveryEnabled && numberValue(freeDeliveryMinimum) <= 0) {
      notify(locale === "ar" ? "اكتب حدًا أدنى أكبر من صفر للتوصيل المجاني." : "Enter a minimum greater than zero for free delivery.", "error");
      return;
    }
    setSavingBranchService(`delivery:${branchId}`);
    try {
      await portalPost("set_branch_free_delivery", { branchId, enabled: freeDeliveryEnabled, minimum: freeDeliveryEnabled ? Number(freeDeliveryMinimum) : null });
      notify(locale === "ar" ? "تم حفظ إعداد التوصيل المجاني للفرع." : "Branch free-delivery settings saved.", "success");
      setFreeDeliveryBranch(null);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "branch_free_delivery_save_failed", "error"); }
    finally { setSavingBranchService(""); }
  }

  async function remove(branch: PortalRow) {
    if (!isOwner) return;
    const branchId = text(branch.id);
    const branchName = text(branch.name, locale === "ar" ? "هذا الفرع" : "this branch");
    if (!branchId || !(await confirm({ title: locale === "ar" ? `حذف ${branchName}` : `Delete ${branchName}`, body: locale === "ar" ? "سيتم حذف الفرع من المتجر. تأكد إنك مش محتاج بياناته قبل المتابعة." : "This branch will be removed from the store. Make sure you no longer need it before continuing.", confirmLabel: locale === "ar" ? "حذف الفرع" : "Delete branch", tone: "danger" }))) return;
    setSaving(true);
    try {
      await portalPost("delete_branch", { id: branchId });
      notify(locale === "ar" ? "تم حذف الفرع." : "Branch deleted.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "branch_delete_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack">
    <Notice tone={isOwner ? "info" : "warning"}>{isOwner
      ? (locale === "ar" ? "أي تعديل جوهري على الفرع بيرجعه للمراجعة. المستندات خاصة ومش بتظهر للعملاء." : "Material branch changes return it to review. Private documents are never shown to buyers.")
      : (locale === "ar" ? "أنت شايف الفروع المسموح بيها فقط. إضافة أو تعديل الفروع متاح لصاحب المتجر." : "You only see assigned branches. Adding or editing branches is owner-only.")}</Notice>
    <PortalPanel title={locale === "ar" ? "فروع المتجر" : "Store branches"} subtitle={locale === "ar" ? "الموقع والمستندات ومدير الفرع وخدماته." : "Location, documents, manager, and services."} action={isOwner ? <button className="button primary compact" type="button" onClick={() => edit()}><Icon name="plus" size={18}/>{locale === "ar" ? "إضافة فرع" : "Add branch"}</button> : undefined}>
      {branches.length === 0 ? <EmptyState icon="branch" title={locale === "ar" ? "لا توجد فروع" : "No branches"} body={locale === "ar" ? "أضف الفرع الأول مع مستندات مديره." : "Add the first branch with its manager documents."} action={isOwner ? <button className="button primary compact" type="button" onClick={() => edit()}>{locale === "ar" ? "إضافة فرع" : "Add branch"}</button> : undefined}/> : <div className="branch-grid">{branches.map((branch) => {
        const branchDocs = docMap.get(text(branch.id)) ?? [];
        const front = branchDocs.find((doc) => text(doc.kind) === "branch_manager_id_front");
        const back = branchDocs.find((doc) => text(doc.kind) === "branch_manager_id_back");
        const photo = text(branch.front_signed_url);
        const branchId = text(branch.id);
        const sales = salesMap.get(branchId);
        const unavailable = unavailableCount(branchId);
        return <article className="branch-card" key={branchId} data-record-id={branchId}>
          {photo ? <img className="branch-cover" src={photo} alt={text(branch.name)}/> : null}
          <header><span className="branch-icon"><Icon name="branch"/></span><div><h3>{text(branch.name)}</h3><p>{text(branch.governorate_name)} · {text(branch.city_name)}</p></div><StatusBadge value={branch.approval_status} locale={locale}/></header>
          <div className="detail-list compact"><div><span>{locale === "ar" ? "هاتف المدير" : "Manager phone"}</span><strong>{text(branch.manager_mobile, "—")}</strong></div><div><span>{locale === "ar" ? "التوصيل" : "Delivery"}</span><strong>{branch.delivery_enabled == null ? (locale === "ar" ? "يتبع إعداد المتجر" : "Uses store setting") : bool(branch.delivery_enabled) ? (locale === "ar" ? "مفعّل" : "Enabled") : (locale === "ar" ? "غير مفعّل" : "Disabled")}</strong></div><div><span>{locale === "ar" ? "منتجات غير متاحة" : "Unavailable products"}</span><strong>{unavailable === 0 ? (locale === "ar" ? "كل المنتجات متاحة" : "All products available") : unavailable}</strong></div><div><span>{locale === "ar" ? "إجمالي مبيعات الفرع" : "Branch sales"}</span><strong>{sales ? money(sales.total_sales, payload.account.currencyCode || "EGP", locale) : (locale === "ar" ? "لا توجد مبيعات بعد" : "No sales yet")}</strong></div><div><span>{locale === "ar" ? "الطلبات المؤكدة" : "Confirmed orders"}</span><strong>{numberValue(sales?.confirmed_orders_count)}</strong></div><div><span>{locale === "ar" ? "مستندات المدير" : "Manager documents"}</span><span className="document-statuses"><StatusBadge value={front?.status ?? "pending"} locale={locale}/><StatusBadge value={back?.status ?? "pending"} locale={locale}/></span></div><div><span>{locale === "ar" ? "السجل التجاري" : "Commercial register"}</span><strong>{branch.uses_parent_commercial_register !== false ? (locale === "ar" ? "سجل المتجر الرئيسي" : "Main store register") : (locale === "ar" ? "سجل مستقل" : "Separate register")}</strong></div></div>
          {bool(branch.free_delivery_enabled) ? <p className="muted-copy">{locale === "ar" ? `توصيل مجاني من ${money(branch.free_delivery_minimum, payload.account.currencyCode || "EGP", locale)}` : `Free delivery from ${money(branch.free_delivery_minimum, payload.account.currencyCode || "EGP", locale)}`}</p> : null}
          {text(branch.rejection_reason) ? <p className="inline-error">{text(branch.rejection_reason)}</p> : null}
          {isOwner && branchDocs.some((doc) => text(doc.rejection_reason)) ? <p className="inline-error">{locale === "ar" ? `سبب رفض المستندات: ${text(branchDocs.find((doc) => text(doc.rejection_reason))?.rejection_reason)}` : `Document rejection reason: ${text(branchDocs.find((doc) => text(doc.rejection_reason))?.rejection_reason)}`}</p> : null}
          {isOwner && branchDocs.some((doc) => text(doc.preview_signed_url)) ? <div className="branch-document-preview-actions">{branchDocs.filter((doc) => text(doc.preview_signed_url)).map((doc) => <a className="button text-button compact" key={text(doc.id)} href={text(doc.preview_signed_url)} target="_blank" rel="noreferrer"><Icon name="eye" size={16}/>{text(doc.kind) === "branch_manager_id_front" ? (locale === "ar" ? "معاينة وجه بطاقة المدير" : "Preview manager ID front") : text(doc.kind) === "branch_manager_id_back" ? (locale === "ar" ? "معاينة ظهر بطاقة المدير" : "Preview manager ID back") : text(doc.kind) === "commercial_register" ? (locale === "ar" ? "معاينة السجل التجاري" : "Preview commercial register") : (locale === "ar" ? "معاينة المستند" : "Preview document")}</a>)}</div> : null}
          <label className="switch-row"><input type="checkbox" checked={bool(branch.craftsman_available)} disabled={savingBranchService === `craftsman:${branchId}`} onChange={(event) => void setCraftsman(branch, event.target.checked)}/><span><strong>{locale === "ar" ? "صنايعي متاح في هذا الفرع" : "Craftsperson available in this branch"}</strong><small>{bool(branch.craftsman_available) ? (locale === "ar" ? "مفعّل لهذا الفرع" : "Enabled for this branch") : (locale === "ar" ? "غير مفعّل لهذا الفرع" : "Disabled for this branch")}</small></span></label>
          <a className="button text-button full" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${encodeURIComponent(`${text(branch.latitude)},${text(branch.longitude)}`)}`}><Icon name="location" size={17}/>{locale === "ar" ? "فتح الموقع على الخريطة" : "Open on map"}</a>
          <button className="button secondary full" type="button" onClick={() => openAvailability(branch)}><Icon name="box" size={17}/>{locale === "ar" ? "إدارة توفر المنتجات" : "Manage product availability"}</button>
          {isOwner ? <><button className="button secondary full" type="button" disabled={Boolean(savingBranchService)} onClick={() => openFreeDelivery(branch)}><Icon name="truck" size={17}/>{locale === "ar" ? "إعداد التوصيل المجاني لهذا الفرع" : "Free delivery settings for this branch"}</button><div className="branch-card-actions"><button className="button secondary full" type="button" disabled={saving} onClick={() => edit(branch)}><Icon name="edit" size={17}/>{locale === "ar" ? "تعديل الفرع" : "Edit branch"}</button><button className="button danger-button full" type="button" disabled={saving} onClick={() => void remove(branch)}><Icon name="trash" size={17}/>{locale === "ar" ? "حذف الفرع" : "Delete branch"}</button></div></> : null}
        </article>;
      })}</div>}
    </PortalPanel>

    {unassignedSales ? <PortalPanel title={locale === "ar" ? "مبيعات بدون فرع محدد" : "Unassigned branch sales"} subtitle={locale === "ar" ? "طلبات تاريخية لم يتم ربطها بفرع محدد." : "Historical orders that were not assigned to a branch."}><div className="detail-list compact"><div><span>{locale === "ar" ? "إجمالي المبيعات" : "Total sales"}</span><strong>{money(unassignedSales.total_sales, payload.account.currencyCode || "EGP", locale)}</strong></div><div><span>{locale === "ar" ? "الطلبات المؤكدة" : "Confirmed orders"}</span><strong>{numberValue(unassignedSales.confirmed_orders_count)}</strong></div></div></PortalPanel> : null}

    {freeDeliveryBranch && isOwner ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="branch-free-delivery-title"><header><div><span className="eyebrow"><Icon name="truck" size={17}/>{locale === "ar" ? "التوصيل المجاني" : "Free delivery"}</span><h2 id="branch-free-delivery-title">{locale === "ar" ? `إعدادات ${text(freeDeliveryBranch.name)}` : `${text(freeDeliveryBranch.name)} settings`}</h2></div><button className="icon-button" data-modal-close type="button" onClick={() => setFreeDeliveryBranch(null)} aria-label={locale === "ar" ? "إغلاق" : "Close"}><Icon name="close"/></button></header><div className="portal-form"><label className="switch-row"><input type="checkbox" checked={freeDeliveryEnabled} disabled={Boolean(savingBranchService)} onChange={(event) => setFreeDeliveryEnabled(event.target.checked)}/><span><strong>{locale === "ar" ? "تفعيل التوصيل المجاني لهذا الفرع" : "Enable free delivery for this branch"}</strong><small>{locale === "ar" ? "يتم تطبيقه على طلبات هذا الفرع فقط." : "Applies only to orders fulfilled by this branch."}</small></span></label>{freeDeliveryEnabled ? <label>{locale === "ar" ? "الحد الأدنى لإجمالي المنتجات" : "Products subtotal minimum"}<input type="number" min="0.01" step="0.01" value={freeDeliveryMinimum} disabled={Boolean(savingBranchService)} onChange={(event) => setFreeDeliveryMinimum(event.target.value)}/></label> : null}<div className="modal-actions"><button className="button secondary" type="button" disabled={Boolean(savingBranchService)} onClick={() => setFreeDeliveryBranch(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="button" disabled={Boolean(savingBranchService)} onClick={() => void saveFreeDelivery()}>{savingBranchService ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الإعداد" : "Save setting")}</button></div></div></section></div> : null}

    {availabilityBranch ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="branch-availability-title"><header><div><span className="eyebrow"><Icon name="box" size={17}/>{locale === "ar" ? "توفر المنتجات" : "Product availability"}</span><h2 id="branch-availability-title">{locale === "ar" ? `منتجات ${text(availabilityBranch.name)}` : `${text(availabilityBranch.name)} products`}</h2></div><button className="icon-button" data-modal-close type="button" onClick={() => setAvailabilityBranch(null)} aria-label={locale === "ar" ? "إغلاق" : "Close"}><Icon name="close"/></button></header>
      {products.length === 0 ? <EmptyState icon="box" title={locale === "ar" ? "أضف منتجات أولًا" : "Add products first"} body={locale === "ar" ? "لا توجد منتجات لإدارة توفرها في هذا الفرع." : "There are no products to manage for this branch."}/> : <div className="branch-product-availability-list">{products.map((product) => { const productId = text(product.id); const available = !unavailableIds.has(productId); return <label className="switch-row" key={productId}><input type="checkbox" checked={available} disabled={savingAvailability} onChange={(event) => toggleAvailability(productId, event.target.checked)}/><span><strong>{text(product.free_name)}</strong><small>{available ? (locale === "ar" ? "متاح في هذا الفرع" : "Available in this branch") : (locale === "ar" ? "غير متاح في هذا الفرع" : "Unavailable in this branch")}{` · ${text(product.quantity, "0")} ${text(product.unit)}`}</small></span></label>; })}</div>}
      <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setAvailabilityBranch(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="button" disabled={products.length === 0 || savingAvailability} onClick={() => void saveAvailability()}>{savingAvailability ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ التوفر" : "Save availability")}</button></div>
    </section></div> : null}

    {open && isOwner ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="branch" size={17}/>{form.id ? (locale === "ar" ? "تعديل فرع" : "Edit branch") : (locale === "ar" ? "فرع جديد" : "New branch")}</span><h2>{locale === "ar" ? "بيانات الفرع ومديره" : "Branch and manager details"}</h2></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setOpen(false)}><Icon name="close"/></button></header>
      <form className="portal-form" onSubmit={submit}>
        <div className="form-grid two"><label>{locale === "ar" ? "اسم الفرع" : "Branch name"}<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>{locale === "ar" ? "المدينة" : "City"}<select required value={form.cityId} onChange={(event) => setForm({ ...form, cityId: event.target.value })}><option value="">{locale === "ar" ? "اختر المدينة" : "Choose city"}</option>{cities.map((city) => <option key={text(city.id)} value={text(city.id)}>{text(locale === "ar" ? city.country_ar : city.country_en)} — {text(locale === "ar" ? city.governorate_ar : city.governorate_en)} — {text(locale === "ar" ? city.name_ar : city.name_en)}</option>)}</select></label><label>{locale === "ar" ? "اسم مدير الفرع" : "Branch manager name"}<input required minLength={2} value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })}/></label><label>{locale === "ar" ? "هاتف مدير الفرع" : "Branch manager phone"}<input required minLength={7} value={form.managerMobile} onChange={(event) => setForm({ ...form, managerMobile: event.target.value })}/></label></div>
        <div className="location-picker-grid"><div className="form-grid two"><label>{locale === "ar" ? "خط العرض" : "Latitude"}<input required type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })}/></label><label>{locale === "ar" ? "خط الطول" : "Longitude"}<input required type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })}/></label><button className="button secondary" type="button" onClick={useCurrentLocation}><Icon name="target"/>{locale === "ar" ? "استخدام موقعي الحالي" : "Use current location"}</button></div><CoordinateMapPicker latitude={form.latitude} longitude={form.longitude} locale={locale} onChange={updateMapLocation}/></div>
        <div className="branch-service-grid"><label>{locale === "ar" ? "إعداد التوصيل" : "Delivery setting"}<select value={form.deliveryChoice} onChange={(event) => setForm({ ...form, deliveryChoice: event.target.value as DeliveryChoice })}><option value="inherit">{locale === "ar" ? "يتبع إعداد المتجر" : "Inherit store setting"}</option><option value="enabled">{locale === "ar" ? "مفعّل في الفرع" : "Enabled for branch"}</option><option value="disabled">{locale === "ar" ? "متوقف في الفرع" : "Disabled for branch"}</option></select></label><label>{locale === "ar" ? "طريقة التسعير" : "Pricing method"}<select disabled={form.deliveryChoice !== "enabled"} value={form.deliveryPricingMethod} onChange={(event) => setForm({ ...form, deliveryPricingMethod: event.target.value })}><option value="flat">{locale === "ar" ? "سعر ثابت" : "Flat"}</option><option value="zone">{locale === "ar" ? "حسب المنطقة" : "By zone"}</option><option value="weight">{locale === "ar" ? "حسب الوزن" : "By weight"}</option></select></label><label className="switch-row"><input type="checkbox" checked={form.craftsmanAvailable} onChange={(event) => setForm({ ...form, craftsmanAvailable: event.target.checked })}/><span><strong>{locale === "ar" ? "فني متاح من الفرع" : "Craftsman available"}</strong></span></label></div>
        <div className="branch-service-grid"><label className="switch-row"><input type="checkbox" checked={form.freeDeliveryEnabled} onChange={(event) => setForm({ ...form, freeDeliveryEnabled: event.target.checked })}/><span><strong>{locale === "ar" ? "توصيل مجاني عند حد أدنى" : "Free delivery above a minimum"}</strong><small>{locale === "ar" ? "ينطبق على طلبات هذا الفرع فقط." : "Applies only to this branch orders."}</small></span></label>{form.freeDeliveryEnabled ? <label>{locale === "ar" ? "الحد الأدنى لإجمالي المنتجات" : "Products subtotal minimum"}<input type="number" min="0.01" step="0.01" value={form.freeDeliveryMinimum} onChange={(event) => setForm({ ...form, freeDeliveryMinimum: event.target.value })}/></label> : null}</div>
        <div className="branch-upload-grid"><FileUpload title={locale === "ar" ? "صورة واجهة الفرع" : "Branch storefront photo"} accept="image/jpeg,image/png,image/webp" uploaded={Boolean(form.frontImageUrl)} busy={uploading === "front"} preview={form.frontPreviewUrl} locale={locale} onFile={(file) => void upload("front", file)}/><FileUpload title={locale === "ar" ? "وجه بطاقة المدير" : "Manager ID front"} accept="image/jpeg,image/png,image/webp" uploaded={Boolean(form.managerIdFrontPath)} busy={uploading === "managerFront"} preview={form.managerIdFrontPreviewUrl} locale={locale} onFile={(file) => void upload("managerFront", file)}/><FileUpload title={locale === "ar" ? "ظهر بطاقة المدير" : "Manager ID back"} accept="image/jpeg,image/png,image/webp" uploaded={Boolean(form.managerIdBackPath)} busy={uploading === "managerBack"} preview={form.managerIdBackPreviewUrl} locale={locale} onFile={(file) => void upload("managerBack", file)}/></div>
        <label className="switch-row"><input type="checkbox" checked={form.usesParentCommercialRegister} onChange={(event) => setForm({ ...form, usesParentCommercialRegister: event.target.checked })}/><span><strong>{locale === "ar" ? "استخدام السجل التجاري الرئيسي" : "Use main store commercial register"}</strong><small>{locale === "ar" ? "ألغِ الاختيار فقط لو الفرع كيان قانوني مستقل." : "Turn off only if this branch is a separate legal entity."}</small></span></label>
        {!form.usesParentCommercialRegister ? <FileUpload title={locale === "ar" ? "السجل التجاري المستقل" : "Separate commercial register"} accept="image/jpeg,image/png,application/pdf" uploaded={Boolean(form.commercialRegisterPath)} busy={uploading === "register"} previewHref={form.commercialRegisterPreviewUrl} locale={locale} onFile={(file) => void upload("register", file)}/> : null}
        <div className="form-actions"><button className="button secondary" type="button" onClick={() => setOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={saving || Boolean(uploading)}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ وإرسال للمراجعة" : "Save and submit for review")}</button></div>
      </form></section></div> : null}
    {confirmDialog}
  </div>;
}

function FileUpload({ title, accept, uploaded, busy, preview, previewHref, locale, onFile }: { title: string; accept: string; uploaded: boolean; busy: boolean; preview?: string; previewHref?: string; locale: "ar" | "en"; onFile: (file: File) => void }) {
  const hint = accept.includes("application/pdf")
    ? "JPG, PNG, PDF - up to 5 MB"
    : "JPG, PNG, WEBP - up to 5 MB";
  return <div className={`document-upload-shell ${uploaded ? "uploaded" : ""}`}><label className={`document-upload ${uploaded ? "uploaded" : ""}`}>{preview ? <img src={preview} alt=""/> : <Icon name={uploaded ? "check" : "upload"}/>}<strong>{title}</strong><small>{busy ? "..." : uploaded ? (locale === "ar" ? "تم الرفع" : "Uploaded") : hint}</small><input type="file" accept={accept} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }}/></label>{(preview || previewHref) ? <a className="document-upload-preview" href={previewHref || preview} target="_blank" rel="noreferrer"><Icon name="eye" size={15}/>{locale === "ar" ? "معاينة الملف الحالي" : "Preview current file"}</a> : null}</div>;
}
