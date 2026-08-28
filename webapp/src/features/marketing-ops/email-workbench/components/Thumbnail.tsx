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

import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Skeleton, Typography } from "@wso2/oxygen-ui";
import { Mail } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { fetchThumbnail } from "../lib/thumbnails";
import { COVER_TONE, coverInitials } from "../lib/templateCover";

// Fetch a template's thumbnail as an object URL.
//
// The URL is owned by the shared cache in ../lib/thumbnails and is deliberately
// NOT revoked when this component unmounts — the same URL may be on screen in the
// other gallery, and revoking it there would blank a working image.
//
// Returns a STATE rather than `string | null`, because null meant two different
// things and the callers rendered both the same way: "still fetching" and
// "there is nothing to fetch, or the fetch failed". A tile mid-download looked
// exactly like a tile with no thumbnail, which is why the empty ones read as
// broken images — sometimes they genuinely were still loading.
// "pending" covers both "not asked for yet" and "asked, still waiting". They are
// the same thing to a caller and collapsing them keeps the effect free of a
// synchronous setState, which cascades renders (react-hooks/set-state-in-effect).
type ThumbState =
  | { status: "pending" }
  | { status: "ready"; url: string }
  | { status: "none" }; // 404, zero bytes, or a failed request

function useThumbnailUrl(id: string, version: string | undefined, enabled: boolean): ThumbState {
  const getAccessToken = useAccessToken();
  const [state, setState] = useState<ThumbState>({ status: "pending" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const u = await fetchThumbnail(id, version, await getAccessToken());
      if (!active) return;
      setState(u ? { status: "ready", url: u } : { status: "none" });
    })();
    return () => {
      active = false;
    };
  }, [id, version, enabled, getAccessToken]);

  return state;
}

// ---- the generated cover ---------------------------------------------------

// Was 170. Trimmed with the column count below it — three tiles across a wide
// gallery were larger than the thing they preview deserves.
const COVER_H = 140;

// Drawn when a template has no thumbnail: the template's initials on the navy a
// WSO2 email is built from, under a fine diagonal hatch.
//
// The hatch is the whole point, and it took a wrong turn to find. Flat navy was
// unmistakably WSO2 — and unmistakably a SCREENSHOT, because a real WSO2 email
// has a navy header, so covers stopped being tellable from actual thumbnails.
// Colour could never fix that; surface had to. Texture is the oldest "nothing
// here" signal there is, and no rendered email carries one, so a hatched field
// reads as drawn rather than photographed while keeping the full-bleed weight.
//
// Kept deliberately low-contrast: at 6px on 13px it should register as a
// treatment on the navy, not as stripes competing with the letters. If it ever
// reads as a compression artefact rather than a pattern, raise the white alpha
// before changing the geometry.
function GeneratedCover({ name }: { name: string }) {
  const initials = coverInitials(name);

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: COVER_TONE.bg,
        backgroundImage: `repeating-linear-gradient(135deg, ${COVER_TONE.hatch} 0 6px, transparent 6px 13px)`,
      }}
    >
      {initials ? (
        <Typography
          aria-hidden="true"
          sx={{
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            userSelect: "none",
            color: COVER_TONE.fg,
            // Not full strength: the letters are a mark on the cover, not a
            // headline competing with the template name under the tile.
            opacity: 0.72,
          }}
        >
          {initials}
        </Typography>
      ) : (
        // A name with no letters in it at all (digits, punctuation). Rare, but a
        // cover reading "?" would look like the error state this replaces.
        <Box sx={{ display: "inline-flex", color: COVER_TONE.fg, opacity: 0.72 }} aria-hidden="true">
          <Mail size={30} />
        </Box>
      )}

      {/* Colour and letters make the tile look deliberate; only the words tell
          you it IS deliberate, which no icon or texture can do on its own. */}
      <Typography
        sx={{
          position: "absolute",
          bottom: 9,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: COVER_TONE.fg,
          opacity: 0.6,
        }}
      >
        No preview
      </Typography>
    </Box>
  );
}

// Grid tile. Lazy: the image is only requested once the tile scrolls near the
// viewport, so opening a large catalog doesn't fire one authenticated image
// request per template up front.
export function Thumbnail({
  id,
  name,
  hasThumbnail,
  version,
}: {
  id: string;
  name: string;
  hasThumbnail: boolean;
  version?: string;
}) {
  // Initialised from feature detection rather than flipped inside the effect: with
  // no IntersectionObserver (older browser, or a non-DOM test environment) every
  // tile loads eagerly, which is a worse-but-working fallback rather than an image
  // that never appears. Doing this in the initialiser also keeps the effect free of
  // a synchronous setState.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasThumbnail || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasThumbnail, visible]);

  const thumb = useThumbnailUrl(id, version, hasThumbnail && visible);

  // A template that HAS a thumbnail we haven't got yet is still loading — even
  // before the observer fires, since the tile is about to request it. A fetch
  // that came back empty or failed lands on "none" and falls through to the
  // cover: a shimmer that never resolves would be a worse lie than a cover
  // saying there is no preview.
  const loading = hasThumbnail && thumb.status === "pending";

  return (
    <Box
      ref={ref}
      sx={{
        height: COVER_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: 1,
        borderColor: "divider",
        overflow: "hidden",
        // White only under a REAL thumbnail: emails are authored on white, and a
        // dark surface behind a transparent PNG would misrepresent the template.
        // The generated cover paints its own ground, so it must not inherit this.
        ...(thumb.status === "ready" ? { bgcolor: "#fff" } : null),
      }}
    >
      {thumb.status === "ready" ? (
        // cover + top: fill the tile edge-to-edge showing the top of the email and
        // crop the long tail, so every thumbnail is uniformly sized.
        <Box
          component="img"
          src={thumb.url}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      ) : loading ? (
        <Skeleton
          variant="rectangular"
          animation="wave"
          width="100%"
          height="100%"
          // The sweep is what separates "still coming" from "never was". Anyone
          // who has asked not to be moved gets the plain block instead, which is
          // still visibly different from a cover.
          sx={{
            "@media (prefers-reduced-motion: reduce)": { "&::after": { animation: "none" } },
          }}
        />
      ) : (
        <GeneratedCover name={name} />
      )}
    </Box>
  );
}

// Full-length image for the quick-preview popover: natural width, scrollable,
// because emails are tall. Shares the same cached object URL as the grid tile.
export function FullImagePreview({ id, version }: { id: string; version?: string }) {
  const thumb = useThumbnailUrl(id, version, true);
  return (
    <Box sx={{ width: 360, maxHeight: "74vh", overflowY: "auto", bgcolor: "#fff" }}>
      {thumb.status === "ready" ? (
        <Box component="img" src={thumb.url} alt="" sx={{ display: "block", width: "100%" }} />
      ) : (
        <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={20} />
        </Box>
      )}
    </Box>
  );
}
