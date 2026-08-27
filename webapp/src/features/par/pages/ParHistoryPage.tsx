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


import { type JSX } from "react";
import { Alert, Box, Skeleton, Tab, Tabs } from "@wso2/oxygen-ui";
import { useSearchParams } from "react-router";
import { HistoryIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import ParShell from "../components/ParShell";
import ParPastCyclesPanel from "../components/ParPastCyclesPanel";
import ParTeamHistoryPanel from "../components/ParTeamHistoryPanel";
import { useMyClosedCycles } from "../api/useParHistory";
import { useParMe } from "../api/useParMe";
import { useDirectoryReports } from "../api/useParDirectory";
import { parseTextBoolean } from "../util/parReports";

// PAR history — the employee's own past appraisals.
//
// See docs/ported-apps/par-app.md §5.2. The table and detail are shared with the
// lead-facing view of a report's history, so the two cannot drift; only the copy
// differs, and it is passed in rather than switched on a flag.

const OWN_HISTORY = {
  title: "Closed cycles",
  subtitle: "Newest first.",
  none: "You don't have any closed cycles yet. Your first appraisal appears here once its cycle closes.",
  employeeHeading: "WHAT YOU WROTE",
  leadHeading: "WHAT YOUR LEAD WROTE",
  employeeSilent: "You didn't write anything for this cycle.",
  leadSilent: "Your lead didn't leave written feedback.",
  ownerLabel: "Yours",
};

export default function ParHistoryPage(): JSX.Element {
  const { email } = useAsgardeoUser();
  // Asked here too, so the page can distinguish "nothing yet" from a failure
  // before the panel renders either.
  const cycles = useMyClosedCycles();

  // The team-history tab's gate, settled in §2.1: the `lead` flag AND the
  // directory agreeing this person actually has reports. Two signals because
  // either alone is wrong — the flag can outlive a reorganisation, and having
  // reports does not by itself make somebody a lead in PAR's terms.
  const me = useParMe(email);
  const myReports = useDirectoryReports(email, parseTextBoolean(me.data?.lead));
  const canBrowseTeam =
    parseTextBoolean(me.data?.lead) && (myReports.data ?? []).length > 0;

  const [params, setParams] = useSearchParams();
  const view = canBrowseTeam && params.get("view") === "team" ? "team" : "mine";

  return (
    <ParShell
      eyebrow={{ icon: HistoryIcon, label: "PAR" }}
      title="PAR history"
      subtitle="Your appraisals from cycles that have closed."
      require="employee"
    >
      {canBrowseTeam && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2.25 }}>
          <Tabs
            value={view}
            onChange={(_e, next: string) => {
              const nextParams = new URLSearchParams(params);
              if (next === "mine") nextParams.delete("view");
              else nextParams.set("view", next);
              setParams(nextParams, { replace: true });
            }}
          >
            <Tab value="mine" label="My history" sx={{ textTransform: "none" }} />
            <Tab value="team" label="Team history" sx={{ textTransform: "none" }} />
          </Tabs>
        </Box>
      )}

      {view === "team" ? (
        <ParTeamHistoryPanel rootEmail={email ?? ""} rootName="You" />
      ) : cycles.isPending ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : cycles.isError ? (
        <Alert severity="error">
          Couldn&apos;t load your history. {describeError(cycles.error)}
        </Alert>
      ) : (cycles.data ?? []).length === 0 ? (
        <Alert severity="info">{OWN_HISTORY.none}</Alert>
      ) : (
        <ParPastCyclesPanel employeeEmail={email} copy={OWN_HISTORY} />
      )}
    </ParShell>
  );
}
