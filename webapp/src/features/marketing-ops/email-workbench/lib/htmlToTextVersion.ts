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

// Deterministic HTML -> plain-text conversion for Pardot's text version, matching the
// output marketers currently get by pasting HTML into MailChimp's html-to-text tool —
// without depending on that external service at runtime. {{ merge fields }} pass through
// untouched. No AI; the text mirrors the HTML.
//
// The rules were reverse-engineered from MailChimp's own service
// (templates.mailchimp.com/services/html-to-text) by feeding it isolated probes:
//   - <h1>-<h4>          -> "** Heading" + a 60-char '-' rule; <h5>/<h6> are plain.
//   - <hr>               -> a 60-char '-' rule.
//   - body links         -> "text (href)" (empty href -> "text ()"); a link whose visible
//                           text equals its href collapses to just the href; an image-only
//                           link drops the image and shows the bare href (alt is ignored).
//   - body images        -> an image inside a link is dropped (the link shows its href); a
//                           STANDALONE image renders its alt text.
//   - <ul>               -> "* item", no leading space, no blank line between items.
//   - no line wrapping.
//
// The footer is special. MailChimp keys off id="templateFooter" (a MailChimp template
// convention WSO2's templates inherit) and, inside it: emits a 60-char '=' divider once,
// and renders EVERY link as "** {label} (href)" with image alt used as the label. We
// detect that region with parse5 and convert it with footer-specific rules. If the id is
// absent we fall back to the smallest <table> that contains both an unsubscribe link and a
// social link — deterministically the footer wrapper, never the body.
//
// Known minor divergence (cosmetic): MailChimp's blank-line placement between blocks (its
// spacing model differs from html-to-text's) is not reproduced byte-for-byte — visible text,
// links, headings, dividers, and the footer all match; only some blank-line gaps differ.

import { convert } from 'html-to-text'
import { parse, serialize, serializeOuter } from 'parse5'

// parse5's typed tree is verbose and html-to-text's element type is loose; we only touch a
// few fields on each, so use loose typing.
/* eslint-disable @typescript-eslint/no-explicit-any */

const RULE = '-'.repeat(60)
const EQ = '='.repeat(60)
const NBSP = String.fromCharCode(160)

// ---------------------------------------------------------------------------
// Footer detection (parse5)
// ---------------------------------------------------------------------------

const p5attr = (node: any, name: string): string | undefined =>
  node.attrs?.find((a: any) => a.name === name)?.value

function findFooter(root: any): any | null {
  // Primary: the outermost element with id="templateFooter" (MailChimp's marker).
  let byId: any = null
  const walkId = (node: any, inside: boolean) => {
    const isFooter = !!node.attrs && p5attr(node, 'id') === 'templateFooter'
    if (isFooter && !inside) byId = node
    for (const c of node.childNodes ?? []) walkId(c, inside || isFooter)
  }
  walkId(root, false)
  if (byId) return byId

  // Fallback: the smallest <table> containing BOTH an unsubscribe link and a social link.
  const UNSUB = /unsubscribe/i
  const SOCIAL = /twitter|facebook|linkedin|instagram|youtube|x\.com/i
  const hrefsIn = (node: any, acc: string[]): string[] => {
    if (node.tagName === 'a') acc.push(p5attr(node, 'href') ?? '')
    for (const c of node.childNodes ?? []) hrefsIn(c, acc)
    return acc
  }
  const size = (node: any): number =>
    1 + (node.childNodes ?? []).reduce((n: number, c: any) => n + size(c), 0)
  let best: any = null
  let bestSize = Infinity
  const walkTables = (node: any) => {
    if (node.tagName === 'table') {
      const hrefs = hrefsIn(node, [])
      if (hrefs.some(h => UNSUB.test(h)) && hrefs.some(h => SOCIAL.test(h))) {
        const s = size(node)
        if (s < bestSize) { best = node; bestSize = s }
      }
    }
    for (const c of node.childNodes ?? []) walkTables(c)
  }
  walkTables(root)
  return best
}

function detach(node: any) {
  const parent = node.parentNode
  if (parent) parent.childNodes = parent.childNodes.filter((c: any) => c !== node)
}

