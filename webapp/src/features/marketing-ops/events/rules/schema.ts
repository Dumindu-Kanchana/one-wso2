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

// The rules that stay in code, and how to read the configuration that no longer does.
//
// **Nothing about the template's shape lives here.** The member statuses — which are
// also the tab names a workbook must use — and each status' columns are rows in the
// database, edited by an admin under Settings → Events.
//
// Two tables of hardcoded spellings used to stand in for that, each guessing at
// meaning. A tab called "Event attendees" matched none of them and 166 people were
// dropped in silence; a renamed column is quieter still, because the row count
// reconciles and only the values go missing.
//
// What remains is what is not shape but rule: which fields identify a person, what MOP
// computes, and the reference-driven checks a flat pick list cannot express.

/** A member status, and therefore a tab name a workbook may use. Open, because the set
 *  is configuration. */
export type Tab = string

/** A field's key on a row. Open, for the same reason. */
export type Field = string

export type DataType = 'text' | 'picklist'

export interface MemberStatus {
  name: string
  /** What one row on this tab is worth. */
  score: number
  enabled: boolean
}

/** One configured column of one member status. */
export interface FieldDef {
  /** What the sheet's heading says, verbatim — instructions, stray spaces and all. */
  header_label: string
  /** What MOP shows: the grid column and the CSV heading. */
  field_name: string
  data_type: DataType
  /** Optional regular expression, text columns only. An email column is this, not a
   *  type of its own. */
  pattern?: string | null
  picklist: string[]
  mandatory: boolean
  /** MOP fills this column in; the sheet's heading is mapped so it is visibly accounted
   *  for, but its values are never read. `field_name` holds the computed key, and the
   *  label comes from COMPUTED_LABEL rather than from whoever edited the settings. */
  computed?: boolean
}

export type FieldDefs = Record<string, FieldDef[]>

/** Everything the browser needs before a workbook means anything. */
export interface EventsConfig {
  statuses: MemberStatus[]
  fields: FieldDefs
}

export const EMPTY_CONFIG: EventsConfig = { statuses: [], fields: {} }

// ---- keys -------------------------------------------------------------------------------------

/** The key a value is stored under, derived from the name MOP shows.
 *
 *  Rows are keyed by this rather than by the sheet's heading, so rewording the heading
 *  in the template changes nothing about stored data. */
