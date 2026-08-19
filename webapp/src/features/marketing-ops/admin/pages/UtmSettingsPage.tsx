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

import { useMemo, useState } from "react";
import { Alert, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import SettingsMasterDetail from "../components/SettingsMasterDetail";
import ParameterListManager from "../components/ParameterListManager";
import { serializeRows, type PListRow } from "../components/parameterRows";
import { useReplaceUtmParameter, useUtmLists } from "../../api/useMarketingOpsSettings";

// Marketing Admin → UTM Generator lists. Master/detail over the four UTM
// parameters, one editor at a time.
//
// The parameter DISPLAY NAMES live here in code; only the VALUES persist. That's
// deliberate — "bu" is a storage key that also appears in live URLs, while
// "Business Unit" is a label we can reword without a migration.
const PARAM_LABEL: Record<string, string> = {
  source: "Source",
  medium: "Medium",
  region: "Region",
  bu: "Business Unit",
};

// Display order, which is neither alphabetical nor the API's order — it's the
// order these segments appear in a utm_campaign string, so the settings nav
// reads in the same sequence as the thing it configures.
const ORDER = ["source", "medium", "region", "bu"];

export default function UtmSettingsPage() {
  const lists = useUtmLists();
  const replace = useReplaceUtmParameter();

  // The server's lists ARE the baseline — no copy, no sync effect. `edits` holds
  // only what the admin has actually changed, per parameter, and anything absent
  // from it falls through to the server data during render.
  //
  // Deriving this way instead of seeding state in an effect buys three things:
  // a background refetch can't clobber in-progress edits (they live in a
  // separate map), "Discard" is just deleting the entry, and after a save the
  // baseline advances by itself because the refetched server data becomes the
  // baseline.
  const [edits, setEdits] = useState<Record<string, PListRow[]>>({});
  const [selected, setSelected] = useState("source");

  const baseline = useMemo(() => {
    const out: Record<string, PListRow[]> = {};
    for (const l of lists.data ?? []) {
      out[l.parameter] = l.values.map((v) => ({
        id: v.id,
        cols: [v.label, v.code],
        enabled: v.enabled,
      }));
    }
    return out;
  }, [lists.data]);

  const rowsFor = (key: string) => edits[key] ?? baseline[key] ?? [];

  const groups = useMemo(
    () => [
      {
        items: ORDER.filter((p) => baseline[p]).map((p) => ({
          key: p,
          label: PARAM_LABEL[p] ?? p,
          dirty: serializeRows(edits[p] ?? baseline[p]) !== serializeRows(baseline[p]),
        })),
      },
    ],
    [edits, baseline],
  );

  const loaded = Boolean(lists.data);

  return (
    <MarketingOpsShell
      eyebrow="⚙️ Marketing Admin"
      title="UTM Generator lists"
      subtitle="The Source, Medium, Region and Business Unit values offered by the UTM Link Generator. Codes go into live tracking URLs — retire a value by disabling it rather than deleting it, so historical links stay interpretable."
    >
      {lists.isError ? (
        <Alert severity="error">Couldn't load UTM parameters. {describeError(lists.error)}</Alert>
      ) : !loaded ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 1 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Loading UTM parameters…
          </Typography>
        </Stack>
      ) : (
        <SettingsMasterDetail groups={groups} selected={selected} onSelect={setSelected}>
          <ParameterListManager
            // Remount on parameter switch so the editor's dialog/error state
            // can't leak across lists.
            key={selected}
            title={PARAM_LABEL[selected] ?? selected}
            columns={["Label", "Code"]}
            rows={rowsFor(selected)}
            baseline={baseline[selected] ?? []}
            onChange={(rows) => setEdits((s) => ({ ...s, [selected]: rows }))}
            onSave={async (rows) => {
              await replace.mutateAsync({
                parameter: selected,
                entries: rows.map((r) => ({
                  label: r.cols[0],
                  code: r.cols[1],
                  enabled: r.enabled,
                })),
              });
              // Drop the local edit. The mutation's onSuccess returns the
              // invalidation promise, so by the time mutateAsync resolves the
              // refetch has landed — meaning `baseline` already holds the saved
              // values (with server-assigned ids and normalised order), and
              // clearing the edit shows server truth rather than a stale copy.
              setEdits((s) => {
                const next = { ...s };
                delete next[selected];
                return next;
              });
            }}
          />
        </SettingsMasterDetail>
      )}
    </MarketingOpsShell>
  );
}
