"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { humanError, row, rows, text } from "@/components/merchant/portal-utils";
import { useSitePreferences } from "@/components/site-preferences";
import { setMerchantRememberSession, supabase, supabaseConfigured } from "@/lib/supabase";

type Data = {
  user: { id: string; email: string };
  profile: Record<string, unknown> | null;
  merchant: Record<string, unknown> | null;
  locations: Record<string, unknown>[];
  categories: Record<string, unknown>[];
};

type UploadValue = { bucket: string; path: string; mimeType: string; size: number };

type FormState = {
  fullName: string; mobile: string; recoveryEmail: string;
  storeName: string; ownerName: string; ownerMobile: string; managerName: string; managerMobile: string; contactMobile: string;
  categoryIds: string[]; pricingMode: "catalog" | "manual_quote"; cityId: string; branchName: string; latitude: string; longitude: string;
};

const emptyForm: FormState = {
  fullName: "", mobile: "", recoveryEmail: "", storeName: "", ownerName: "", ownerMobile: "", managerName: "", managerMobile: "", contactMobile: "",
  categoryIds: [], pricingMode: "catalog", cityId: "", branchName: "", latitude: "", longitude: "",
};

async function token() {
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("authentication_required");
  return data.session.access_token;
}

async function api(path: string, options: RequestInit = {}) {
  const accessToken = await token();
  const response = await fetch(path, { ...options, headers: { ...(options.headers ?? {}), Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload.error ?? "registration_request_failed"));
  return payload.data;
}

function registrationMapUrl(latitude: string, longitude: string) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const delta = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-delta}%2C${lat-delta}%2C${lng+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function RegistrationShell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  return <main className="auth-page registration-page"><div className="auth-top"><Brand locale={locale}/><div><button className="icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Icon name="globe"/><span>{locale === "ar" ? "EN" : "ع"}</span></button><button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"}/></button></div></div>{children}</main>;
}

