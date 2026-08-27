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


import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@wso2/oxygen-ui";
import { useSearchParams } from "react-router";
import { UsersRoundIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import ParShell from "../components/ParShell";
import ParEmpty from "../components/ParEmpty";
import ParSection from "../components/ParSection";
import ParPanel from "../components/ParPanel";
import ParCompletionBar from "../components/ParCompletionBar";
import ParTeamMemberTable from "../components/ParTeamMemberTable";
import ParReportsPanel from "../components/ParReportsPanel";
import ParAllocationPanel from "../components/ParAllocationPanel";
import ParReportChainPanel from "../components/ParReportChainPanel";
import ParTeamToolbar from "../components/ParTeamToolbar";
import { useMyParCycle } from "../api/useParEmployee";
import { useMyParTeams, useParTeamReport } from "../api/useParTeams";
import { useMyReports } from "../api/useParReports";
import { useMyQuotaAllocation } from "../api/useParAllocation";
import { indirectReports } from "../util/parReports";
import { isDeadlinePassed } from "../util/parDeadlines";
import { allTeamsTotals } from "../util/parTeamSummary";
import type { ParTeam } from "../api/parTypes";

// My Team's PAR — where a lead's reports have got to in the open cycle.
//
// See docs/ported-apps/par-app.md §6.1. This is sub-slice 3a and is read-only:
// opening a member to write their review is 3b, so there is no row action yet.

/** "Engineering · Platform · Integration · Gateway", skipping the blanks. */
function teamLabel(team: ParTeam): string {
  return [team.parBusinessUnit, team.parDepartment, team.parTeam, team.parSubTeam]
    .filter((part) => typeof part === "string" && part.trim() !== "")
    .join(" · ");
}

/**
 * The two lists a lead works from.
 *
 * Tabs here, unlike the review screen, which deliberately stacks its three
 * areas: these are alternative lists of PEOPLE, only one of which is being
 * read at a time. The review screen's areas are parts of a single task and have
 * to be visible together.
 */
const VIEWS = [
  { key: "team", label: "My team" },
  { key: "indirect", label: "Additional reports" },
  { key: "chain", label: "Report chain" },
  { key: "allocation", label: "Top 5% / 20%" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default function ParTeamPage(): JSX.Element {
  const { email } = useAsgardeoUser();
  const cycleQuery = useMyParCycle();
  const cycle = cycleQuery.data;
  const teams = useMyParTeams(cycle?.parCycleId);
  const [picked, setPicked] = useState<number | null>(null);

  // The tab lives in the URL so a lead can link to it and come back to it.
  // An unrecognised value falls back rather than rendering nothing.
  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view: ViewKey = VIEWS.some((v) => v.key === requested)
    ? (requested as ViewKey)
    : "team";

  // Only fetched once the indirect tab is opened: most leads never look, and it
  // is a whole reporting line.
  const reports = useMyReports(cycle?.parCycleId, view === "indirect");
  const allocation = useMyQuotaAllocation(cycle?.parCycleId, view === "allocation");

  const list = teams.data ?? [];
  // With exactly one team there is nothing to choose, so it opens directly.
  // Derived rather than set in an effect, so the list arriving late cannot
  // race a selection the lead has already made.
  const selectedId = picked ?? (list.length === 1 ? list[0].parTeamId : null);
  const selected = list.find((t) => t.parTeamId === selectedId);

  return (
    <ParShell
      eyebrow={{ icon: UsersRoundIcon, label: "PAR" }}
      title="My team's PAR"
      subtitle="Where your reports have got to in the current cycle."
      require="teamLead"
    >
      {cycleQuery.isPending || teams.isPending ? (
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />
      ) : cycleQuery.isError ? (
        <Alert severity="error">
          Couldn&apos;t load the current cycle. {describeError(cycleQuery.error)}
        </Alert>
      ) : cycle === undefined ? (
        <Alert severity="info">
          No review cycle is open at the moment. Your team&apos;s PARs appear here when the next
          one starts.
        </Alert>
      ) : teams.isError ? (
        <Alert severity="error">
          Couldn&apos;t load your teams. {describeError(teams.error)}
        </Alert>
      ) : list.length === 0 ? (
        // A team lead with no teams in THIS cycle is a real state — they may
        // have been assigned since it opened. Not a permission problem, so it
        // must not read like one.
        <Alert severity="info">
          You don&apos;t have any teams in {cycle.parCycleName}. If that looks wrong, a PAR
          administrator can sync your team into the cycle.
        </Alert>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2.25 }}>
            <Tabs
              value={view}
              onChange={(_e, next: ViewKey) => {
                const nextParams = new URLSearchParams(params);
                // "team" is the default, so it stays out of the URL rather than
                // leaving ?view=team on every link a lead copies.
                if (next === "team") nextParams.delete("view");
                else nextParams.set("view", next);
                setParams(nextParams, { replace: true });
              }}
            >
              {VIEWS.map((v) => (
                <Tab key={v.key} value={v.key} label={v.label} sx={{ textTransform: "none" }} />
              ))}
            </Tabs>
          </Box>

          {view === "chain" ? (
            <ParPanel>
            <ParReportChainPanel
              // Remounted per cycle so the trail cannot outlive the data it
              // was built against.
              key={cycle.parCycleId}
              parCycleId={cycle.parCycleId}
              rootEmail={email ?? ""}
              rootName="You"
            />
            </ParPanel>
          ) : view === "allocation" ? (
            <ParPanel>
              <ParAllocationPanel
                rows={allocation.data ?? []}
                isPending={allocation.isPending}
                error={allocation.isError ? allocation.error : undefined}
              />
            </ParPanel>
          ) : view === "indirect" ? (
            <ParPanel>
            <ParReportsPanel
              title="Additional reports"
              subtitle="People under your reports, and anyone attached to you as an additional manager. Their own lead reviews them."
              reports={indirectReports(reports.data ?? [])}
              isPending={reports.isPending}
              error={reports.isError ? reports.error : undefined}
            />
            </ParPanel>
          ) : (
            <TeamView
              cycle={cycle}
              list={list}
              selectedId={selectedId}
              selected={selected}
              onPick={setPicked}
            />
          )}
        </>
      )}
    </ParShell>
  );
}

/** The lead's own teams — the default tab. */
function TeamView({
  cycle,
  list,
  selectedId,
  selected,
  onPick,
}: {
  cycle: NonNullable<ReturnType<typeof useMyParCycle>["data"]>;
  list: readonly ParTeam[];
  selectedId: number | null;
  selected: ParTeam | undefined;
  onPick: (id: number | null) => void;
}): JSX.Element {
  return (
    <ParPanel>
          <AcrossAllTeams cycleName={cycle.parCycleName} teams={list} />

          {list.length > 1 && (
            <ParSection
              title="Your teams"
              subtitle="Each team carries its own Top 5% / 20% quota."
            >
              <ToggleButtonGroup
                exclusive
                value={selectedId}
                onChange={(_e, value: number | null) => onPick(value)}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                {list.map((team) => (
                  <ToggleButton
                    key={team.parTeamId}
                    value={team.parTeamId}
                    size="small"
                    sx={{ textTransform: "none", borderRadius: 1.5 }}
                  >
                    {teamLabel(team)}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={team.numberOfTeamMembers}
                      sx={{ ml: 1 }}
                    />
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </ParSection>
          )}

          {selected === undefined ? (
            <Alert severity="info">Pick a team to see its members.</Alert>
          ) : (
            <TeamDetail
              key={selected.parTeamId}
              cycleId={cycle.parCycleId}
              team={selected}
              threeSixtyDeadlinePassed={isDeadlinePassed(
                new Date(),
                cycle.parThreeSixtyRatingDeadline,
              )}
            />
          )}
    </ParPanel>
  );
}

/** Totals across every team, so a lead with several sees one figure first. */
function AcrossAllTeams({ cycleName, teams }: { cycleName: string; teams: readonly ParTeam[] }) {
  const totals = allTeamsTotals(teams);
  return (
    <ParSection
      title={cycleName}
      subtitle={
        teams.length > 1
          ? `Across all ${teams.length} of your teams.`
          : "Progress through each stage."
      }
      action={
        <Chip
          size="small"
          variant="outlined"
          label={`${totals.totalMembers} ${totals.totalMembers === 1 ? "person" : "people"}`}
        />
      }
    >
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2.5 }}>
        <ParCompletionBar
          label="Their PARs shared"
          completed={totals.employeeParComplete}
          total={totals.totalMembers}
        />
        <ParCompletionBar
          label="360° complete"
          completed={totals.threeSixtyComplete}
          total={totals.totalMembers}
        />
        <ParCompletionBar
          label="Your reviews shared"
          completed={totals.leadReviewComplete}
          total={totals.totalMembers}
        />
        <ParCompletionBar
          label="Conversations held"
          completed={totals.f2fComplete}
          total={totals.totalMembers}
        />
      </Stack>
    </ParSection>
  );
}

/** One team: its own progress, remaining quota, and its members. */
function TeamDetail({
  cycleId,
  team,
  threeSixtyDeadlinePassed,
}: {
  cycleId: number;
  team: ParTeam;
  threeSixtyDeadlinePassed: boolean;
}) {
  const report = useParTeamReport(cycleId, team.parTeamId);
  // Held here rather than in the table, so the toolbar and the rows agree, and
  // so switching team clears it — the parent keys this component on team id.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const members = report.data?.details ?? [];

  const toggle = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ParSection
      title={teamLabel(team)}
      subtitle="A special rating is refused once this team's quota is used up."
      action={
        report.data ? (
          <Stack direction="row" spacing={0.75}>
            {/* USED of allocated, which is how the standalone app puts it. An
                earlier version here showed what was LEFT, which reads absurdly
                at the start of a cycle — "21 of 21 left" — and buries the fact
                that nothing has been awarded yet. Used-of-total answers the same
                question by subtraction and reads naturally from zero. */}
            <Chip
              size="small"
              variant="outlined"
              color={report.data.available5pSlots === 0 ? "warning" : "default"}
              label={`Top 5%: ${team.numberOf5pSlots - report.data.available5pSlots} of ${team.numberOf5pSlots} used`}
            />
            <Chip
              size="small"
              variant="outlined"
              color={report.data.available20pSlots === 0 ? "warning" : "default"}
              label={`Top 20%: ${team.numberOf20pSlots - report.data.available20pSlots} of ${team.numberOf20pSlots} used`}
            />
          </Stack>
        ) : undefined
      }
    >
      {report.isPending ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : report.isError ? (
        <Alert severity="error">
          Couldn&apos;t load this team. {describeError(report.error)}
        </Alert>
      ) : report.data === undefined ? (
        <ParEmpty>
          This team has no details recorded for the cycle.
        </ParEmpty>
      ) : (
        <>
          <ParTeamToolbar
            parCycleId={cycleId}
            members={members}
            selectedIds={selectedIds}
            onClearSelection={() => setSelectedIds(new Set())}
          />
          <ParTeamMemberTable
            members={members}
            threeSixtyDeadlinePassed={threeSixtyDeadlinePassed}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={(select) =>
              setSelectedIds(select ? new Set(members.map((m) => m.parRatingId)) : new Set())
            }
          />
        </>
      )}
    </ParSection>
  );
}
