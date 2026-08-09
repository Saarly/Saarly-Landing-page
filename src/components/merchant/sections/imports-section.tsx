"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, importSourceLabel, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";
import { downloadProductImportTemplate } from "@/lib/product-import-template";
import { readSpreadsheet, spreadsheetProducts } from "@/lib/xlsx-lite";

type Draft = {
  rowNumber: number;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  brand: string;
  size: string;
  color: string;
  categoryId: string;
  isAvailable: boolean;
  shippingWeightKg: number;
  deliveryPricingMethod: string;
  imageUrls: string[];
  notes: string;
};

function errors(item: Draft) {
  const result: string[] = [];
  if (item.name.trim().length < 2) result.push("missing_name");
  if (!Number.isFinite(item.price) || item.price <= 0) result.push("invalid_price");
  if (!item.unit.trim()) result.push("missing_unit");
  if (!Number.isFinite(item.quantity) || item.quantity < 0) result.push("invalid_quantity");
  if (!item.categoryId) result.push("missing_category");
  return result;
}

function errorLabel(code: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = {
    missing_name: ["اسم المنتج مطلوب", "Product name is required"],
    invalid_price: ["السعر يجب أن يكون أكبر من صفر", "Price must be greater than zero"],
    missing_unit: ["الوحدة مطلوبة", "Unit is required"],
    invalid_quantity: ["الكمية غير صحيحة", "Quantity is invalid"],
    missing_category: ["القسم مطلوب", "Category is required"],
  };
  return (labels[code] ?? ["يوجد خطأ في هذا الصف", "This row needs correction"])[locale === "ar" ? 0 : 1];
}