export function MerchantRegistrationForm() {
  const { locale } = useSitePreferences();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authStep, setAuthStep] = useState<"email" | "code" | "ready">("email");
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploads, setUploads] = useState<Record<string, UploadValue | null>>({ ownerFront: null, ownerBack: null, storefront: null, commercial: null });
  const [uploading, setUploading] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"notice" | "error" | "success">("notice");
  const profile = row(data?.profile);
  const merchant = row(data?.merchant);
  const merchantStatus = text(merchant.approval_status);

  const show = useCallback((value: string, nextTone: typeof tone = "notice") => { setMessage(value); setTone(nextTone); }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const loaded = await api("/api/merchant/registration") as Data;
      setData(loaded);
      const m = row(loaded.merchant); const p = row(loaded.profile); const branch = rows(m.branches)[0] ?? {};
      const selectedCategories = rows(m.merchant_categories).map((item) => text(item.category_id)).filter(Boolean);
      const docs = rows(m.merchant_documents);
      const docPath = (kind: string) => { const d = docs.find((item) => text(item.kind) === kind); return d ? { bucket: text(d.storage_bucket), path: text(d.storage_path), mimeType: "", size: 0 } : null; };
      setForm({
        fullName: text(p.full_name), mobile: text(p.mobile), recoveryEmail: text(p.recovery_email),
        storeName: text(m.store_name), ownerName: text(m.owner_name), ownerMobile: text(m.owner_mobile), managerName: text(m.manager_name), managerMobile: text(m.manager_mobile), contactMobile: text(m.contact_mobile),
        categoryIds: selectedCategories.length ? selectedCategories : [text(m.primary_category_id)].filter(Boolean), pricingMode: text(m.pricing_mode) === "manual_quote" ? "manual_quote" : "catalog",
        cityId: text(branch.city_id), branchName: text(branch.name), latitude: text(branch.latitude), longitude: text(branch.longitude),
      });
      setUploads({
        ownerFront: docPath("store_owner_id_front") ?? (text(m.owner_id_image_url) ? { bucket: "merchant-ids", path: text(m.owner_id_image_url), mimeType: "", size: 0 } : null),
        ownerBack: docPath("store_owner_id_back"),
        storefront: docPath("store_front") ?? (text(m.store_front_image_url) ? { bucket: "storefront-photos", path: text(m.store_front_image_url), mimeType: "", size: 0 } : null),
        commercial: docPath("commercial_register") ?? (text(m.commercial_register_url) ? { bucket: "commercial-registers", path: text(m.commercial_register_url), mimeType: "", size: 0 } : null),
      });
      setAuthStep("ready");
      if (p.role === "buyer") show(locale === "ar" ? "البريد ده مسجل كمشتري. حفاظًا على بياناتك استخدم بريد مختلف لإنشاء حساب متجر." : "This email is registered as a buyer. Use a different email for a merchant account.", "error");
    } catch (error) {
      const code = error instanceof Error ? error.message : "registration_load_failed";
      if (code === "authentication_required" || code === "invalid_session") setAuthStep("email");
      else show(humanError(code, locale), "error");
    } finally { setBusy(false); }
  }, [locale, show]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: session }) => { if (session.session) void load(); });
  }, [load]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!supabaseConfigured || !supabase) return show(locale === "ar" ? "إعداد الاتصال غير مكتمل." : "Connection is not configured.", "error");
    if (!email.trim()) return;
    setBusy(true); show("");
    try {
      await supabase.auth.signOut({ scope: "local" });
      setMerchantRememberSession(true);
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, data: { preferred_language: locale } } });
      if (error) throw error;
      setAuthStep("code");
      show(locale === "ar" ? "أرسلنا رمز مكوّن من 6 أرقام إلى بريدك." : "We sent a 6-digit code to your email.", "success");
    } catch { show(locale === "ar" ? "تعذر إرسال الرمز. راجع البريد وحاول مرة أخرى." : "Could not send the code. Check the email and try again.", "error"); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); show("");
    try {
      const { data: result, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: "email" });
      if (error || !result.session) throw error ?? new Error("invalid_session");
      await supabase.auth.updateUser({ data: { preferred_language: locale } });
      await load();
    } catch { show(locale === "ar" ? "الرمز غير صحيح أو انتهت صلاحيته." : "The code is invalid or expired.", "error"); setBusy(false); }
  }

  async function saveProfile() {
    setBusy(true); show("");
    try {
      await api("/api/merchant/registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete_profile", fullName: form.fullName, mobile: form.mobile, recoveryEmail: form.recoveryEmail, email: data?.user.email, locale, role: "merchant" }) });
      show(locale === "ar" ? "تم حفظ بيانات الحساب. كمل بيانات المتجر." : "Account details saved. Continue with store details.", "success");
      await load();
    } catch (error) { show(humanError(error, locale), "error"); }
    finally { setBusy(false); }
  }

  async function upload(key: keyof typeof uploads, kind: string, file: File) {
    setUploading(key); show("");
    try {
      const accessToken = await token();
      const body = new FormData(); body.set("kind", kind); body.set("file", file);
      const response = await fetch("/api/merchant/registration-upload", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body });
      const payload = await response.json(); if (!response.ok) throw new Error(String(payload.error ?? "upload_failed"));
      setUploads((current) => ({ ...current, [key]: payload.data }));
      show(locale === "ar" ? "تم رفع الملف بنجاح." : "File uploaded successfully.", "success");
    } catch (error) { show(humanError(error, locale), "error"); }
    finally { setUploading(""); }
  }

  function useLocation() {
    if (!navigator.geolocation) return show(locale === "ar" ? "المتصفح لا يدعم تحديد الموقع." : "Location is not supported by this browser.", "error");
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((current) => ({ ...current, latitude: position.coords.latitude.toFixed(7), longitude: position.coords.longitude.toFixed(7) })),
      () => show(locale === "ar" ? "تعذر قراءة موقعك. اسمح للموقع باستخدام GPS أو اكتب الإحداثيات." : "Could not read your location. Allow GPS or enter coordinates.", "error"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (profile.role !== "merchant") return show(locale === "ar" ? "احفظ بيانات الحساب كمتجر الأول." : "Save the account as a merchant first.", "error");
    if (!uploads.ownerFront || !uploads.ownerBack || !uploads.storefront) return show(locale === "ar" ? "ارفع وجهي بطاقة صاحب المتجر وصورة واجهة المتجر." : "Upload both ID sides and the storefront photo.", "error");
    if (!form.categoryIds.length) return show(locale === "ar" ? "اختار قسم واحد على الأقل." : "Select at least one category.", "error");
    setBusy(true); show("");
    try {
      await api("/api/merchant/registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit_registration", payload: {
        store_name: form.storeName, owner_name: form.ownerName, owner_mobile: form.ownerMobile, manager_name: form.managerName, manager_mobile: form.managerMobile, contact_mobile: form.contactMobile,
        category_ids: form.categoryIds, primary_category_id: form.categoryIds[0], pricing_mode: form.pricingMode, city_id: form.cityId, branch_name: form.branchName || form.storeName,
        latitude: form.latitude, longitude: form.longitude,
        owner_id_front_image_url: uploads.ownerFront.path, owner_id_back_image_url: uploads.ownerBack.path, owner_id_image_url: uploads.ownerFront.path,
        store_front_image_url: uploads.storefront.path, commercial_register_url: uploads.commercial?.path ?? null,
      } }) });
      show(locale === "ar" ? "تم إرسال المتجر للمراجعة بنجاح. هنبلغك أول ما الإدارة تراجع الطلب." : "The store was submitted for review. We will notify you when it is reviewed.", "success");
      await load();
    } catch (error) { show(humanError(error, locale), "error"); }
    finally { setBusy(false); }
  }

  const locationGroups = useMemo(() => {
    const cityRows = (data?.locations ?? []).filter((item) => item.is_country_marker !== true);
    return cityRows;
  }, [data]);
  const categoryRows = useMemo(() => (data?.categories ?? []).filter((item) => !item.parent_id), [data]);

  if (authStep !== "ready") return <RegistrationShell><div className="auth-layout registration-auth-layout"><aside><span className="eyebrow light"><Icon name="store"/>{locale === "ar" ? "تسجيل متجر جديد" : "New merchant registration"}</span><h1>{locale === "ar" ? "أنشئ حساب متجرك وأرسل بياناته للمراجعة" : "Create your store account and submit it for review"}</h1><p>{locale === "ar" ? "أكمل بيانات الحساب والمتجر والأقسام والموقع والمستندات في خطوات واضحة ومنظمة." : "Complete the account, store, category, location, and document details in clear, organised steps."}</p></aside><section className="auth-card otp-auth-card"><span className="eyebrow"><Icon name="mail"/>{locale === "ar" ? "تأكيد البريد" : "Email verification"}</span><h2>{authStep === "email" ? (locale === "ar" ? "اكتب بريد المتجر" : "Enter the merchant email") : (locale === "ar" ? "اكتب رمز التأكيد" : "Enter the verification code")}</h2>{authStep === "email" ? <form onSubmit={sendCode}><label>{locale === "ar" ? "البريد الإلكتروني" : "Email"}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="button primary full" disabled={busy}>{locale === "ar" ? "إرسال الرمز" : "Send code"}</button></form> : <form onSubmit={verify}><label>{locale === "ar" ? "رمز التأكيد" : "Verification code"}<input className="otp-input" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}/></label><button className="button primary full" disabled={busy}>{locale === "ar" ? "تأكيد البريد" : "Verify email"}</button><button className="button text-button" type="button" onClick={() => setAuthStep("email")}>{locale === "ar" ? "تغيير البريد" : "Change email"}</button></form>}{message ? <p className={tone === "error" ? "form-error" : "form-notice"}>{message}</p> : null}<div className="auth-links"><Link href="/merchant-login">{locale === "ar" ? "عندي متجر بالفعل" : "I already have a store"}</Link></div></section></div></RegistrationShell>;

  const roleBlocked = profile.role === "buyer";
  const profileIncomplete = !profile.id || profile.role !== "merchant";
  return <RegistrationShell><div className="registration-container"><header className="registration-heading"><div><span className="eyebrow"><Icon name="store"/>{locale === "ar" ? "بوابة تسجيل المتاجر" : "Merchant registration portal"}</span><h1>{locale === "ar" ? (merchantStatus ? "راجع أو حدّث طلب متجرك" : "سجّل متجرك في سعرلي") : (merchantStatus ? "Review or update your store application" : "Register your store on Saarly")}</h1><p>{locale === "ar" ? "البيانات دي بتظهر للإدارة للمراجعة، والعميل مش بيشوف المستندات الخاصة." : "These details are reviewed by administration. Private documents are never shown to buyers."}</p></div><Link className="button secondary" href="/merchant-login">{locale === "ar" ? "دخول متجر موجود" : "Existing store sign in"}</Link></header>
  {merchantStatus ? <div className={`registration-status ${merchantStatus}`}><strong>{merchantStatus === "approved" ? (locale === "ar" ? "المتجر معتمد" : "Store approved") : merchantStatus === "rejected" ? (locale === "ar" ? "الطلب مرفوض ويمكن تعديله" : "Application rejected and can be updated") : (locale === "ar" ? "الطلب قيد المراجعة" : "Application under review")}</strong>{text(merchant.rejection_reason) ? <span>{locale === "ar" ? "سبب الرفض: " : "Rejection reason: "}{text(merchant.rejection_reason)}</span> : null}{merchantStatus === "approved" ? <Link className="button primary" href="/merchant">{locale === "ar" ? "فتح بوابة المتجر" : "Open merchant portal"}</Link> : null}</div> : null}
  {roleBlocked ? <div className="notice danger"><Icon name="info"/><div><strong>{locale === "ar" ? "البريد مسجل كمشتري" : "This email is a buyer account"}</strong><p>{locale === "ar" ? "مش هنحوّل الحساب تلقائي عشان ما نخسرش بيانات المشتري. سجل خروج واستخدم بريد مختلف للمتجر." : "We will not silently convert it. Sign out and use a different email for the store."}</p></div></div> : null}
  {!roleBlocked ? <form className="registration-form" onSubmit={submit}>
    <section className="portal-panel"><div className="section-heading"><div><span className="eyebrow"><Icon name="users"/>{locale === "ar" ? "الخطوة 1" : "Step 1"}</span><h2>{locale === "ar" ? "بيانات الحساب" : "Account details"}</h2></div></div><div className="form-grid"><label>{locale === "ar" ? "الاسم بالكامل" : "Full name"}<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}/></label><label>{locale === "ar" ? "رقم الموبايل" : "Mobile number"}<input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })}/></label><label>{locale === "ar" ? "بريد استرداد اختياري" : "Optional recovery email"}<input type="email" value={form.recoveryEmail} onChange={(e) => setForm({ ...form, recoveryEmail: e.target.value })}/></label></div>{profileIncomplete ? <button className="button primary" type="button" onClick={() => void saveProfile()} disabled={busy}>{locale === "ar" ? "حفظ بيانات الحساب كمتجر" : "Save merchant account details"}</button> : <p className="inline-success"><Icon name="check"/>{locale === "ar" ? "الحساب محفوظ كمتجر" : "Account saved as merchant"}</p>}</section>
    <fieldset disabled={profileIncomplete || busy} className="registration-fieldset">
      <section className="portal-panel"><div className="section-heading"><div><span className="eyebrow"><Icon name="store"/>{locale === "ar" ? "الخطوة 2" : "Step 2"}</span><h2>{locale === "ar" ? "بيانات المتجر والإدارة" : "Store and management"}</h2></div></div><div className="form-grid"><label>{locale === "ar" ? "اسم المتجر" : "Store name"}<input required value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })}/></label><label>{locale === "ar" ? "اسم صاحب المتجر" : "Owner name"}<input required value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}/></label><label>{locale === "ar" ? "موبايل صاحب المتجر" : "Owner mobile"}<input required value={form.ownerMobile} onChange={(e) => setForm({ ...form, ownerMobile: e.target.value })}/></label><label>{locale === "ar" ? "اسم المدير" : "Manager name"}<input required value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })}/></label><label>{locale === "ar" ? "موبايل المدير" : "Manager mobile"}<input required value={form.managerMobile} onChange={(e) => setForm({ ...form, managerMobile: e.target.value })}/></label><label>{locale === "ar" ? "رقم تواصل العملاء" : "Customer contact mobile"}<input required value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value })}/></label><label>{locale === "ar" ? "طريقة التسعير" : "Pricing mode"}<select value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value as FormState["pricingMode"] })}><option value="catalog">{locale === "ar" ? "كتالوج وأسعار" : "Catalog and prices"}</option><option value="manual_quote">{locale === "ar" ? "تسعير يدوي" : "Manual quotation"}</option></select></label></div></section>
      <section className="portal-panel"><div className="section-heading"><div><span className="eyebrow"><Icon name="box"/>{locale === "ar" ? "الخطوة 3" : "Step 3"}</span><h2>{locale === "ar" ? "أقسام المتجر" : "Store categories"}</h2></div></div><div className="choice-grid">{categoryRows.map((category) => { const id = text(category.id); const checked = form.categoryIds.includes(id); return <label key={id} className={`choice-card ${checked ? "selected" : ""}`}><input type="checkbox" checked={checked} onChange={() => setForm((current) => ({ ...current, categoryIds: checked ? current.categoryIds.filter((value) => value !== id) : [...current.categoryIds, id] }))}/><strong>{text(locale === "ar" ? category.name_ar : category.name_en)}</strong></label>; })}</div></section>
      <section className="portal-panel"><div className="section-heading"><div><span className="eyebrow"><Icon name="location"/>{locale === "ar" ? "الخطوة 4" : "Step 4"}</span><h2>{locale === "ar" ? "موقع الفرع الرئيسي" : "Main branch location"}</h2></div></div><div className="form-grid"><label>{locale === "ar" ? "اسم الفرع" : "Branch name"}<input required value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })}/></label><label>{locale === "ar" ? "الدولة والمحافظة والمدينة" : "Country, governorate, and city"}<select required value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}><option value="">{locale === "ar" ? "اختار المدينة" : "Select city"}</option>{locationGroups.map((location) => <option key={text(location.id)} value={text(location.id)}>{locale === "ar" ? `${text(location.country_ar)} - ${text(location.governorate_ar)} - ${text(location.name_ar)}` : `${text(location.country_en)} - ${text(location.governorate_en)} - ${text(location.name_en)}`}</option>)}</select></label><label>{locale === "ar" ? "خط العرض" : "Latitude"}<input required inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })}/></label><label>{locale === "ar" ? "خط الطول" : "Longitude"}<input required inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })}/></label></div><div className="registration-location-actions"><button className="button secondary" type="button" onClick={useLocation}><Icon name="target"/>{locale === "ar" ? "استخدام موقعي الحالي" : "Use my current location"}</button>{registrationMapUrl(form.latitude, form.longitude) ? <a className="button text-button" href={`https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`} target="_blank" rel="noopener noreferrer"><Icon name="location"/>{locale === "ar" ? "فتح الخريطة كاملة" : "Open full map"}</a> : null}</div>{registrationMapUrl(form.latitude, form.longitude) ? <iframe className="registration-map-preview" title={locale === "ar" ? "معاينة موقع الفرع الرئيسي" : "Main branch location preview"} src={registrationMapUrl(form.latitude, form.longitude)} loading="lazy"/> : <p className="form-notice">{locale === "ar" ? "استخدم موقعك الحالي أو اكتب الإحداثيات عشان تظهر معاينة الخريطة." : "Use your current location or enter coordinates to preview the map."}</p>}</section>
      <section className="portal-panel"><div className="section-heading"><div><span className="eyebrow"><Icon name="upload"/>{locale === "ar" ? "الخطوة 5" : "Step 5"}</span><h2>{locale === "ar" ? "الصور والمستندات" : "Photos and documents"}</h2></div></div><div className="upload-grid">{([
        ["ownerFront", "owner-id-front", locale === "ar" ? "وجه بطاقة صاحب المتجر" : "Owner ID front", false], ["ownerBack", "owner-id-back", locale === "ar" ? "ظهر بطاقة صاحب المتجر" : "Owner ID back", false], ["storefront", "storefront", locale === "ar" ? "صورة واجهة المتجر" : "Storefront photo", true], ["commercial", "commercial-register", locale === "ar" ? "السجل التجاري اختياري" : "Optional commercial register", false],
      ] as const).map(([key, kind, label, imageOnly]) => <label className={`upload-card ${uploads[key] ? "uploaded" : ""}`} key={key}><Icon name={uploads[key] ? "check" : "upload"}/><strong>{label}</strong><small>{uploads[key] ? (locale === "ar" ? "تم الرفع" : "Uploaded") : imageOnly ? "JPG, PNG, WEBP" : "JPG, PNG, WEBP, PDF"}</small><input type="file" accept={imageOnly ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(key, kind, file); }}/>{uploading === key ? <span>{locale === "ar" ? "جارٍ الرفع..." : "Uploading..."}</span> : null}</label>)}</div></section>
      {message ? <p className={tone === "error" ? "form-error sticky-message" : "form-notice sticky-message"}>{message}</p> : null}<button className="button primary registration-submit" type="submit" disabled={busy || Boolean(uploading)}><Icon name="check"/>{busy ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "إرسال المتجر للمراجعة" : "Submit store for review")}</button>
    </fieldset>
  </form> : null}</div></RegistrationShell>;
}
