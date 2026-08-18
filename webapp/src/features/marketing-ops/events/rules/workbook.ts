// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Reading the uploaded workbook — in the browser.
//
// Parsing here means the grid appears the moment the file is dropped, with no upload
// round trip, and the attendee data never leaves the machine until the user chooses to
// save. exceljs is loaded on demand so it costs nothing until someone actually uploads.
//
// **Nothing is guessed, and nothing arrives undeclared.** A sheet is imported when its
// tab name IS a member status; a column is imported when its heading IS one an admin
// defined in Settings. Anything else is left in the workbook.
//
// Settings is therefore the contract, not a suggestion. An RMM can keep whatever working
// columns they like in their own sheet — notes to themselves, a column of ticks — and
// none of it reaches MOP, gets validated, or lands in the Pardot CSV unless somebody
// declared it. The alternative, which this replaces, absorbed every stray heading as
// free text: it made the settings page pointless and pushed columns into the CSV under
// raw sheet headings Pardot has no hope of mapping.
//
// The cost of that strictness is that a deviating tab or column imports nothing, so the
// parse reports every sheet it skipped, every heading it passed over, and how many
// values each would have carried. Silence was the bug; refusing quietly would be the
// same bug wearing a different hat.
//
// **The trap this module still exists to avoid.** The template scaffolds 1100 rows per
// tab, every one pre-filled with defaults and formulas. Ask "does this row have any
// non-empty cell?" and a completely blank template answers "1099 rows". A row counts
// only when one of IDENTITY_FIELDS is filled — a name or an email.

import {
  DROPPED_HEADERS, IDENTITY_FIELDS, liveStatuses, nameKey, slug, statusForSheet,
  type EventsConfig, type Field, type Tab,
} from './schema'
import type { Row } from './validate'

// An event list is a hand-maintained workbook, not a data warehouse. These bound the
// damage from a pathological file; the real template is 1100 rows by ~22 columns.
const MAX_ROWS_PER_SHEET = 5000
const MAX_COLUMNS = 80
/** How far down to hunt for the heading row. Some tabs open with a title and a spacer. */
const HEADER_SEARCH_DEPTH = 10

export class WorkbookError extends Error {}

const DROPPED = new Set(DROPPED_HEADERS.map(nameKey))

export interface ParsedTab {
  tab: Tab
  rows: Row[]
  /** Headings no definition claimed. **Not imported** — Settings is the contract — but
   *  always reported with how many values were passed over, so a renamed column is
   *  noticed rather than absorbed. */
  undefinedHeaders: { header: string; filled: number }[]
  /** Definitions with no matching heading in the sheet. */
  missingHeaders: string[]
  scaffoldingSkipped: number
}

/** A sheet that was not imported, and what it would have cost. */
export interface SkippedSheet {
  name: string
  /** Rows carrying what looks like a person. Zero for a reference or chart tab. */
  rowCount: number
}

export interface ParsedWorkbook {
  tabs: ParsedTab[]
  /** Every sheet whose name is not a member status. The ones with rows are the whole
   *  reason this is reported rather than shrugged off. */
  skipped: SkippedSheet[]
  totalRows: number
}

/** One cell as a trimmed string.
 *
 *  exceljs hands back rich objects: `{ result }` for formulas, `{ richText }` for
 *  styled runs, `{ text }` for hyperlinks, `Date` for dates. Left raw, a phone number
 *  becomes "94112345678" via a float and a hot-lead flag becomes "1.0". */
function clean(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    const v = value as {
      result?: unknown; richText?: { text: string }[]; text?: string; error?: string
      formula?: string; sharedFormula?: string
    }
    if (v.error) return ''                                  // #N/A and friends are not data
    if (v.result !== undefined) return clean(v.result)
    if (v.richText) return v.richText.map(r => r.text).join('').trim()
    if (v.text !== undefined) return String(v.text).trim()
    // A formula whose cached result the file does not carry. Excel stores the last
    // computed value alongside the formula; Google Sheets exports often omit it. There
    // is nothing to read, and falling through used to stringify the object into the
    // literal text "[object Object]", which then travelled as a value.
    if (v.formula !== undefined || v.sharedFormula !== undefined) return ''
    // Any other object is a shape we do not understand, and an unreadable value is
    // better represented as absent than as "[object Object]".
    return ''
  }
  return String(value).trim()
}

