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
  Breadcrumbs,
  Button,
  Chip,
  Link,
  OutlinedInput,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useDirectoryReports } from "../api/useParDirectory";
import { parseTextBoolean } from "../util/parReports";
import {
  chainBack,
  chainPush,
  chainTruncate,
  type ParChainStep,
} from "../util/parChain";
import ParPastCyclesPanel, { type ParPastCyclesCopy } from "./ParPastCyclesPanel";
import ParSection from "./ParSection";

// Browsing PAR history down a reporting line.
//
// The chain view the source paired with PAR History, deferred out of Slice 2
// because its gate depended on an unresolved question — see §2.1, now settled:
// it needs the `lead` flag AND the directory agreeing the person has reports.
//
// Distinct from the report chain on the team screen, which walks the same
// structure over the OPEN cycle's PARs. This one reads the directory, so it
// reaches people who were not in that cycle, or in any.

const PERSON_HISTORY: ParPastCyclesCopy = {
  title: "Their closed cycles",
  subtitle: "Newest first. Open one to read what was written.",
  none: "They don't have any closed cycles.",
  employeeHeading: "WHAT THEY WROTE",
  leadHeading: "WHAT THEIR LEAD WROTE",
  employeeSilent: "They didn't write anything for that cycle.",
  leadSilent: "Their lead didn't leave written feedback.",
  ownerLabel: "Theirs",
};

export default function ParTeamHistoryPanel({
  rootEmail,
  rootName,
}: {
  rootEmail: string;
  rootName: string;
}): JSX.Element {
  const [trail, setTrail] = useState<ParChainStep[]>([
    { email: rootEmail, name: rootName },
  ]);
  const [query, setQuery] = useState("");
  // Whose history is open, if any. Separate from the trail: looking at
  // somebody's history is not the same as drilling into their team, and
  // conflating them would make every drill also a read of their appraisals.
  const [reading, setReading] = useState<ParChainStep | null>(null);

  const current = trail[trail.length - 1];
  const people = useDirectoryReports(current.email);
  const term = query.trim().toLowerCase();
  const rows = (people.data ?? []).filter(
    (p) =>
      term === "" ||
      (p.employeeName ?? "").toLowerCase().includes(term) ||
      p.workEmail.toLowerCase().includes(term),
  );

  return (
    <>
      <ParSection
        title="Team history"
        subtitle="Past appraisals for anyone in your reporting line, however far down."
        action={
          trail.length > 1 ? (
            <Button
              size="small"
              startIcon={<ArrowLeftIcon size={15} />}
              onClick={() => {
                setTrail(chainBack(trail));
                setReading(null);
                setQuery("");
              }}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Back
            </Button>
          ) : undefined
        }
      >
        <Breadcrumbs separator={<ChevronRightIcon size={14} />} sx={{ mb: 1.75 }}>
          {trail.map((step, i) =>
            i === trail.length - 1 ? (
              <Typography key={step.email} variant="body2" sx={{ fontWeight: 700 }}>
                {step.name}
              </Typography>
            ) : (
              <Link
                key={step.email}
                component="button"
                type="button"
                variant="body2"
                onClick={() => {
                  setTrail(chainTruncate(trail, i));
                  setReading(null);
                  setQuery("");
                }}
                sx={{ cursor: "pointer" }}
              >
                {step.name}
              </Link>
            ),
          )}
        </Breadcrumbs>

        {people.isError ? (
          <Alert severity="error">
            Couldn&apos;t load {current.name}&apos;s reports. {describeError(people.error)}
          </Alert>
        ) : people.isPending ? (
          <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1.5 }} />
        ) : (people.data ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {trail.length === 1
              ? "Nobody reports to you."
              : `${current.name} has nobody reporting to them.`}
          </Typography>
        ) : (
          <>
            <OutlinedInput
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this level"
              startAdornment={
                <Box sx={{ display: "inline-flex", mr: 0.75, color: "text.secondary" }}>
                  <SearchIcon size={15} />
                </Box>
              }
              slotProps={{ input: { "aria-label": "Search this level" } }}
              sx={{ height: 36, fontSize: 13, width: { xs: "100%", sm: 300 }, mb: 1.75 }}
            />

            {rows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nobody at this level matches that.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {rows.map((p) => {
                  const name = p.employeeName ?? p.workEmail;
                  const hasReports = parseTextBoolean(p.isLead);
                  const isReading = reading?.email === p.workEmail;
                  return (
                    <Stack
                      key={p.workEmail}
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 1.5,
                        py: 1,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.workEmail}
                        </Typography>
                      </Box>
                      {hasReports && <Chip size="small" variant="outlined" label="Lead" />}
                      <Button
                        size="small"
                        variant={isReading ? "contained" : "outlined"}
                        onClick={() =>
                          setReading(isReading ? null : { email: p.workEmail, name })
                        }
                        sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
                      >
                        {isReading ? "Hide history" : "History"}
                      </Button>
                      {/* Only for somebody who has reports: a leaf drills into
                          an empty level, which reads as a broken control. */}
                      {hasReports && (
                        <Button
                          size="small"
                          endIcon={<ChevronRightIcon size={14} />}
                          onClick={() => {
                            setTrail(chainPush(trail, { email: p.workEmail, name }));
                            setReading(null);
                            setQuery("");
                          }}
                          sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
                        >
                          Their team
                        </Button>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </>
        )}
      </ParSection>

      {/* Remounted per person, so opening someone else's history cannot show
          the previous person's cycles while the new ones load. */}
      {reading !== null && (
        <ParPastCyclesPanel
          key={reading.email}
          employeeEmail={reading.email}
          copy={{ ...PERSON_HISTORY, title: `${reading.name} · closed cycles` }}
        />
      )}
    </>
  );
}
