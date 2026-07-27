type ZipEntry = { name: string; method: number; compressedSize: number; localOffset: number };

function findEocd(view: DataView) {
  const min = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("xlsx_zip_directory_not_found");
}

function zipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("xlsx_invalid_central_directory");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error("xlsx_invalid_local_header");
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const bytes = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.method === 0) return bytes;
  if (entry.method !== 8) throw new Error("xlsx_unsupported_compression");
  if (typeof DecompressionStream === "undefined") throw new Error("xlsx_browser_decompression_unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function columnIndex(reference: string) {
  const letters = reference.replace(/[^A-Z]/gi, "").toUpperCase();
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function xmlText(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function sharedStrings(document: Document | null) {
  if (!document) return [] as string[];
  return [...document.querySelectorAll("si")].map((item) => [...item.querySelectorAll("t")].map((node) => node.textContent ?? "").join(""));
}

function parseSheet(document: Document, shared: string[]) {
  const result: string[][] = [];
  for (const rowNode of document.querySelectorAll("sheetData > row")) {
    const row: string[] = [];
    for (const cell of rowNode.querySelectorAll(":scope > c")) {
      const index = columnIndex(cell.getAttribute("r") ?? "A1");
      const type = cell.getAttribute("t") ?? "";
      const raw = cell.querySelector("v")?.textContent ?? cell.querySelector("is t")?.textContent ?? "";
      row[index] = type === "s" ? shared[Number(raw)] ?? "" : raw;
    }
    result.push(row.map((value) => value ?? ""));
  }
  return result;
}

function parseDelimited(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value.trim()); value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function readSpreadsheet(file: File) {
  if (/\.csv$|\.tsv$/i.test(file.name) || file.type.includes("csv") || file.type.startsWith("text/")) {
    return parseDelimited(await file.text());
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error("unsupported_spreadsheet_format");
  const buffer = await file.arrayBuffer();
  const entries = zipEntries(buffer);
  const decoder = new TextDecoder();
  const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const sheetEntry = entries.find((entry) => entry.name === "xl/worksheets/sheet1.xml") ?? entries.find((entry) => entry.name.startsWith("xl/worksheets/sheet"));
  if (!sheetEntry) throw new Error("xlsx_sheet_not_found");
  const sharedDoc = sharedEntry ? xmlText(decoder.decode(await unzipEntry(buffer, sharedEntry))) : null;
  const sheetDoc = xmlText(decoder.decode(await unzipEntry(buffer, sheetEntry)));
  return parseSheet(sheetDoc, sharedStrings(sharedDoc));
}

function normalizeHeader(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  const map: Record<string, string> = {
    "name": "name", "product": "name", "product name": "name", "اسم": "name", "اسم المنتج": "name", "المنتج": "name",
    "price": "price", "السعر": "price",
    "quantity": "quantity", "qty": "quantity", "الكمية": "quantity",
    "unit": "unit", "الوحدة": "unit",
    "brand": "brand", "الماركة": "brand", "العلامة التجارية": "brand",
    "size": "size", "المقاس": "size",
    "color": "color", "اللون": "color",
    "category id": "categoryId", "category": "category", "القسم": "category", "معرف القسم": "categoryId",
  };
  return map[normalized] ?? normalized.replace(/\s+/g, "");
}

export function spreadsheetProducts(rows: string[][], categories: Array<{ id: string; ar: string; en: string }>) {
  if (rows.length < 2) throw new Error("spreadsheet_has_no_data_rows");
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) => {
    const item: Record<string, unknown> = {};
    headers.forEach((header, index) => { if (header) item[header] = values[index] ?? ""; });
    if (!item.categoryId && item.category) {
      const needle = String(item.category).trim().toLowerCase();
      item.categoryId = categories.find((category) => category.ar.trim().toLowerCase() === needle || category.en.trim().toLowerCase() === needle)?.id ?? "";
    }
    return {
      name: String(item.name ?? "").trim(),
      price: Number(String(item.price ?? "0").replace(/[^0-9.-]/g, "")) || 0,
      quantity: Number(String(item.quantity ?? "0").replace(/[^0-9.-]/g, "")) || 0,
      unit: String(item.unit ?? "قطعة").trim() || "قطعة",
      brand: String(item.brand ?? "").trim(),
      size: String(item.size ?? "").trim(),
      color: String(item.color ?? "").trim(),
      categoryId: String(item.categoryId ?? "").trim(),
    };
  }).filter((item) => item.name.length >= 2);
}
