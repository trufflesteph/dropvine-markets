"use client";

import { useState } from "react";

import { vendorCategories } from "@/lib/vendor-categories";
import type { CsvImportResult } from "./actions";

type Props = { marketId: string; action: (previous: CsvImportResult | null, formData: FormData) => Promise<CsvImportResult> };
const columns = ["business_name", "category", "booth_label", "map_x", "map_y", "dropvine_direct_url", "photo_url", "blurb", "external_url"] as const;
type CsvRow = { [key in typeof columns[number]]: string } & { errors: string[] };

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') { if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && input[index + 1] === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) ?? [];
  return rows.filter((values) => values.some(Boolean)).map((values) => {
    const parsed = Object.fromEntries(columns.map((column) => [column, values[headers.indexOf(column)]?.trim() ?? ""])) as unknown as CsvRow;
    const errors: string[] = [];
    if (!parsed.business_name) errors.push("Missing business name"); if (!parsed.category) errors.push("Missing category");
    else if (!vendorCategories.includes(parsed.category as (typeof vendorCategories)[number])) errors.push("Invalid category");
    for (const coordinate of ["map_x", "map_y"] as const) if (parsed[coordinate] && (!Number.isFinite(Number(parsed[coordinate])) || Number(parsed[coordinate]) < 0 || Number(parsed[coordinate]) > 100)) errors.push(`${coordinate} must be 0-100`);
    for (const urlField of ["dropvine_direct_url", "photo_url", "external_url"] as const) if (parsed[urlField]) { try { const url = new URL(parsed[urlField]); if (!/^https?:$/.test(url.protocol)) errors.push(`${urlField} is malformed`); } catch { errors.push(`${urlField} is malformed`); } }
    return { ...parsed, errors };
  });
}

export default function CsvVendorImport({ marketId, action }: Props) {
  const [rows, setRows] = useState<CsvRow[]>([]); const [result, setResult] = useState<CsvImportResult | null>(null); const [error, setError] = useState<string | null>(null);
  async function chooseFile(file: File | undefined) { setResult(null); setError(null); if (!file) { setRows([]); return; } setRows(parseCsv(await file.text())); }
  return <div className="csv-vendor-import order-first border border-black/10 bg-white/60 p-4"><h3 className="font-medium">Import from CSV</h3><p className="mt-1 text-sm text-black/60">Required columns: business_name and category. Rows with warnings will be skipped.</p><input accept=".csv,text/csv" className="mt-3 text-sm" type="file" onChange={(event) => { void chooseFile(event.target.files?.[0]); }} />
    {rows.length ? <form action={async (formData) => { try { const imported = await action(null, formData); setResult(imported); setRows([]); } catch (caught) { setError(caught instanceof Error ? caught.message : "Import failed"); } }} className="mt-4"><input name="market_id" type="hidden" value={marketId} /><input name="rows" type="hidden" value={JSON.stringify(rows)} /><div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-xs"><thead><tr>{columns.map((column) => <th className="border-b px-2 py-2 font-medium" key={column}>{column}</th>)}<th className="border-b px-2 py-2">Status</th></tr></thead><tbody>{rows.map((row, index) => <tr className={row.errors.length ? "bg-red-50" : undefined} key={index}>{columns.map((column) => <td className="max-w-40 border-b px-2 py-2 align-top" key={column}>{row[column]}</td>)}<td className="border-b px-2 py-2 align-top text-red-700">{row.errors.length ? row.errors.join(", ") : "Ready"}</td></tr>)}</tbody></table></div><button className="mt-4 bg-black px-3 py-2 text-sm text-white" type="submit">Import {rows.length} rows</button></form> : null}
    {result ? <p className="mt-3 border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-800">Imported {result.created} new vendors, linked {result.existing} existing vendors, skipped {result.skipped} rows with errors.</p> : null}{error ? <p className="mt-3 border border-red-700/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
  </div>;
}