// MailChimp renders real DATA tables (those with <th> header cells) as an aligned grid,
// but flows LAYOUT tables (the structural tables emails are built from) inline. We tell
// them apart by the presence of <th>: tag the nearest <table> ancestor of each <th> with a
// class so a selector can route just those to html-to-text's dataTable formatter.
const DATA_TABLE_CLASS = 'mc-data-table'
function markDataTables(root: any) {
  const walk = (node: any) => {
    if (node.tagName === 'th') {
      for (let p = node.parentNode; p; p = p.parentNode) {
        if (p.tagName === 'table') {
          const cls = p.attrs.find((a: any) => a.name === 'class')
          if (cls) { if (!cls.value.split(/\s+/).includes(DATA_TABLE_CLASS)) cls.value += ' ' + DATA_TABLE_CLASS }
          else p.attrs.push({ name: 'class', value: DATA_TABLE_CLASS })
          break
        }
      }
    }
    for (const c of node.childNodes ?? []) walk(c)
  }
  walk(root)
}

// MailChimp prints the preheader's text followed by a 60-char rule before the body. The
// trigger is class="preheaderContent" — but that class also sits on visible header cells
// (View online / New Release), and only the FIRST occurrence (the dedicated preheader) gets
// the divider, so we tag just that one for a scoped formatter.
const PREHEADER_CLASS = 'mc-preheader'
function markPreheader(root: any) {
  let done = false
  const walk = (node: any) => {
    if (done) return
    const cls = node.attrs?.find((a: any) => a.name === 'class')
    if (cls && cls.value.split(/\s+/).includes('preheaderContent')) { cls.value += ' ' + PREHEADER_CLASS; done = true; return }
    for (const c of node.childNodes ?? []) walk(c)
  }
  walk(root)
}

// ---------------------------------------------------------------------------
// html-to-text formatters
// ---------------------------------------------------------------------------

// Visible text of an html-to-text (htmlparser2) element.
function anchorText(elem: any): string {
  let t = ''
  const rec = (n: any) => { if (n.type === 'text') t += n.data; for (const c of n.children ?? []) rec(c) }
  for (const c of elem.children ?? []) rec(c)
  return t.trim()
}

// A bare merge-field href like "{{Unsubscribe}}" is a token the sending platform swaps for
// the real URL at send time — so we show the TOKEN, never wrapped in "(...)" like a normal
// link. If the visible text just repeats the token (text "Unsubscribe" for "{{Unsubscribe}}")
// we show the token alone; otherwise the label is kept before it ("…preferences {{token}}").
// Returns the rendering, or null when the href isn't a bare merge field (normal-link path).
const BARE_MERGE_HREF = /^\{\{\s*[^{}]+\s*\}\}$/
function mergeFieldLink(txt: string, href: string): string | null {
  const token = (href ?? '').trim()
  if (!BARE_MERGE_HREF.test(token)) return null
  const inner = token.replace(/^\{\{\s*|\s*\}\}$/g, '')
  const t = (txt ?? '').trim()
  if (!t || t.toLowerCase() === token.toLowerCase() || t.toLowerCase() === inner.toLowerCase()) return token
  return `${t} ${token}`
}

// Body link: an <a> with NO href attribute is dropped entirely (text and all) — MailChimp
// treats it as a non-link. Otherwise: image-only -> bare href; text === href -> just the
// href; else "text (href)" (an empty href="" still renders, giving "text ()").
//
// The trailing space after "(href)" reproduces a MailChimp behavior: it pads every inline
// link with a trailing space, so a link immediately followed by punctuation renders as
// "text (href) ." while a link followed by a normal space collapses back to one space.
function bodyLink(elem: any, walk: any, b: any) {
  const href = elem.attribs?.href
  if (href === undefined) return
  const txt = anchorText(elem)
  const mf = mergeFieldLink(txt, href)
  if (mf !== null) { b.addInline(mf); return }
  if (!txt) { if (href) b.addInline(href); return }
  if (txt === href) { b.addInline(txt); return }
  walk(elem.children, b)
  b.addInline(' (' + href + ') ')
}

// Body image: MailChimp drops images inside links (the link shows its bare href) but
// renders the alt text of a STANDALONE image. Walk ancestors to tell the two apart.
function bodyImg(elem: any, _walk: any, b: any) {
  for (let p = elem.parent; p; p = p.parent) if (p.name === 'a') return
  const alt = elem.attribs?.alt ?? ''
  if (alt) b.addInline(alt)
}

