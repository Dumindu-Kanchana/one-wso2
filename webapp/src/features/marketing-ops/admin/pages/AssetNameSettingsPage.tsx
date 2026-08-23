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
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import SettingsMasterDetail, { type NavGroup } from "../components/SettingsMasterDetail";
import ParameterListManager from "../components/ParameterListManager";
import { serializeRows, type PListRow } from "../components/parameterRows";
import { useAssetNameLists, useReplaceAssetNameField } from "../../api/useMarketingOpsSettings";
import { GENERATORS } from "../../utilities/assetName";

// Marketing Admin → Asset Name Generator lists.
//
// The nav groups fields BY ASSET TYPE, because the same field name means
// different things across generators — "Target Region" on Salesforce Campaign
// offers EU1/EU2/EU3/MEA while the Generic one offers plain EU. A flat list of
// field names would be genuinely ambiguous, so the asset type stays visible
// while you edit.
//
// Display names and field ORDER come from the code-defined GENERATORS; only the
// option values persist. The templates and which fields exist aren't editable
// here on purpose — changing those changes the output format, which has
// downstream consequences in Salesforce and Pardot and belongs in a code review.
const GEN_ORDER = GENERATORS.map((g) => g.id);
const genName = (id: string) => GENERATORS.find((g) => g.id === id)?.name ?? id;
const fieldLabel = (assetType: string, field: string) =>
  GENERATORS.find((g) => g.id === assetType)?.fields.find((f) => f.key === field)?.label ?? field;

// Sort rank of a field within its generator. Unknown fields sort LAST rather
// than first, so a field the backend has but the code doesn't know about lands at
// the bottom instead of displacing the real ones.
const fieldRank = (assetType: string, field: string) => {
  const idx = GENERATORS.find((g) => g.id === assetType)?.fields.findIndex((f) => f.key === field);
  return idx === undefined || idx < 0 ? 999 : idx;
};
const keyOf = (assetType: string, field: string) => `${assetType}.${field}`;

export default function AssetNameSettingsPage() {
  const lists = useAssetNameLists();
  const replace = useReplaceAssetNameField();

  // Same derive-don't-sync shape as the UTM panel — see the comment there for
  // why. `selected` is nullable so the first list can be chosen during render
  // rather than assigned by an effect.
  const [edits, setEdits] = useState<Record<string, PListRow[]>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const ordered = useMemo(
    () =>
      [...(lists.data ?? [])].sort(
        (a, b) =>
          GEN_ORDER.indexOf(a.asset_type) - GEN_ORDER.indexOf(b.asset_type) ||
          fieldRank(a.asset_type, a.field) - fieldRank(b.asset_type, b.field),
      ),
    [lists.data],
  );

  const baseline = useMemo(() => {
    const out: Record<string, PListRow[]> = {};
    for (const l of ordered) {
      out[keyOf(l.asset_type, l.field)] = l.values.map((v) => ({
        id: v.id,
        cols: [v.value],
        enabled: v.enabled,
      }));
    }
    return out;
  }, [ordered]);

  const groups = useMemo<NavGroup[]>(() => {
    const out: NavGroup[] = [];
    for (const l of ordered) {
      const k = keyOf(l.asset_type, l.field);
      const label = genName(l.asset_type);
      let g = out.find((x) => x.label === label);
      if (!g) {
        g = { label, items: [] };
        out.push(g);
      }
      g.items.push({
        key: k,
        label: fieldLabel(l.asset_type, l.field),
        dirty: serializeRows(edits[k] ?? baseline[k]) !== serializeRows(baseline[k]),
      });
    }
    return out;
  }, [ordered, edits, baseline]);

  const firstKey = ordered.length ? keyOf(ordered[0].asset_type, ordered[0].field) : "";
  // Fall back to the first list, and also recover if the selected key disappears
  // from a refetch — otherwise the editor would render an empty list forever.
  const activeKey = selected && baseline[selected] ? selected : firstKey;
  const [assetType, field] = activeKey
    ? (activeKey.split(".") as [string, string])
    : (["", ""] as [string, string]);

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.admin}
      title="Asset Name Generator lists"
      subtitle="The dropdown values offered by each asset-name generator. The name templates and which fields exist are set in code — only the values are editable here."
    >
      {lists.isError ? (
        <Alert severity="error">
          Couldn't load asset-name parameters. {describeError(lists.error)}
        </Alert>
      ) : !lists.data ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: 1 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Loading asset-name parameters…
          </Typography>
        </Stack>
      ) : !activeKey ? (
        <Alert severity="info">
          No asset-name parameter lists are configured on the Marketing Ops backend yet.
        </Alert>
      ) : (
        <SettingsMasterDetail groups={groups} selected={activeKey} onSelect={setSelected}>
          <ParameterListManager
            key={activeKey}
            title={`${genName(assetType)} · ${fieldLabel(assetType, field)}`}
            columns={["Value"]}
            rows={edits[activeKey] ?? baseline[activeKey] ?? []}
            baseline={baseline[activeKey] ?? []}
            onChange={(rows) => setEdits((s) => ({ ...s, [activeKey]: rows }))}
            onSave={async (rows) => {
              await replace.mutateAsync({
                assetType,
                field,
                entries: rows.map((r) => ({ value: r.cols[0], enabled: r.enabled })),
              });
              setEdits((s) => {
                const next = { ...s };
                delete next[activeKey];
                return next;
              });
            }}
          />
        </SettingsMasterDetail>
      )}
    </MarketingOpsShell>
  );
}
