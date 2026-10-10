export type CsvEncoding = "utf-8" | "windows-1252";

// Windows-1252 differs from Latin-1 only in 0x80–0x9F. This table is explicit because some runtimes
// (Node 22, for one) decode "windows-1252" as plain Latin-1, which turns 0x96 into the control character U+0096.
// Positions 0x81, 0x8D, 0x8F, 0x90, and 0x9D are unassigned and stay as control characters.
const windows1252High = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";

function windows1252Character(code: number) {
  return code >= 0x80 && code <= 0x9f ? windows1252High[code - 0x80] : String.fromCharCode(code);
}

function decodeWindows1252(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += windows1252Character(byte);
  return text;
}

// Decode an uploaded CSV. Valid UTF-8 wins; anything else (e.g. Excel "CSV" on Windows) is read as Windows-1252.
// The byte order mark is stripped and CRLF / CR line endings are normalized to LF.
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): { text: string; encoding: CsvEncoding } {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;
  let encoding: CsvEncoding;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(view);
    encoding = "utf-8";
  } catch {
    text = decodeWindows1252(view);
    encoding = "windows-1252";
  }
  return { text: text.replace(/^﻿/, "").replace(/\r\n?/g, "\n"), encoding };
}

// C1 controls (U+0080–U+009F) in text are almost always Windows-1252 punctuation that was decoded as Latin-1,
// e.g. U+0096 is really an en dash. Map those back; strip every other control character.
// Line breaks and tabs inside a field become spaces, then runs of spaces collapse.
export function cleanImportText(value: string) {
  return value
    .replace(/[\u0080-\u009F]/g, (character) => windows1252Character(character.charCodeAt(0)))
    .replace(/[\t\n\r]/g, " ")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

// RFC 4180-style parsing: quoted cells may contain commas, doubled quotes, and line breaks.
export function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if (character === "\n" && !quoted) { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Header-keyed records with every cell cleaned. Blank lines are dropped.
export function parseCsvRecords<Column extends string>(input: string, columns: readonly Column[]): Record<Column, string>[] {
  const rows = parseCsvRows(input);
  const headers = rows.shift()?.map((header) => cleanImportText(header).toLowerCase()) ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(columns.map((column) => [column, cleanImportText(values[headers.indexOf(column)] ?? "")])) as Record<Column, string>);
}