function convertBody(html: string): string {
  return convert(html, {
    wordwrap: false,
    formatters: {
      bodyLink,
      bodyImg,
      mcHeading: (elem: any, walk: any, b: any) => {
        b.openBlock({ leadingLineBreaks: 3 })
        b.addInline('** '); walk(elem.children, b)
        b.addLineBreak(); b.addInline(RULE)
        b.closeBlock({ trailingLineBreaks: 2 })
      },
      mcHr: (_e: any, _w: any, b: any) => {
        b.openBlock({ leadingLineBreaks: 1 }); b.addInline(RULE); b.closeBlock({ trailingLineBreaks: 2 })
      },
      // First .preheaderContent (tagged by markPreheader): its text, then a 60-char rule,
      // tight — the following element's own spacing decides the gap after the rule.
      mcPreheader: (elem: any, walk: any, b: any) => {
        b.openBlock({ leadingLineBreaks: 1 })
        walk(elem.children, b)
        b.addLineBreak(); b.addInline(RULE)
        b.closeBlock({ trailingLineBreaks: 1 })
      },
    },
    selectors: [
      { selector: 'img', format: 'bodyImg' },
      { selector: 'a', format: 'bodyLink' },
      { selector: 'hr', format: 'mcHr' },
      { selector: 'ul', options: { itemPrefix: '* ' } },
      // Data tables (tagged by markDataTables) -> aligned grid, original-case headers,
      // single-space column gap (matches MailChimp). Layout tables flow by default.
      { selector: '.' + DATA_TABLE_CLASS, format: 'dataTable', options: { uppercaseHeaderCells: false, colSpacing: 1 } },
      { selector: '.' + PREHEADER_CLASS, format: 'mcPreheader' },
      { selector: 'h1', format: 'mcHeading' },
      { selector: 'h2', format: 'mcHeading' },
      { selector: 'h3', format: 'mcHeading' },
      { selector: 'h4', format: 'mcHeading' },
      { selector: 'h5', format: 'block' },
      { selector: 'h6', format: 'block' },
    ],
  })
}

function convertFooter(footerHtml: string): string {
  const text = convert(footerHtml, {
    wordwrap: false,
    formatters: {
      // NOTE: html-to-text exposes attributes on `.attribs` (object), not parse5's `.attrs`.
      mcFooterImg: (elem: any, _w: any, b: any) => { b.addInline(elem.attribs?.alt ?? '') },
      mcFooterLink: (elem: any, walk: any, b: any) => {
        b.addInline('** ')
        const mf = mergeFieldLink(anchorText(elem), elem.attribs?.href ?? '')
        if (mf !== null) { b.addInline(mf) }
        else { walk(elem.children, b); b.addInline(' (' + (elem.attribs?.href ?? '') + ')') }
        b.addLineBreak()
      },
      // each table cell on its own line (single break, no blank line)
      mcFooterCell: (elem: any, walk: any, b: any) => {
        b.openBlock({ leadingLineBreaks: 1 }); walk(elem.children, b); b.closeBlock({ trailingLineBreaks: 1 })
      },
    },
    selectors: [
      { selector: 'img', format: 'mcFooterImg' },
      { selector: 'a', format: 'mcFooterLink' },
      { selector: 'td', format: 'mcFooterCell' },
    ],
  })
  // The MailChimp footer has no blank lines: normalize nbsp -> space, collapse blank lines,
  // and left-trim each line (centered cells / nbsp runs collapse at line start).
  const cleaned = text
    .split(NBSP).join(' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n').map(l => l.replace(/^[ \t]+/, '')).join('\n')
  return EQ + '\n' + cleaned.trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// MailChimp renders &nbsp; as a regular space in the text version.
const denbsp = (s: string) => s.split(NBSP).join(' ')

export function toTextVersion(html: string): string {
  const doc = parse(html)
  markDataTables(doc)
  markPreheader(doc)

  const footer = findFooter(doc)
  let footerText: string | null = null
  if (footer) {
    footerText = convertFooter(serializeOuter(footer))
    detach(footer)
  }

  // convertFooter already normalizes nbsp internally; normalize the body half here.
  const body = denbsp(convertBody(serialize(doc))).trim()
  return footerText ? (body + '\n\n' + footerText).trim() : body
}
