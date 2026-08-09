"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { bool, currencyLabel, dateLabel, money, numberValue, rows, text, unitLabel, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type ProductForm = {
  id: string; name: string; categoryId: string; price: string; quantity: string; unit: string; brand: string; size: string; color: string;
  imageUrls: string[]; isActive: boolean; isAvailable: boolean; shippingType: string; deliveryPricingMethod: string; shippingWeightKg: string; weightInKg: string;
};

const emptyForm: ProductForm = { id: "", name: "", categoryId: "", price: "0", quantity: "0", unit: "", brand: "", size: "", color: "", imageUrls: [], isActive: true, isAvailable: true, shippingType: "fixed", deliveryPricingMethod: "flat", shippingWeightKg: "", weightInKg: "" };

export function ProductsSection({ payload, locale, refresh, notify }: SectionProps) {
  const products = rows(payload.data.products);
  const categories = rows(payload.data.categories);
  const branches = rows(payload.data.branches);
  const availabilityRows = rows(payload.data.availability);
  const currency = text(payload.data.currencyCode || payload.account.currencyCode, "EGP");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [branchId, setBranchId] = useState(text(branches[0]?.id));
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [quickMode, setQuickMode] = useState(false);
  const [quickValues, setQuickValues] = useState<Record<string, { price: string; quantity: string }>>({});
  const [quickSaving, setQuickSaving] = useState("");
  const { confirm, confirmDialog } = usePortalConfirm(locale);

  const visible = useMemo(() => products.filter((product) => {
    const matchesSearch = !query || [product.free_name, product.brand, product.size, product.color].some((item) => text(item).toLowerCase().includes(query.toLowerCase()));
    const available = bool(product.is_available, true);
    return matchesSearch && (availability === "all" || (availability === "available" ? available : !available));
  }), [products, query, availability]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [text(item.id), text(locale === "ar" ? item.name_ar : item.name_en)])), [categories, locale]);

  function edit(product?: PortalRow) {
    if (!product) setForm(emptyForm);
    else setForm({
      id: text(product.id), name: text(product.free_name), categoryId: text(product.category_id), price: text(product.price, "0"), quantity: text(product.quantity, "0"), unit: unitLabel(product.unit, locale, locale === "ar" ? "قطعة" : "piece"),
      brand: text(product.brand), size: text(product.size), color: text(product.color), imageUrls: (Array.isArray(product.image_urls) ? product.image_urls.map((item) => text(item)).filter(Boolean) : [text(product.image_url)].filter(Boolean)).slice(0, 1),
      isActive: bool(product.is_active, true), isAvailable: bool(product.is_available, true), shippingType: text(product.shipping_type, "fixed"), deliveryPricingMethod: text(product.delivery_pricing_method, "flat"), shippingWeightKg: text(product.shipping_weight_kg), weightInKg: text(product.weight_in_kg),
    });
    setShowEditor(true);
  }

  async function uploadImage(file: File) {
    if (form.imageUrls.length >= 1) return notify(locale === "ar" ? "المنتج له صورة واحدة فقط. احذف الصورة الحالية لو عايز تستبدلها." : "A product uses one image only. Remove the current image to replace it.", "error");
    setUploading(1);
    try {
      const uploaded = await portalUpload("product-image", file, setUploading);
      if (!uploaded.url) throw new Error("upload_url_missing");
      setForm((current) => ({ ...current, imageUrls: [uploaded.url!] }));
      notify(locale === "ar" ? "تم رفع صورة المنتج." : "Product image uploaded.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "upload_failed", "error"); }
    finally { window.setTimeout(() => setUploading(0), 350); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const price = Number(form.price);
    const quantity = Number(form.quantity);
    const shippingWeight = form.shippingWeightKg ? Number(form.shippingWeightKg) : null;
    if (!form.categoryId) return notify(locale === "ar" ? "اختر قسم المنتج." : "Choose a product category.", "error");
    if (!form.unit.trim()) return notify(locale === "ar" ? "اكتب وحدة بيع أو قياس المنتج." : "Enter the product selling or measurement unit.", "error");
    if (!Number.isFinite(price) || price <= 0) return notify(locale === "ar" ? "السعر لازم يكون أكبر من صفر." : "Price must be greater than zero.", "error");
    if (!Number.isFinite(quantity) || quantity < 0) return notify(locale === "ar" ? "الكمية لا يمكن أن تكون سالبة." : "Quantity cannot be negative.", "error");
    if (!form.imageUrls.length) return notify(locale === "ar" ? "أضف صورة واحدة على الأقل للمنتج." : "Add at least one product image.", "error");
    if (form.deliveryPricingMethod === "weight" && (!shippingWeight || shippingWeight <= 0)) return notify(locale === "ar" ? "اكتب وزن المنتج بالكيلو لاستخدام تسعير الشحن بالوزن." : "Enter a positive product weight for weight-based delivery pricing.", "error");
    setSaving(true);
    try {
      await portalPost("save_product", { ...form, imageUrls: form.imageUrls.slice(0, 1), imageUrl: form.imageUrls[0] ?? "", price, quantity, shippingWeightKg: form.deliveryPricingMethod === "weight" ? shippingWeight : null, weightInKg: form.weightInKg ? Number(form.weightInKg) : null });
      notify(locale === "ar" ? "تم حفظ المنتج بكل تفاصيله." : "Product details saved.", "success");
      setShowEditor(false); setForm(emptyForm); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "save_failed", "error"); }
    finally { setSaving(false); }
  }

  function quickValue(product: PortalRow) {
    const id = text(product.id);
    return quickValues[id] ?? { price: text(product.price, "0"), quantity: text(product.quantity, "0") };
  }

  function patchQuick(id: string, field: "price" | "quantity", value: string, product: PortalRow) {
    const current = quickValues[id] ?? { price: text(product.price, "0"), quantity: text(product.quantity, "0") };
    setQuickValues((values) => ({ ...values, [id]: { ...current, [field]: value } }));
  }

  async function saveQuick(product: PortalRow) {
    const id = text(product.id);
    const values = quickValue(product);
    const price = Number(values.price);
    const quantity = Number(values.quantity);
    const image = (Array.isArray(product.image_urls) ? product.image_urls.map((item) => text(item)).find(Boolean) : text(product.image_url)) || "";
    if (!Number.isFinite(price) || price <= 0) return notify(locale === "ar" ? "السعر لازم يكون أكبر من صفر." : "Price must be greater than zero.", "error");
    if (!Number.isFinite(quantity) || quantity < 0) return notify(locale === "ar" ? "الكمية لا يمكن أن تكون سالبة." : "Quantity cannot be negative.", "error");
    if (!image) return notify(locale === "ar" ? "أضف صورة للمنتج من التعديل الكامل قبل استخدام التحديث السريع." : "Add a product image in full edit before using quick update.", "error");
    setQuickSaving(id);
    try {
      await portalPost("save_product", {
        id, name: text(product.free_name), categoryId: text(product.category_id), price, quantity, unit: unitLabel(product.unit, locale, locale === "ar" ? "قطعة" : "piece"),
        brand: text(product.brand), size: text(product.size), color: text(product.color), imageUrls: [image], imageUrl: image,
        isActive: bool(product.is_active, true), isAvailable: bool(product.is_available, true), shippingType: text(product.shipping_type, "fixed"),
        deliveryPricingMethod: text(product.delivery_pricing_method, "flat"), shippingWeightKg: product.shipping_weight_kg ?? null, weightInKg: product.weight_in_kg ?? null,
      });
      notify(locale === "ar" ? "تم تحديث السعر والكمية." : "Price and quantity updated.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "quick_update_failed", "error"); }
    finally { setQuickSaving(""); }
  }

  async function deactivate(id: string) {
    if (!(await confirm({ title: locale === "ar" ? "إيقاف المنتج" : "Disable product", body: locale === "ar" ? "هيتم إيقاف المنتج بدون حذف سجله أو بياناته التاريخية." : "The product will be disabled without deleting its record or history.", confirmLabel: locale === "ar" ? "إيقاف المنتج" : "Disable product", tone: "danger" }))) return;
    try { await portalPost("deactivate_product", { id }); notify(locale === "ar" ? "تم إيقاف المنتج." : "Product disabled.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "update_failed", "error"); }
  }

  function selectBranch(id: string) {
    setBranchId(id);
    setUnavailableIds(availabilityRows.filter((item) => text(item.branch_id) === id && item.is_available === false).map((item) => text(item.product_id)));
  }

  async function saveBranchAvailability() {
    if (!branchId) return;
    setSaving(true);
    try { await portalPost("save_branch_availability", { branchId, unavailableProductIds: unavailableIds }); notify(locale === "ar" ? "تم حفظ توفر المنتجات في الفرع." : "Branch product availability saved.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "availability_update_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack">
    <PortalPanel title={locale === "ar" ? "المنتجات والأسعار" : "Products and prices"} subtitle={locale === "ar" ? "كل بيانات المنتج وصوره وشحنه وتوفره العام وفي كل فرع." : "Manage every product detail, image, shipping rule, and branch availability."} action={<div className="inline-actions"><button className={`button secondary compact ${quickMode ? "active" : ""}`} type="button" aria-pressed={quickMode} onClick={() => setQuickMode((value) => !value)}><Icon name="money" size={18}/>{locale === "ar" ? "تحديث سريع للأسعار" : "Quick price mode"}</button><Link className="button secondary compact" href="/merchant/imports"><Icon name="upload" size={18}/>{locale === "ar" ? "استيراد منتجات" : "Import products"}</Link><button className="button primary compact" type="button" onClick={() => edit()}><Icon name="plus" size={18}/>{locale === "ar" ? "إضافة منتج" : "Add product"}</button></div>}>
      <div className="portal-toolbar"><label className="search-field"><Icon name="search" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "ar" ? "ابحث بالاسم أو الماركة أو المقاس" : "Search name, brand, or size"}/></label><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">{locale === "ar" ? "كل حالات التوفر" : "All availability"}</option><option value="available">{locale === "ar" ? "متاح" : "Available"}</option><option value="unavailable">{locale === "ar" ? "غير متاح" : "Unavailable"}</option></select><span className="toolbar-count">{visible.length} {locale === "ar" ? "منتج" : "products"}</span></div>
      {visible.length === 0 ? <EmptyState title={locale === "ar" ? "لا توجد منتجات مطابقة" : "No matching products"} body={locale === "ar" ? "أضف أول منتج أو غيّر البحث والفلاتر." : "Add the first product or change the filters."} action={<button className="button primary compact" type="button" onClick={() => edit()}>{locale === "ar" ? "إضافة منتج" : "Add product"}</button>}/> : <div className="portal-table-wrap"><table className="portal-table products-table"><thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>{locale === "ar" ? "القسم" : "Category"}</th><th>{locale === "ar" ? "السعر" : "Price"}</th><th>{locale === "ar" ? "الكمية" : "Quantity"}</th><th>{locale === "ar" ? "التوفر" : "Availability"}</th><th>{locale === "ar" ? "آخر تحديث" : "Last update"}</th><th/></tr></thead><tbody>{visible.map((product) => { const images = Array.isArray(product.image_urls) ? product.image_urls.map((item) => text(item)).filter(Boolean) : [text(product.image_url)].filter(Boolean); return <tr key={text(product.id)} data-record-id={text(product.id)}><td><div className="product-cell">{images[0] ? <img src={images[0]} alt=""/> : <span><Icon name="box"/></span>}<div><strong>{text(product.free_name)}</strong><small>{[text(product.brand), text(product.size), text(product.color)].filter(Boolean).join(" · ")}</small></div></div></td><td>{categoryMap.get(text(product.category_id)) || (locale === "ar" ? "بدون قسم" : "Uncategorised")}</td><td>{quickMode ? <input className="quick-price-input" type="number" min="0.01" step="0.01" aria-label={locale === "ar" ? `سعر ${text(product.free_name)}` : `${text(product.free_name)} price`} value={quickValue(product).price} onChange={(event) => patchQuick(text(product.id), "price", event.target.value, product)}/> : money(product.price, currency, locale)}</td><td>{quickMode ? <div className="quick-quantity-field"><input className="quick-price-input" type="number" min="0" step="0.01" aria-label={locale === "ar" ? `كمية ${text(product.free_name)}` : `${text(product.free_name)} quantity`} value={quickValue(product).quantity} onChange={(event) => patchQuick(text(product.id), "quantity", event.target.value, product)}/><small>{unitLabel(product.unit, locale)}</small></div> : <>{numberValue(product.quantity)} {unitLabel(product.unit, locale)}</>}</td><td><StatusBadge value={bool(product.is_available, true) ? "active" : "suspended"} locale={locale}/></td><td>{dateLabel(product.price_quantity_updated_at, locale)}</td><td><div className="table-actions">{quickMode ? <button className="save-quick" type="button" disabled={quickSaving === text(product.id)} onClick={() => void saveQuick(product)} aria-label={locale === "ar" ? "حفظ السعر والكمية" : "Save price and quantity"} title={locale === "ar" ? "حفظ التحديث السريع" : "Save quick update"}><Icon name="check" size={17}/></button> : null}<button type="button" onClick={() => edit(product)} aria-label={locale === "ar" ? "تعديل المنتج" : "Edit product"} title={locale === "ar" ? "تعديل" : "Edit"}><Icon name="edit" size={17}/></button>{bool(product.is_active, true) ? <button className="danger" type="button" onClick={() => void deactivate(text(product.id))} aria-label={locale === "ar" ? "إيقاف المنتج" : "Disable product"} title={locale === "ar" ? "إيقاف المنتج" : "Disable product"}><Icon name="trash" size={17}/></button> : null}</div></td></tr>; })}</tbody></table></div>}
    </PortalPanel>

    {branches.length ? <PortalPanel title={locale === "ar" ? "توفر المنتجات حسب الفرع" : "Product availability by branch"} subtitle={locale === "ar" ? "اختار الفرع وحدد المنتجات غير المتاحة فيه. الباقي هيعتبر متاح." : "Choose a branch and mark products unavailable there. All others remain available."} action={<button className="button primary compact" type="button" disabled={saving || !branchId} onClick={() => void saveBranchAvailability()}>{locale === "ar" ? "حفظ التوفر" : "Save availability"}</button>}><div className="portal-toolbar"><select value={branchId} onChange={(event) => selectBranch(event.target.value)}><option value="">{locale === "ar" ? "اختار الفرع" : "Select branch"}</option>{branches.map((branch) => <option key={text(branch.id)} value={text(branch.id)}>{text(branch.name)}</option>)}</select><span className="toolbar-count">{products.length - unavailableIds.length}/{products.length} {locale === "ar" ? "متاح" : "available"}</span></div><div className="availability-grid">{products.filter((item) => bool(item.is_active, true)).map((product) => { const id = text(product.id); const checked = !unavailableIds.includes(id); return <label key={id} className={`choice-card compact ${checked ? "selected" : ""}`}><input type="checkbox" checked={checked} onChange={() => setUnavailableIds((current) => checked ? [...current, id] : current.filter((value) => value !== id))}/><strong>{text(product.free_name)}</strong><small>{checked ? (locale === "ar" ? "متاح في الفرع" : "Available in branch") : (locale === "ar" ? "غير متاح" : "Unavailable")}</small></label>; })}</div></PortalPanel> : null}

    {showEditor ? <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEditor(false); }}><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="box" size={17}/>{form.id ? (locale === "ar" ? "تعديل منتج" : "Edit product") : (locale === "ar" ? "منتج جديد" : "New product")}</span><h2>{locale === "ar" ? "بيانات المنتج الكاملة" : "Complete product details"}</h2></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setShowEditor(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submit}><div className="form-grid two"><label className="span-two">{locale === "ar" ? "اسم المنتج" : "Product name"}<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>{locale === "ar" ? "القسم" : "Category"}<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">{locale === "ar" ? "اختر القسم" : "Choose category"}</option>{categories.map((category) => <option key={text(category.id)} value={text(category.id)}>{text(locale === "ar" ? category.name_ar : category.name_en)}</option>)}</select></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required placeholder={locale === "ar" ? "قطعة، كيلوجرام، متر، لتر، علبة، لفة..." : "piece, kilogram, metre, litre, box, roll..."} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}/><small>{locale === "ar" ? "الوحدة هي طريقة بيع أو قياس المنتج ويمكنك كتابة أي وحدة تناسبه." : "The unit is how the product is sold or measured; enter any suitable unit."}</small></label><label>{locale === "ar" ? `السعر (${currencyLabel(currency, locale)})` : `Price (${currencyLabel(currency, locale)})`}<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input required type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}/></label><label>{locale === "ar" ? "الماركة" : "Brand"}<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}/></label><label>{locale === "ar" ? "المقاس أو السعة (اختياري)" : "Size or capacity (optional)"}<input placeholder={locale === "ar" ? "مقاس كبير، 20 مم، 1 لتر، 50 × 70 سم..." : "Large size, 20 millimetres, 1 litre, 50 × 70 centimetres..."} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}/></label><label>{locale === "ar" ? "اللون" : "Color"}<input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}/></label><label>{locale === "ar" ? "طريقة حساب التوصيل" : "Delivery pricing method"}<select value={form.deliveryPricingMethod} onChange={(e) => setForm({ ...form, deliveryPricingMethod: e.target.value })}><option value="flat">{locale === "ar" ? "سعر ثابت" : "Flat"}</option><option value="zone">{locale === "ar" ? "حسب المنطقة" : "By zone"}</option><option value="weight">{locale === "ar" ? "حسب الوزن" : "By weight"}</option></select></label>{form.deliveryPricingMethod === "weight" ? <label>{locale === "ar" ? "وزن المنتج بالكيلوجرام" : "Product weight in kilograms"}<input required type="number" min="0.001" step="0.001" value={form.shippingWeightKg} onChange={(e) => setForm({ ...form, shippingWeightKg: e.target.value })}/><small>{locale === "ar" ? "يُستخدم مع الكمية لاختيار شريحة الوزن المناسبة." : "Used with quantity to choose the correct weight tier."}</small></label> : null}</div><div className="multi-image-editor"><div className="field-heading"><strong>{locale === "ar" ? "صورة المنتج" : "Product image"}</strong><small>{locale === "ar" ? "صورة واحدة فقط مثل التطبيق" : "One image only, matching the app"}</small></div><div className="image-preview-grid">{form.imageUrls.map((url, index) => <figure key={`${url}-${index}`}><img src={url} alt=""/><button type="button" aria-label={locale === "ar" ? "حذف صورة المنتج" : "Remove product image"} title={locale === "ar" ? "حذف صورة المنتج" : "Remove product image"} onClick={() => setForm((current) => ({ ...current, imageUrls: current.imageUrls.filter((_, currentIndex) => currentIndex !== index) }))}><Icon name="close" size={15}/></button>{index === 0 ? <figcaption>{locale === "ar" ? "الصورة الرئيسية" : "Main image"}</figcaption> : null}</figure>)}{form.imageUrls.length < 1 ? <label className="image-add-card"><Icon name="upload"/><strong>{uploading ? `${uploading}%` : (locale === "ar" ? "إضافة صورة" : "Add image")}</strong><small>{locale === "ar" ? "صورة واحدة" : "1 image"}</small><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading > 0} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.target.value = ""; }}/></label> : null}</div></div><div className="switch-grid"><label className="switch-row"><input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}/><span><strong>{locale === "ar" ? "متاح حاليًا" : "Currently available"}</strong></span></label><label className="switch-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}/><span><strong>{locale === "ar" ? "منتج فعّال" : "Active product"}</strong></span></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setShowEditor(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ المنتج" : "Save product")}</button></div></form></section></div> : null}
    {confirmDialog}
  </div>;
}
