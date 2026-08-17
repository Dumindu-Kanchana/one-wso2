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
import { Box, CircularProgress } from "@wso2/oxygen-ui";
import { Mail } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { fetchThumbnail } from "../lib/thumbnails";

// Fetch a template's thumbnail as an object URL.
//
// The URL is owned by the shared cache in ../lib/thumbnails and is deliberately
// NOT revoked when this component unmounts — the same URL may be on screen in the
// other gallery, and revoking it there would blank a working image.
function useThumbnailUrl(id: string, version: string | undefined, enabled: boolean) {
  const getAccessToken = useAccessToken();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const u = await fetchThumbnail(id, version, await getAccessToken());
      if (active) setUrl(u);
    })();
    return () => {
      active = false;
    };
  }, [id, version, enabled, getAccessToken]);

  return url;
}

// Grid tile. Lazy: the image is only requested once the tile scrolls near the
// viewport, so opening a large catalog doesn't fire one authenticated image
// request per template up front.
export function Thumbnail({
  id,
  hasThumbnail,
  version,
}: {
  id: string;
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

  const url = useThumbnailUrl(id, version, hasThumbnail && visible);

  return (
    <Box
      ref={ref}
      sx={{
        height: 170,
        // Emails are authored on white. A dark surface behind a transparent PNG
        // would misrepresent the template, so this one surface stays white in
        // both themes — it's a preview of the artefact, not app chrome.
        bgcolor: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderBottom: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {url ? (
        // cover + top: fill the tile edge-to-edge showing the top of the email and
        // crop the long tail, so every thumbnail is uniformly sized.
        <Box
          component="img"
          src={url}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      ) : (
        <Box sx={{ color: "#9aa0a6", display: "inline-flex" }}>
          <Mail size={28} />
        </Box>
      )}
    </Box>
  );
}

// Full-length image for the quick-preview popover: natural width, scrollable,
// because emails are tall. Shares the same cached object URL as the grid tile.
export function FullImagePreview({ id, version }: { id: string; version?: string }) {
  const url = useThumbnailUrl(id, version, true);
  return (
    <Box sx={{ width: 360, maxHeight: "74vh", overflowY: "auto", bgcolor: "#fff" }}>
      {url ? (
        <Box component="img" src={url} alt="" sx={{ display: "block", width: "100%" }} />
      ) : (
        <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress size={20} />
        </Box>
      )}
    </Box>
  );
}