/** One sheet as a grid of trimmed strings, indexed `[rowIndex][columnIndex]`, both
 *  0-based.
 *
 *  Reads `row.values` rather than calling `row.getCell(c)` per column, which is not a
 *  micro-optimisation. `getCell` on a column a row does not have **creates** the cell —
 *  it allocates a model and grows the row — so asking 80 columns of ~1100 mostly-sparse
 *  rows across twelve sheets built roughly 180,000 cell objects. That took 11.6 seconds
 *  of blocked main thread, which is why the loading bar appeared to freeze halfway.
 *  `row.values` hands back the sparse array that already exists: 5ms.
 *
 *  `values` is 1-based with a hole at index 0, so column c lands at `cells[c - 1]`. */
function readTable(ws: {
  eachRow: (opts: { includeEmpty: boolean },
            cb: (row: { values: unknown }, rowNumber: number) => void) => void
}): string[][] {
  const table: string[][] = []
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS_PER_SHEET) return
    const values = row.values as unknown[] | undefined
    const cells: string[] = []
    const last = Math.min((values?.length ?? 1) - 1, MAX_COLUMNS)
    for (let c = 1; c <= last; c++) cells.push(clean(values?.[c]))
    table[rowNumber - 1] = cells
  })
  for (let i = 0; i < table.length; i++) if (!table[i]) table[i] = []
  return table
}

/** The heading row: whichever of the first few rows carries the most text. More robust
 *  than "the first row with two non-empty cells", which a title row satisfies. */
function findHeaderRow(table: string[][]): number {
  let best = -1
  let most = 0
  for (let i = 0; i < Math.min(HEADER_SEARCH_DEPTH, table.length); i++) {
    const filled = (table[i] ?? []).filter(Boolean).length
    if (filled > most) { most = filled; best = i }
  }
  return most >= 2 ? best : -1
}

/** How many rows of a skipped sheet look like people rather than scaffolding.
 *
 *  A lead list starts with who the lead is, so a row counts when one of its first few
 *  columns carries something. Approximate on purpose — it exists to put a number on
 *  what a skipped sheet would have cost, and a sheet we did not import has no
 *  definitions to be exact with. */
function looksPopulated(table: string[][], headerRow: number): number {
  if (headerRow < 0) return 0
  let n = 0
  for (const cells of table.slice(headerRow + 1)) {
    if ((cells ?? []).slice(0, 3).some(Boolean)) n++
  }
  return n
}

export async function parseWorkbook(file: File, config: EventsConfig): Promise<ParsedWorkbook> {
  const name = file.name.toLowerCase()
  // A CSV is one unnamed sheet, so it cannot say which member status it is. Refused
  // rather than half-supported.
  if (name.endsWith('.csv')) {
    throw new WorkbookError(
      'CSV files aren’t supported. Upload the .xlsx workbook instead — its tab names are '
      + 'what tell us which rows are Registrants, Booth, Session and so on.')
  }
  if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) {
    throw new WorkbookError('Upload the .xlsx List Import Template.')
  }
  if (!liveStatuses(config).length) {
    throw new WorkbookError(
      'No member statuses are configured, so no tab could be recognised. An admin sets '
      + 'these under Settings → Events.')
  }

  // Loaded here rather than at module scope: exceljs is large and only an upload needs it.
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new WorkbookError('That file could not be opened as a spreadsheet.')
  }

  const out: ParsedWorkbook = { tabs: [], skipped: [], totalRows: 0 }
  const claimed = new Set<Tab>()

  wb.eachSheet(ws => {
    const table = readTable(ws)
    const headerRow = findHeaderRow(table)
    const tab = statusForSheet(config, ws.name)

    // Not a member status — or a second sheet claiming one already taken, which is
    // ambiguous and treated the same way. Counted, never silently dropped.
    if (!tab || claimed.has(tab)) {
      out.skipped.push({ name: ws.name, rowCount: looksPopulated(table, headerRow) })
      return
    }
    claimed.add(tab)

    const parsed = parseTab(tab, table, headerRow, config)
    if (!parsed) {
      out.skipped.push({ name: ws.name, rowCount: looksPopulated(table, headerRow) })
      return
    }
    out.tabs.push(parsed)
    out.totalRows += parsed.rows.length
  })

  const names = liveStatuses(config).map(s => s.name).join(', ')

  if (!out.tabs.length) {
    throw new WorkbookError(
      'None of this workbook’s tabs is a member status. A tab is imported only when it '
      + `is named exactly one of: ${names}.`)
  }

  // A tab matched but nobody came in. Left alone this is the worst outcome the parser
  // has: the caller builds an empty model, the screen falls back to the dropzone, and
  // the person is invited to upload the same file again — with no hint that 198 people
  // were sitting on tabs whose names did not match.
  //
  // The recognised-but-empty tab is why it gets this far: it satisfies the check above
  // while carrying no one.
  if (out.totalRows === 0) {
    const lost = out.skipped.filter(x => x.rowCount > 0)
    const matched = out.tabs.map(t => t.tab).join(', ')

    if (lost.length) {
      // Biggest first, and only the first few. `rowCount` comes from looksPopulated,
      // which is a guess by design — a chart tab of five totals reads as five rows — so
      // the tail is noise, and naming the three worst is what someone acts on. The
      // upload screen already shows which tab names are read, so this does not repeat
      // the rule; it only says which tabs broke it.
      const worst = [...lost].sort((a, b) => b.rowCount - a.rowCount)
      const shown = worst.slice(0, 3).map(x => `“${x.name}” (${x.rowCount})`).join(', ')
      const rest = worst.length - 3
      throw new WorkbookError(
        `Nothing was imported — no tab with rows on it is named as a member status. `
        + `Rows found on: ${shown}${rest > 0 ? `, and ${rest} more` : ''}.`)
    }
    throw new WorkbookError(
      `Nothing was imported — ${matched} is the only tab we read, and it holds only the `
      + `template’s blank rows. A row counts once it has a name or an email.`)
  }

  return out
}