export function ImportsSection({ payload, locale, refresh, notify }: SectionProps) {
  const batches = rows(payload.data.batches);
  const categories = rows(payload.data.categories);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const stats = useMemo(() => ({
    valid: drafts.filter((item) => errors(item).length === 0).length,
    invalid: drafts.filter((item) => errors(item).length > 0).length,
  }), [drafts]);

  async function previewFile(nextFile: File) {
    setBusy(true);
    try {
      const matrix = await readSpreadsheet(nextFile);
      const parsed = spreadsheetProducts(
        matrix,
        categories.map((category) => ({ id: text(category.id), ar: text(category.name_ar), en: text(category.name_en) })),
        { includeInvalidRows: true },
      );
      if (!parsed.length) throw new Error("spreadsheet_has_no_data_rows");
      setFile(nextFile);
      setDrafts(parsed.map((item, index) => ({ ...item, rowNumber: index + 2 })));
      notify(locale === "ar" ? "تمت قراءة الملف. راجع كل الصفوف قبل الاعتماد." : "The file is ready. Review every row before approval.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "import_preview_failed", "error"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  function patchRow(rowNumber: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((item) => item.rowNumber === rowNumber ? { ...item, ...patch } : item));
  }

  function addRow() {
    const next = drafts.length ? Math.max(...drafts.map((item) => item.rowNumber)) + 1 : 2;
    setDrafts((current) => [...current, { rowNumber: next, name: "", price: 0, quantity: 0, unit: locale === "ar" ? "قطعة" : "piece", brand: "", size: "", color: "", categoryId: "", isAvailable: true, shippingWeightKg: 0, deliveryPricingMethod: "flat", imageUrls: [], notes: "" }]);
  }

  async function approve() {
    if (!file || !drafts.length) return;
    if (stats.invalid > 0) { notify(locale === "ar" ? "أصلح الصفوف التي عليها أخطاء قبل الاعتماد." : "Fix rows with errors before approval.", "error"); return; }
    setBusy(true);
    try {
      const uploaded = await portalUpload("product-import", file);
      const result = row(await portalPost("import_products", {
        items: drafts.map((item) => ({
          rowNumber: item.rowNumber,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          brand: item.brand,
          size: item.size,
          color: item.color,
          categoryId: item.categoryId,
          isAvailable: item.isAvailable,
          shippingWeightKg: item.shippingWeightKg,
          deliveryPricingMethod: item.deliveryPricingMethod,
          imageUrls: item.imageUrls,
          notes: item.notes,
        })),
        fileName: file.name,
        source: "excel",
        sourcePath: uploaded.path,
      }));
      notify(locale === "ar" ? `تم اعتماد ${numberValue(result.imported, drafts.length)} منتج.` : `${numberValue(result.imported, drafts.length)} products approved.`, "success");
      setFile(null); setDrafts([]); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "import_failed", "error"); }
    finally { setBusy(false); }
  }

  return <div className="portal-section-stack">
    <PortalPanel title={locale === "ar" ? "استيراد المنتجات" : "Product imports"} subtitle={locale === "ar" ? "نزّل القالب ثم ارفع ملف جدول بيانات. مثل التطبيق، لا يتم اعتماد المنتجات قبل مراجعة الصفوف وتصحيح الأخطاء." : "Download the template, then upload a spreadsheet file. Like the app, products are not approved until rows are reviewed and fixed."} action={<><input className="sr-only" ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void previewFile(selected); }}/><button className="button secondary compact" type="button" onClick={() => downloadProductImportTemplate(locale, categories)}><Icon name="download" size={17}/>{locale === "ar" ? "تنزيل القالب" : "Download template"}</button><button className="button primary compact" disabled={busy} onClick={() => inputRef.current?.click()}><Icon name="upload" size={17}/>{busy ? (locale === "ar" ? "جارٍ القراءة" : "Reading") : (locale === "ar" ? "رفع جدول بيانات" : "Upload spreadsheet")}</button></>}>
      {!file ? <EmptyState icon="upload" title={locale === "ar" ? "لا يوجد ملف للمراجعة" : "No file under review"} body={locale === "ar" ? "ارفع ملف المنتجات لعرض الصفوف هنا قبل الاعتماد." : "Upload a product file to review its rows here before approval."}/> : <div className="import-preview-shell">
        <header className="import-preview-header"><div><strong>{file.name}</strong><small>{locale === "ar" ? `${stats.valid} صحيح · ${stats.invalid} يحتاج تعديل` : `${stats.valid} valid · ${stats.invalid} need fixes`}</small></div><button className="icon-button" type="button" aria-label={locale === "ar" ? "إلغاء المعاينة" : "Clear preview"} onClick={() => { setFile(null); setDrafts([]); }}><Icon name="close"/></button></header>
        <div className="inline-actions"><span className="status-badge active">{locale === "ar" ? `صحيح: ${stats.valid}` : `Valid: ${stats.valid}`}</span>{stats.invalid ? <span className="status-badge rejected">{locale === "ar" ? `أخطاء: ${stats.invalid}` : `Errors: ${stats.invalid}`}</span> : null}<button className="button secondary compact" type="button" onClick={addRow}><Icon name="plus" size={16}/>{locale === "ar" ? "إضافة صف" : "Add row"}</button></div>
        <div className="import-review-list">{drafts.map((item) => { const rowErrors = errors(item); return <details className={`import-review-row ${rowErrors.length ? "has-errors" : "valid"}`} key={item.rowNumber} open={rowErrors.length > 0}><summary><div><strong>{locale === "ar" ? `الصف ${item.rowNumber}: ${item.name || "منتج بدون اسم"}` : `Row ${item.rowNumber}: ${item.name || "Unnamed product"}`}</strong><small>{rowErrors.length ? rowErrors.map((code) => errorLabel(code, locale)).join(" · ") : (locale === "ar" ? "الصف جاهز" : "Row ready")}</small></div><Icon name={rowErrors.length ? "info" : "check"}/></summary>
          <div className="portal-form import-row-form">
            {rowErrors.length ? <Notice tone="danger">{rowErrors.map((code) => errorLabel(code, locale)).join(" · ")}</Notice> : null}
            <div className="form-grid three">
              <label>{locale === "ar" ? "اسم المنتج" : "Product name"}<input value={item.name} onChange={(event) => patchRow(item.rowNumber, { name: event.target.value })}/></label>
              <label>{locale === "ar" ? "السعر" : "Price"}<input type="number" min="0.01" step="0.01" value={item.price || ""} onChange={(event) => patchRow(item.rowNumber, { price: Number(event.target.value) })}/></label>
              <label>{locale === "ar" ? "الوحدة" : "Unit"}<input value={item.unit} onChange={(event) => patchRow(item.rowNumber, { unit: event.target.value })}/></label>
              <label>{locale === "ar" ? "الكمية" : "Quantity"}<input type="number" min="0" step="any" value={item.quantity} onChange={(event) => patchRow(item.rowNumber, { quantity: Number(event.target.value) })}/></label>
              <label>{locale === "ar" ? "العلامة التجارية" : "Brand"}<input value={item.brand} onChange={(event) => patchRow(item.rowNumber, { brand: event.target.value })}/></label>
              <label>{locale === "ar" ? "المقاس / السعة" : "Size / capacity"}<input value={item.size} onChange={(event) => patchRow(item.rowNumber, { size: event.target.value })}/></label>
              <label>{locale === "ar" ? "اللون" : "Color"}<input value={item.color} onChange={(event) => patchRow(item.rowNumber, { color: event.target.value })}/></label>
              <label>{locale === "ar" ? "القسم" : "Category"}<select value={item.categoryId} onChange={(event) => patchRow(item.rowNumber, { categoryId: event.target.value })}><option value="">—</option>{categories.map((category) => <option key={text(category.id)} value={text(category.id)}>{text(locale === "ar" ? category.name_ar : category.name_en)}</option>)}</select></label>
            </div>
            <div className="form-actions"><button className="button danger-button" type="button" onClick={() => setDrafts((current) => current.filter((entry) => entry.rowNumber !== item.rowNumber))}><Icon name="trash" size={16}/>{locale === "ar" ? "حذف الصف" : "Delete row"}</button><span className="button secondary compact" aria-disabled="true"><Icon name="check" size={16}/>{locale === "ar" ? "التعديلات محفوظة في المعاينة" : "Preview changes saved"}</span></div>
          </div>
        </details>; })}</div>
        <div className="form-actions import-approve-actions"><button className="button secondary" type="button" onClick={() => { setFile(null); setDrafts([]); }}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={busy || !drafts.length || stats.invalid > 0} onClick={() => void approve()}><Icon name="check"/>{busy ? (locale === "ar" ? "جارٍ الاعتماد" : "Approving") : (locale === "ar" ? "اعتماد المنتجات" : "Approve products")}</button></div>
      </div>}
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "سجل الاستيراد" : "Import history"}>
      {batches.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "المصدر" : "Source"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "الصفوف الصحيحة" : "Valid rows"}</th><th>{locale === "ar" ? "الأخطاء" : "Errors"}</th></tr></thead><tbody>{batches.map((batch: PortalRow) => { const ai = row(batch.ai_result); return <tr key={text(batch.id)}><td>{dateLabel(batch.created_at, locale)}</td><td>{importSourceLabel(batch.source, locale)}</td><td><StatusBadge value={batch.status} locale={locale}/></td><td>{numberValue(ai.valid_rows)}</td><td>{numberValue(ai.error_rows)}</td></tr>; })}</tbody></table></div> : <EmptyState title={locale === "ar" ? "لا توجد عمليات استيراد" : "No imports yet"} body={locale === "ar" ? "أول عملية اعتماد هتظهر هنا." : "The first approved import will appear here."}/>} 
    </PortalPanel>
  </div>;
}
