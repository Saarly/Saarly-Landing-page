type TemplateCategory = { id?: unknown; name_ar?: unknown; name_en?: unknown };

const encoder = new TextEncoder();

function text(value: unknown, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function escapeXml(value: unknown) {
  return text(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  }[char] ?? char));
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function concat(chunks: Uint8Array[]) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function zip(files: Array<{ name: string; content: string }>) {
  const { dosDate, dosTime } = dosDateTime();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    local.set(nameBytes, 30);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dosTime);
    writeUint16(centralView, 14, dosDate);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint32(centralView, 42, offset);
    centralEntry.set(nameBytes, 46);

    chunks.push(local, data);
    central.push(centralEntry);
    offset += local.length + data.length;
  }

  const centralBytes = concat(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralBytes.length);
  writeUint32(endView, 16, offset);
  return concat([...chunks, centralBytes, end]);
}

function cell(reference: string, value: unknown, style = 0) {
  return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${escapeXml(value)}</t></is></c>`;
}

function columnName(index: number) {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function rowXml(index: number, values: unknown[], style = 0) {
  return `<row r="${index}">${values.map((value, column) => cell(`${columnName(column)}${index}`, value, style)).join("")}</row>`;
}

export function productImportTemplateBlob(locale: "ar" | "en", categories: TemplateCategory[]) {
  const sampleCategory = categories[0]
    ? text(locale === "ar" ? categories[0].name_ar : categories[0].name_en, locale === "ar" ? "أسلاك وكابلات" : "Wires & cables")
    : locale === "ar" ? "أسلاك وكابلات" : "Wires & cables";
  const headers = locale === "ar"
    ? ["اسم المنتج", "الفئة الفرعية", "السعر", "الوحدة", "الكمية", "متاح للبيع", "طريقة التوصيل للمنتج", "وزن الشحن كجم", "العلامة التجارية (اختياري)", "المقاس (اختياري)", "اللون (اختياري)", "رابط الصورة 1", "رابط الصورة 2", "رابط الصورة 3", "ملاحظات"]
    : ["product name", "subcategory", "price", "unit", "quantity", "is available", "delivery pricing method", "shipping weight kg", "brand (optional)", "size (optional)", "color (optional)", "image 1 url", "image 2 url", "image 3 url", "notes"];
  const sample = locale === "ar"
    ? ["مثال: سلك نحاس 2 مم", sampleCategory, "125.5", "لفة", "20", "نعم", "ثابت", "", "السويدي", "2 mm", "أحمر", "https://example.com/product-main.jpg", "https://example.com/product-side.jpg", "", "احذف صف المثال قبل الرفع"]
    : ["Example: 2mm copper wire", sampleCategory, "125.5", "roll", "20", "yes", "flat", "", "Example brand", "2 mm", "red", "https://example.com/product-main.jpg", "https://example.com/product-side.jpg", "", "Remove this sample row before importing"];

  const productsSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="${locale === "ar" ? "1" : "0"}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${[24, 22, 12, 14, 12, 14, 24, 18, 22, 16, 16, 34, 34, 34, 38].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
  <sheetData>${rowXml(1, headers, 1)}${rowXml(2, sample)}</sheetData>
  <autoFilter ref="A1:O2"/>
</worksheet>`;

  const categoryHeaders = locale === "ar" ? ["الفئة الفرعية", "Subcategory", "ID"] : ["Subcategory", "الفئة الفرعية", "ID"];
  const categoryRows = categories.map((category, index) => rowXml(index + 2, [
    locale === "ar" ? text(category.name_ar) : text(category.name_en),
    locale === "ar" ? text(category.name_en) : text(category.name_ar),
    text(category.id),
  ])).join("");
  const categoriesSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="${locale === "ar" ? "1" : "0"}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="40" customWidth="1"/></cols>
  <sheetData>${rowXml(1, categoryHeaders, 1)}${categoryRows}</sheetData>
  ${categories.length ? `<autoFilter ref="A1:C${categories.length + 1}"/>` : ""}
</worksheet>`;

  const instructions = locale === "ar" ? [
    "تعليمات قالب منتجات سعرلي",
    "املأ ورقة products فقط، بصف واحد لكل منتج.",
    "الأعمدة الإجبارية: اسم المنتج، الفئة الفرعية، السعر، الوحدة.",
    "روابط الصور اختيارية، بحد أقصى 3 روابط للمنتج.",
    "عمود متاح للبيع يقبل: نعم/لا. طريقة التوصيل تقبل: ثابت، وزن، منطقة. اكتب وزن الشحن بالكيلو عند اختيار وزن.",
    "إذا لم تتوفر روابط للصور، ارفع المنتجات ثم عدّل المنتج وأضف الصور من البوابة أو التطبيق.",
    "لا تغيّر أسماء الأعمدة في الصف الأول.",
  ] : [
    "Saarly product template instructions",
    "Fill the products sheet only, one row per product.",
    "Required columns: product name, subcategory, price, and unit.",
    "Image links are optional, with up to 3 links per product.",
    "Availability accepts yes/no. Delivery method accepts flat, weight, or zone. Enter shipping weight in kilograms when using weight pricing.",
    "If image URLs are unavailable, import the products then edit each product to add images from the portal or app.",
    "Do not rename the first-row columns.",
  ];
  const instructionsSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" rightToLeft="${locale === "ar" ? "1" : "0"}"/></sheetViews>
  <cols><col min="1" max="1" width="105" customWidth="1"/></cols>
  <sheetData>${instructions.map((line, index) => rowXml(index + 1, [line], index === 0 ? 1 : 0)).join("")}</sheetData>
</worksheet>`;

  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="products" sheetId="1" r:id="rId1"/><sheet name="${locale === "ar" ? "الفئات الفرعية" : "subcategories"}" sheetId="2" r:id="rId2"/><sheet name="${locale === "ar" ? "تعليمات" : "instructions"}" sheetId="3" r:id="rId3"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5F9C42"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", content: productsSheet },
    { name: "xl/worksheets/sheet2.xml", content: categoriesSheet },
    { name: "xl/worksheets/sheet3.xml", content: instructionsSheet },
  ];
  return new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadProductImportTemplate(locale: "ar" | "en", categories: TemplateCategory[]) {
  const blob = productImportTemplateBlob(locale, categories);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = locale === "ar" ? "saarly-products-template-ar.xlsx" : "saarly-products-template-en.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
