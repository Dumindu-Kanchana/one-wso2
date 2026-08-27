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


// A PDF summary of one appraisal, for a lead to keep or take into the
// conversation.
//
// jsPDF and its table plugin are ~400KB, and only a lead who presses the button
// ever needs them — so they are imported dynamically. Importing them at module
// scope would put them in the main bundle for everybody, including the majority
// who never open a lead screen at all.
//
// Pinned to jspdf 4.2.1 or later deliberately: every earlier line carries
// advisories, the worst of them critical. Nothing here touches the AcroForm or
// addJS surfaces those concern, but shipping a flagged dependency is its own
// problem.

import { parHtmlToPlainText } from "./parHtml";
import { formatParDate } from "./parDates";
import type { ParCycle, ParRating, ParThreeSixtyReview } from "../api/parTypes";
import { PAR_RATING_NOT_ASSIGNED } from "../api/parTypes";
import {
  parEmployeeStatusMeta,
  parF2fStatusMeta,
  parLeadStatusMeta,
  parSpecialRatingMeta,
} from "./parStatus";

export interface ParPdfArgs {
  cycle: ParCycle;
  rating: ParRating;
  reviews: readonly ParThreeSixtyReview[];
}

/** The rows of the summary table, as data — so they can be tested without jsPDF. */
export function parSummaryRows(args: ParPdfArgs): [string, string][] {
  const { cycle, rating } = args;
  const awarded =
    rating.parRating && rating.parRating !== PAR_RATING_NOT_ASSIGNED
      ? rating.parRating
      : "Not recorded";
  const special = parSpecialRatingMeta(rating.parSpecialRating);

  return [
    ["Employee", rating.parEmployeeName ?? rating.parEmployeeEmail],
    ["Email", rating.parEmployeeEmail],
    ["Cycle", cycle.parCycleName],
    ["Rating", awarded],
    // An em dash in a table cell reads as missing data; here it means the
    // common case of no special rating, which is worth saying in words.
    ["Top 5% / 20%", special.label === "—" ? "Not assigned" : special.label],
    ["Their PAR", parEmployeeStatusMeta(rating.parEmployeeStatus).label],
    ["Lead's review", parLeadStatusMeta(rating.parLeadStatus).label],
    [
      "Conversation",
      rating.parF2fDate
        ? `${parF2fStatusMeta(rating.parF2fStatus).label} · ${formatParDate(rating.parF2fDate)}`
        : parF2fStatusMeta(rating.parF2fStatus).label,
    ],
  ];
}

/** A safe filename stem for one appraisal. */
export function parPdfFilename(rating: ParRating, cycle: ParCycle): string {
  const who = rating.parEmployeeEmail.split("@")[0] || "employee";
  // Anything outside this set is replaced rather than escaped: a filename is
  // not a place to preserve fidelity, and a stray slash would be read as a path.
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${clean(who)}-${clean(cycle.parCycleName)}-par.pdf`;
}

/** Build and download the summary. Resolves once the download has started. */
export async function downloadParSummaryPdf(args: ParPdfArgs): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const { cycle, rating, reviews } = args;
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFontSize(16);
  doc.text("Performance appraisal review", margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(cycle.parCycleName, margin, y);
  doc.setTextColor(0);
  y += 18;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    body: parSummaryRows(args),
    margin: { left: margin, right: margin },
  });

  // `lastAutoTable` is how the plugin reports where it finished; without it the
  // prose below would be drawn over the table.
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (afterTable?.finalY ?? y) + 26;

  const section = (heading: string, body: string) => {
    const text = body.trim() === "" ? "Nothing written." : body;
    const lines = doc.splitTextToSize(text, 595 - margin * 2) as string[];
    // A page break before a heading that would otherwise sit at the very bottom
    // with its text overflowing onto the next page.
    if (y + 16 + lines.length * 12 > 842 - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.text(heading, margin, y);
    y += 16;
    doc.setFontSize(9.5);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 20;
  };

  // The stored text is HTML; a PDF takes none of it, so it is flattened to the
  // words. Markup is lost by design rather than rendered as tags.
  section("What they wrote", parHtmlToPlainText(rating.parEmployeeComment));
  section("What their lead wrote", parHtmlToPlainText(rating.parLeadComment));

  const answered = reviews.filter((r) => r.reviewStatus === "SHARED");
  if (answered.length > 0) {
    section(
      "360° feedback",
      answered
        .map((r) => {
          const who = r.reviewerEmail ?? "A colleague";
          const heading = r.reviewRating ? `${who} (${r.reviewRating})` : who;
          return `${heading}\n${parHtmlToPlainText(r.reviewComment) || "No comment."}`;
        })
        .join("\n\n"),
    );
  }

  doc.save(parPdfFilename(rating, cycle));
}