export function slug(fieldName: string): Field {
  return (fieldName ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** How a tab name or a column heading is compared: case folded, surrounding space
 *  trimmed, internal runs of whitespace collapsed.
 *
 *  NOT fuzzy matching — "Event attendees" still does not match "Attendees". It exists
 *  because the real template carries characters nobody can see or type: a trailing
 *  space on "Country " across all five tabs, a line break inside Session's "States",
 *  and some five hundred trailing newlines on "Assigned AM". Mirrors `match_key` in the
 *  database; keep the two in step. */
export function nameKey(name: string): string {
  return (name ?? '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}

// ---- the rules that stay in code ----------------------------------------------------------------

/** Fields carrying a rule beyond their configured type.
 *
 *  Identified by their key, which comes from the name an admin chose. Renaming one does
 *  not break the import — the column still works as its declared type — but it does
 *  switch off the extra rule. */
export const SPECIAL = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  /** Checked against the reference country list, not a pick list. */
  country: 'country',
  /** Allowed values depend on the row's country, which a flat list cannot express. */
  state: 'state',
  /** Compliance, not data quality: only Confirmed may be imported. Backed by the
   *  server's invariant check, which no setting can switch off. */
  optInStatus: 'opt_in_status',
  /** Renamed in Settings to "Event Hot Lead" (2026-08-13). These keys are derived from
   *  the name an admin chose, so a rename here is a rename there — and forgetting it
   *  switches the rule below off in silence rather than breaking anything visibly. */
  hotLead: 'event_hot_lead',
  notes: 'lead_notes',
} as const

/** A row is real only if one of these is filled — everything else on a template row may
 *  be scaffolding. The single most important rule in the parser: the template ships 1100
 *  pre-filled rows per tab, so "has any non-empty cell" reads a blank template as 1099
 *  attendees. */
export const IDENTITY_FIELDS: Field[] = [SPECIAL.firstName, SPECIAL.lastName, SPECIAL.email]

/** The two states a lead's consent can be in. Only `Confirmed` may be imported; Pending
 *  is an honest record of someone who has not consented yet and blocks submission.
 *  Neither is ever auto-corrected to the other — asserting consent is a person's act. */
export const OPT_IN_STATUS_VALUES = ['Confirmed', 'Pending']
export const OPT_IN_IMPORTABLE = 'Confirmed'

/** How the whole list should land in Salesforce. Chosen once when the submission is
 *  started, then stamped on every row, because Pardot imports a flat file. */
export const LEAD_STATE_VALUES = ['New', 'MQL']

/** Headings the template carries that are not columns in any sense.
 *
 *  An unrecognised heading is otherwise kept as free text, which is right for a column
 *  marketing added and forgot to define. These two are plumbing for formulas that have
 *  never produced a value: `Member Status` is the constant "Registrants" feeding a
 *  VLOOKUP that returns #N/A, and `Is a hot lead` is an IF pointing at an empty cell.
 *
 *  The three MOP computes are NOT here — they are mapped columns, visible in Settings.
 *
 *  Mirrors DROPPED_HEADERS in the backend's field_seed.py. */
export const DROPPED_HEADERS = [
  'Member Status',
  'Is a hot lead',
]

// ---- computed columns ---------------------------------------------------------------------------
//
// MOP owns these: they are never read from a sheet and cannot be edited in the grid.
//
// A status may MAP a heading to one of them, which places the column where the sheet puts
// it and shows an admin that the heading is accounted for. Anything not mapped is
// appended, so the grid is complete either way.

export const COMPUTED_FIELDS: Field[] = [
  'lead_state', 'opt_in_method', 'opt_in_timestamp', 'score',
]

/** The computed fields a sheet heading may map to. `lead_state` is chosen once for the
 *  whole submission rather than read per row, so it has no heading. Mirrors
 *  MAPPABLE_COMPUTED in the backend's field_defs.py. */
export const MAPPABLE_COMPUTED: Field[] = ['opt_in_method', 'opt_in_timestamp', 'score']

export const COMPUTED_LABEL: Record<Field, string> = {
  lead_state: 'Lead state',
  opt_in_method: 'Opt-in method',
  opt_in_timestamp: 'Opt-in Timestamp1',
  score: 'Add to Score',
}

// ---- reading the configuration ----------------------------------------------------------------

/** The statuses a workbook may use, in order. Retired ones are excluded — they are kept
 *  only so an old submission stays readable. */
export const liveStatuses = (config: EventsConfig): MemberStatus[] =>
  config.statuses.filter(s => s.enabled)

/** Which status a sheet is, or undefined. Exact, ignoring only invisible characters:
 *  a tab either names a status or it is not imported. */
export function statusForSheet(config: EventsConfig, sheetName: string): Tab | undefined {
  const key = nameKey(sheetName)
  return liveStatuses(config).find(s => nameKey(s.name) === key)?.name
}

export const scoreOf = (config: EventsConfig, tab: Tab): number =>
  config.statuses.find(s => s.name === tab)?.score ?? 0

export const defsOf = (config: EventsConfig, tab: Tab): FieldDef[] => config.fields[tab] ?? []

/** The key a definition stores its values under. A computed one already holds its key. */
export const keyOf = (def: FieldDef): Field =>
  def.computed ? def.field_name : slug(def.field_name)

// Which columns a tab shows lives in columns.ts, and ONLY there. A second copy of it
// here is what put three columns in the grid twice — see the note at the top of that
// file.

/** Display name for a key, whether configured or computed. Falls back to the key, so a
 *  column carried in from a sheet without a definition still has a heading. */
export function labelOf(config: EventsConfig, tab: Tab, field: Field): string {
  // A computed column is never named by an admin, so the registry wins over the stored
  // field_name — which holds the key, not a label.
  if (COMPUTED_LABEL[field]) return COMPUTED_LABEL[field]
  return defsOf(config, tab).find(d => keyOf(d) === field)?.field_name ?? field
}

export const defOf = (config: EventsConfig, tab: Tab, field: Field): FieldDef | undefined =>
  defsOf(config, tab).find(d => keyOf(d) === field)

/** Allowed values for a cell, when its type says there are any. */
export function picklistOf(config: EventsConfig, tab: Tab, field: Field): string[] | undefined {
  const def = defOf(config, tab, field)
  if (!def || def.computed) return undefined
  return def.data_type === 'picklist' && def.picklist.length ? def.picklist : undefined
}
