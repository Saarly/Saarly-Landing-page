"use client";
import { useRef, useState } from "react";
import { portalPost, portalUpload } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";
import { readSpreadsheet, spreadsheetProducts } from "@/lib/xlsx-lite";

export function ImportsSection({ payload, locale, refresh, notify }: SectionProps) {
  const batches = rows(payload.data.batches), categories = rows(payload.data.categories);
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false);
  async function importFile(file: File) {
    setBusy(true);
    try {
      const matrix = await readSpreadsheet(file);
      const parsed = spreadsheetProducts(matrix, categories.map((category) => ({ id: text(category.id), ar: text(category.name_ar), en: text(category.name_en) })));
      if (!parsed.length) throw new Error("spreadsheet_has_no_valid_products");
      const uploaded = await portalUpload("product-import", file);
      const result = row(await portalPost("import_products", { items: parsed, fileName: file.name, source: "excel", sourcePath: uploaded.path }));
      notify(locale === "ar" ? `تم اعتماد ${numberValue(result.imported)} منتج.` : `${numberValue(result.imported)} products approved.`, "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "import_failed", "error"); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return <PortalPanel title={locale === "ar" ? "استيراد المنتجات" : "Product imports"} subtitle={locale === "ar" ? "ارفع CSV أو XLSX؛ النظام يحتفظ بالملف وسجل الصفوف قبل اعتماد المنتجات." : "Upload CSV or XLSX; the system keeps the file and row history before approving products."} action={<><input className="sr-only" ref={ref} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }}/><button className="button primary compact" disabled={busy} onClick={() => ref.current?.click()}>{busy ? (locale === "ar" ? "جارٍ الاستيراد" : "Importing") : (locale === "ar" ? "رفع ملف" : "Upload file")}</button></>}>
    {batches.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "المصدر" : "Source"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "الصفوف الصحيحة" : "Valid rows"}</th><th>{locale === "ar" ? "الأخطاء" : "Errors"}</th></tr></thead><tbody>{batches.map((batch: PortalRow) => { const ai = row(batch.ai_result); return <tr key={text(batch.id)}><td>{dateLabel(batch.created_at, locale)}</td><td>{text(batch.source, locale === "ar" ? "ملف" : "File")}</td><td><StatusBadge value={batch.status} locale={locale}/></td><td>{numberValue(ai.valid_rows)}</td><td>{numberValue(ai.error_rows)}</td></tr>; })}</tbody></table></div> : <EmptyState title={locale === "ar" ? "لا توجد عمليات استيراد" : "No imports yet"} body={locale === "ar" ? "ارفع أول ملف منتجات من الزر بالأعلى." : "Upload the first product file using the button above."}/>} 
  </PortalPanel>;
}