function parseTab(tab: Tab, table: string[][], headerRow: number,
                  config: EventsConfig): ParsedTab | null {
  if (headerRow < 0) return null

  const headings = table[headerRow] ?? []
  const defs = config.fields[tab] ?? []
  const byKey = new Map(defs.map(d => [nameKey(d.header_label), d]))

  /** column index -> the row key its values are stored under */
  const columns = new Map<number, Field>()
  const undefinedHeaders: { header: string; filled: number }[] = []
  const claimed = new Set<string>()

  headings.forEach((raw, index) => {
    const heading = (raw ?? '').trim()
    if (!heading) return
    const key = nameKey(heading)
    // Columns MOP computes, and two the template still carries but nothing reads.
    if (DROPPED.has(key)) return

    const def = byKey.get(key)
    if (def) {
      claimed.add(key)
      // A computed column is mapped so the heading is accounted for, not so its values
      // are read. Skipping `columns` is what keeps the sheet's copy — a stale score, an
      // #N/A, an opt-in method nobody maintains — from landing beside MOP's own.
      if (!def.computed) columns.set(index, slug(def.field_name))
      return
    }
    // No definition claims it, so it is not imported.
    //
    // Settings is the contract: a column reaches MOP, gets validated and lands in the
    // CSV because an admin declared it, and for no other reason. The alternative — which
    // this replaces — took every stray heading in as free text, which made Settings
    // advisory rather than binding and put columns into the Pardot CSV under raw sheet
    // headings that Pardot cannot map.
    //
    // It is a real cost, so it is never silent: the heading is reported with a count of
    // the values passed over. RMMs keep their own working columns in these sheets and
    // that is fine — they simply stay in the sheet.
    const filled = table.slice(headerRow + 1)
      .filter(cells => (cells?.[index] ?? '').trim()).length
    undefinedHeaders.push({ header: heading.replace(/\s+/g, ' '), filled })
  })

  // A computed column absent from the sheet is a non-event — MOP supplies the value
  // either way — so it is not reported as missing.
  const missingHeaders = defs
    .filter(d => !d.computed && !claimed.has(nameKey(d.header_label)))
    .map(d => d.field_name)

  const rows: Row[] = []
  let scaffoldingSkipped = 0
  for (const cells of table.slice(headerRow + 1)) {
    const row: Row = {}
    for (const [index, field] of columns) {
      const value = (cells?.[index] ?? '').trim()
      if (value) row[field] = value
    }
    // The whole point: furniture is not a lead.
    if (IDENTITY_FIELDS.some(f => row[f])) rows.push(row)
    else if (Object.keys(row).length) scaffoldingSkipped++
  }

  return { tab, rows, undefinedHeaders, missingHeaders, scaffoldingSkipped }
}
