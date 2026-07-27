"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, dateLabel, money, numberValue, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";
import { readSpreadsheet, spreadsheetProducts } from "@/lib/xlsx-lite";

type ProductForm = {
  id: string;
  name: string;
  categoryId: string;
  price: string;
  quantity: string;
  unit: string;
  brand: string;
  size: string;
  color: string;
  imageUrl: string;
  isActive: boolean;
  isAvailable: boolean;
  shippingType: string;
  weightInKg: string;
};

const emptyForm: ProductForm = {
  id: "", name: "", categoryId: "", price: "0", quantity: "0", unit: "قطعة", brand: "", size: "", color: "", imageUrl: "", isActive: true, isAvailable: true, shippingType: "merchant_delivery", weightInKg: "",
};

export function ProductsSection({ payload, locale, refresh, notify }: SectionProps) {
  const products = rows(payload.data.products);
  const categories = rows(payload.data.categories);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => products.filter((product) => {
    const matchesSearch = !query || [product.free_name, product.brand, product.size, product.color].some((value) => text(value).toLowerCase().includes(query.toLowerCase()));
    const available = bool(product.is_available, true);
    const matchesAvailability = availability === "all" || (availability === "available" ? available : !available);
    return matchesSearch && matchesAvailability;
  }), [products, query, availability]);

  const categoryMap = useMemo(() => new Map(categories.map((item) => [text(item.id), text(locale === "ar" ? item.name_ar : item.name_en)])), [categories, locale]);

  function edit(product?: PortalRow) {
    if (!product) setForm(emptyForm);
    else setForm({
      id: text(product.id), name: text(product.free_name), categoryId: text(product.category_id), price: text(product.price, "0"), quantity: text(product.quantity, "0"), unit: text(product.unit, "قطعة"), brand: text(product.brand), size: text(product.size), color: text(product.color), imageUrl: text(product.image_url), isActive: bool(product.is_active, true), isAvailable: bool(product.is_available, true), shippingType: text(product.shipping_type, "merchant_delivery"), weightInKg: text(product.weight_in_kg),
    });
    setShowEditor(true);
  }

  async function uploadImage(file: File) {
    setUploading(1);
    try {
      const uploaded = await portalUpload("product-image", file, setUploading);
      setForm((current) => ({ ...current, imageUrl: uploaded.url ?? "" }));
      notify(locale === "ar" ? "تم رفع صورة المنتج." : "Product image uploaded.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "upload_failed", "error");
    } finally {
      setTimeout(() => setUploading(0), 500);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await portalPost("save_product", { ...form, price: Number(form.price), quantity: Number(form.quantity), weightInKg: form.weightInKg ? Number(form.weightInKg) : null });
      notify(locale === "ar" ? "تم حفظ المنتج." : "Product saved.", "success");
      setShowEditor(false);
      setForm(emptyForm);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "save_failed", "error");
    } finally { setSaving(false); }
  }

  async function deactivate(id: string) {
    if (!window.confirm(locale === "ar" ? "سيتم إيقاف المنتج للاستخدام الجديد دون حذف سجله. هل تريد المتابعة؟" : "The product will be disabled for new use without deleting its record. Continue?")) return;
    try {
      await portalPost("deactivate_product", { id });
      notify(locale === "ar" ? "تم إيقاف المنتج." : "Product disabled.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "update_failed", "error"); }
  }

  async function importSpreadsheet(file: File) {
    setSaving(true);
    try {
      const matrix = await readSpreadsheet(file);
      const categoryRows = categories.map((item) => ({ id: text(item.id), ar: text(item.name_ar), en: text(item.name_en) }));
      const items = spreadsheetProducts(matrix, categoryRows);
      if (items.length === 0) throw new Error("spreadsheet_has_no_valid_products");
      const result = await portalPost("import_products", { items });
      notify(locale === "ar" ? `تم استيراد ${numberValue((result as PortalRow)?.imported, items.length)} منتج.` : `${numberValue((result as PortalRow)?.imported, items.length)} products imported.`, "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "import_failed", "error"); }
    finally { setSaving(false); if (importRef.current) importRef.current.value = ""; }
  }

  return (
    <div className="portal-section-stack">
      <PortalPanel title={locale === "ar" ? "المنتجات والأسعار" : "Products and prices"} subtitle={locale === "ar" ? "أضف المنتجات أو حدّث السعر والكمية والتوفر. يمكنك استيراد CSV أو XLSX صادر من Excel." : "Add products or update price, quantity, and availability. CSV and XLSX exported by Excel are supported."} action={<div className="inline-actions"><input ref={importRef} className="sr-only" type="file" accept=".csv,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSpreadsheet(file); }}/><button className="button secondary compact" type="button" onClick={() => importRef.current?.click()} disabled={saving}><Icon name="upload" size={18}/>{locale === "ar" ? "استيراد Excel" : "Import Excel"}</button><button className="button primary compact" type="button" onClick={() => edit()}><Icon name="plus" size={18}/>{locale === "ar" ? "إضافة منتج" : "Add product"}</button></div>}>
        <div className="portal-toolbar"><label className="search-field"><Icon name="search" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "ar" ? "ابحث بالاسم أو الماركة أو المقاس" : "Search name, brand, or size"}/></label><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">{locale === "ar" ? "كل حالات التوفر" : "All availability"}</option><option value="available">{locale === "ar" ? "متاح" : "Available"}</option><option value="unavailable">{locale === "ar" ? "غير متاح" : "Unavailable"}</option></select><span className="toolbar-count">{visible.length} {locale === "ar" ? "منتج" : "products"}</span></div>
        {visible.length === 0 ? <EmptyState title={locale === "ar" ? "لا توجد منتجات مطابقة" : "No matching products"} body={locale === "ar" ? "أضف أول منتج أو غيّر البحث والفلاتر." : "Add the first product or change the search and filters."} action={<button className="button primary compact" type="button" onClick={() => edit()}>{locale === "ar" ? "إضافة منتج" : "Add product"}</button>}/> : (
          <div className="portal-table-wrap"><table className="portal-table products-table"><thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>{locale === "ar" ? "القسم" : "Category"}</th><th>{locale === "ar" ? "السعر" : "Price"}</th><th>{locale === "ar" ? "الكمية" : "Quantity"}</th><th>{locale === "ar" ? "التوفر" : "Availability"}</th><th>{locale === "ar" ? "آخر تحديث" : "Last update"}</th><th aria-label={locale === "ar" ? "الإجراءات" : "Actions"}/></tr></thead><tbody>{visible.map((product) => <tr key={text(product.id)}><td><div className="product-cell">{product.image_url ? <img src={text(product.image_url)} alt=""/> : <span><Icon name="box"/></span>}<div><strong>{text(product.free_name)}</strong><small>{[text(product.brand), text(product.size), text(product.color)].filter(Boolean).join(" · ")}</small></div></div></td><td>{categoryMap.get(text(product.category_id)) || (locale === "ar" ? "بدون قسم" : "Uncategorised")}</td><td>{money(product.price, "EGP", locale)}</td><td>{numberValue(product.quantity)} {text(product.unit)}</td><td><StatusBadge value={bool(product.is_available, true) ? "active" : "suspended"} locale={locale}/></td><td>{dateLabel(product.price_quantity_updated_at, locale)}</td><td><div className="table-actions"><button type="button" onClick={() => edit(product)} title={locale === "ar" ? "تعديل" : "Edit"}><Icon name="edit" size={17}/></button>{bool(product.is_active, true) ? <button className="danger" type="button" onClick={() => void deactivate(text(product.id))} title={locale === "ar" ? "إيقاف" : "Disable"}><Icon name="trash" size={17}/></button> : null}</div></td></tr>)}</tbody></table></div>
        )}
      </PortalPanel>

      {showEditor ? <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEditor(false); }}><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="product-editor-title"><header><div><span className="eyebrow"><Icon name="box" size={17}/>{form.id ? (locale === "ar" ? "تعديل منتج" : "Edit product") : (locale === "ar" ? "منتج جديد" : "New product")}</span><h2 id="product-editor-title">{locale === "ar" ? "بيانات المنتج" : "Product details"}</h2></div><button className="icon-button" type="button" onClick={() => setShowEditor(false)} aria-label={locale === "ar" ? "إغلاق" : "Close"}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submit}><div className="form-grid two"><label className="span-two">{locale === "ar" ? "اسم المنتج" : "Product name"}<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label>{locale === "ar" ? "القسم" : "Category"}<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">{locale === "ar" ? "اختر القسم" : "Choose category"}</option>{categories.map((category) => <option key={text(category.id)} value={text(category.id)}>{text(locale === "ar" ? category.name_ar : category.name_en)}</option>)}</select></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}/></label><label>{locale === "ar" ? "السعر" : "Price"}<input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input required type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })}/></label><label>{locale === "ar" ? "الماركة" : "Brand"}<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })}/></label><label>{locale === "ar" ? "المقاس" : "Size"}<input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })}/></label><label>{locale === "ar" ? "اللون" : "Color"}<input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })}/></label><label>{locale === "ar" ? "الوزن بالكيلوجرام" : "Weight in kg"}<input type="number" min="0" step="0.01" value={form.weightInKg} onChange={(event) => setForm({ ...form, weightInKg: event.target.value })}/></label></div><div className="upload-field"><div className="upload-preview">{form.imageUrl ? <img src={form.imageUrl} alt={locale === "ar" ? "معاينة المنتج" : "Product preview"}/> : <Icon name="upload" size={30}/>}</div><div><strong>{locale === "ar" ? "صورة المنتج" : "Product image"}</strong><p>{locale === "ar" ? "JPEG أو PNG أو WebP بحد أقصى 10 ميجابايت." : "JPEG, PNG, or WebP up to 10 MB."}</p><label className="button secondary compact">{uploading ? `${uploading}%` : (locale === "ar" ? "اختيار صورة" : "Choose image")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading > 0} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }}/></label></div></div><div className="switch-grid"><label className="switch-row"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })}/><span><strong>{locale === "ar" ? "متاح حاليًا" : "Currently available"}</strong></span></label><label className="switch-row"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })}/><span><strong>{locale === "ar" ? "منتج فعّال" : "Active product"}</strong></span></label></div><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setShowEditor(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ المنتج" : "Save product")}</button></div></form></section></div> : null}
    </div>
  );
}
