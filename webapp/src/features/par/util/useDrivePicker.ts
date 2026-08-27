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


// Google's Drive picker, for attaching evidence to a lead review.
//
// This is the only place in the app that loads third-party script, and the CSP
// was widened for it deliberately — see vite.config.ts, where each Google origin
// is justified. It is confined to this file so that stays true.
//
// Types are declared here rather than pulled from `@types/google.picker` and
// `@types/gapi`: we use about eight members between them, and two dependency
// trees to describe eight members is a poor trade.
//
// The picker needs its OWN OAuth consent — a Drive scope, separate from the
// Asgardeo session. So it can fail in ways nothing else here can: no client id
// configured, a blocked popup, or a user who declines. Each is reported
// distinctly, because the fix differs and the lead cannot share until they have
// attached something.

import { useCallback, useRef, useState } from "react";
import { extractDriveId, type ParEvidenceFile } from "./parEvidence";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const GIS_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";

export type DrivePickerError =
  /** No client id configured, so the picker cannot be opened at all. */
  | "notConfigured"
  /** Google's script did not load — offline, or the CSP is refusing it. */
  | "scriptLoadFailed"
  /** The consent popup never opened, or was dismissed. */
  | "popupBlocked"
  /** The user declined the Drive permission. */
  | "accessDenied";

export const DRIVE_PICKER_ERROR_TEXT: Record<DrivePickerError, string> = {
  notConfigured:
    "Choosing from Drive isn't set up in this deployment. Paste a document link instead.",
  scriptLoadFailed:
    "Couldn't load Google's file picker. Paste a document link instead.",
  popupBlocked:
    "Google's permission window didn't open. Allow popups for this site, or paste a link instead.",
  accessDenied:
    "Drive access wasn't granted, so files can't be listed. Paste a document link instead.",
};

// ---- the narrow slice of Google's API this uses ---------------------------

interface PickedDoc {
  id: string;
  name?: string;
  url: string;
}

interface PickerBuilderLike {
  addView: (view: unknown) => PickerBuilderLike;
  enableFeature: (feature: unknown) => PickerBuilderLike;
  setOAuthToken: (token: string) => PickerBuilderLike;
  setCallback: (cb: (data: { action: string; docs?: PickedDoc[] }) => void) => PickerBuilderLike;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GoogleNamespace {
  picker: {
    PickerBuilder: new () => PickerBuilderLike;
    DocsView: new () => { setIncludeFolders: (include: boolean) => unknown };
    ViewId: { RECENTLY_PICKED: unknown };
    Feature: { MULTISELECT_ENABLED: unknown };
    Action: { PICKED: string };
  };
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: {
          access_token?: string;
          expires_in?: number;
          error?: string;
        }) => void;
      }) => { requestAccessToken: () => void };
    };
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
    gapi?: { load: (module: string, cb: () => void) => void };
  }
}

/** Load a script once, however many callers ask for it. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function isDrivePickerConfigured(): boolean {
  return Boolean(window.config?.ONE_WSO2_GOOGLE_OAUTH_CLIENT_ID);
}

export function useDrivePicker(): {
  openPicker: (onPicked: (files: ParEvidenceFile[]) => void) => void;
  isLoading: boolean;
  error: DrivePickerError | null;
  isAvailable: boolean;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DrivePickerError | null>(null);
  // The Drive token is cached for its lifetime so a second attachment does not
  // ask for consent again. Held in a ref, never in state: it is a credential,
  // and nothing should re-render because of it.
  const tokenRef = useRef<string | null>(null);
  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null);
  const pendingRef = useRef<((files: ParEvidenceFile[]) => void) | null>(null);

  const show = useCallback((token: string, onPicked: (files: ParEvidenceFile[]) => void) => {
    const google = window.google;
    if (!google) {
      setError("scriptLoadFailed");
      return;
    }
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView().setIncludeFolders(false))
      .addView(google.picker.ViewId.RECENTLY_PICKED)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setCallback((data) => {
        if (data.action !== google.picker.Action.PICKED) return;
        const files = (data.docs ?? []).map((doc) => ({
          id: doc.id || extractDriveId(doc.url),
          // The picker gives a real filename — the only path by which a
          // document is shown as anything other than its URL.
          name: doc.name?.trim() || doc.url,
          url: doc.url,
        }));
        if (files.length > 0) onPicked(files);
      })
      .build();
    picker.setVisible(true);
  }, []);

  const openPicker = useCallback(
    (onPicked: (files: ParEvidenceFile[]) => void) => {
      const clientId = window.config?.ONE_WSO2_GOOGLE_OAUTH_CLIENT_ID;
      if (!clientId) {
        setError("notConfigured");
        return;
      }
      setError(null);
      setIsLoading(true);

      void (async () => {
        try {
          await Promise.all([loadScript(GIS_URL), loadScript(GAPI_URL)]);
          await new Promise<void>((resolve, reject) => {
            if (!window.gapi) {
              reject(new Error("gapi did not initialise"));
              return;
            }
            window.gapi.load("picker", resolve);
          });
        } catch {
          setError("scriptLoadFailed");
          setIsLoading(false);
          return;
        }
        setIsLoading(false);

        if (tokenRef.current) {
          show(tokenRef.current, onPicked);
          return;
        }

        pendingRef.current = onPicked;
        const google = window.google;
        if (!google) {
          setError("scriptLoadFailed");
          return;
        }

        tokenClientRef.current ??= google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              setError(response.error === "access_denied" ? "accessDenied" : "popupBlocked");
              return;
            }
            tokenRef.current = response.access_token;
            // Dropped a minute before it expires, so a picker opened just as it
            // lapses asks for consent rather than failing silently.
            const lifetimeMs = Math.max(0, ((response.expires_in ?? 3600) - 60) * 1000);
            window.setTimeout(() => {
              tokenRef.current = null;
            }, lifetimeMs);
            if (pendingRef.current) show(response.access_token, pendingRef.current);
          },
        });
        tokenClientRef.current.requestAccessToken();
      })();
    },
    [show],
  );

  return { openPicker, isLoading, error, isAvailable: isDrivePickerConfigured() };
}
