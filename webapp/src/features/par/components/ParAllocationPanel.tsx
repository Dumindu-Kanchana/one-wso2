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
  OutlinedInput,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import type { ParSpecialRatingAllocation } from "../api/parTypes";
import {
  allocationTeamLabel,
  groupAllocationsByQuota,
  isFlexibleSlot,
  matchesAllocationSearch,
} from "../util/parAllocation";
import ParSection from "./ParSection";

// How much Top 5% / 20% each quota group holds, and which teams draw from it.
//
// Read-only for a lead: quota is set by an administrator before the cycle opens.
// It matters here because the server refuses a special rating once a group is
// used up, and a lead who cannot see the pool has no way to anticipate that.

export default function ParAllocationPanel({
  rows,
  isPending,
  error,
}: {
  rows: readonly ParSpecialRatingAllocation[];
  isPending: boolean;
  error?: unknown;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const groups = groupAllocationsByQuota(rows);
  // Groups are kept whole and their teams narrowed, rather than dropping a
  // group whose name does not match — the quota belongs to the group, so
  // hiding it would hide the figure the search was looking for.
  const shown = groups
    .map((g) => ({ ...g, teams: g.teams.filter((t) => matchesAllocationSearch(t, query)) }))
    .filter((g) => g.teams.length > 0);

  return (
    <ParSection
      title="Top 5% / 20% allocation"
      subtitle="Set by a PAR administrator. A rating is refused once its group is used up."
    >
      {error ? (
        <Alert severity="error">Couldn&apos;t load the allocation. {describeError(error)}</Alert>
      ) : isPending ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />
      ) : groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No Top 5% / 20% quota has been allocated for your teams in this cycle.
        </Typography>
      ) : (
        <>
          <OutlinedInput
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by business unit, department or team"
            startAdornment={
              <Box sx={{ display: "inline-flex", mr: 0.75, color: "text.secondary" }}>
                <SearchIcon size={15} />
              </Box>
            }
            slotProps={{ input: { "aria-label": "Search allocation" } }}
            sx={{ height: 36, fontSize: 13, width: { xs: "100%", sm: 360 }, mb: 2 }}
          />

          {shown.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No team here matches that.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {shown.map((group) => (
                <Box
                  key={group.quotaId}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.75 }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 1.5,
                      flexWrap: "wrap",
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {group.name}
                    </Typography>
                    {isFlexibleSlot(group) ? (
                      // Read literally this group says "one Top 5%, no Top 20%",
                      // which would tell a lead they cannot award something they
                      // can. It is one slot usable as either.
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        label="1 slot · Top 5% or Top 20%"
                      />
                    ) : (
                      <Stack direction="row" spacing={0.75}>
                        <Chip size="small" variant="outlined" label={`Top 5%: ${group.top5Quota}`} />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Top 20%: ${group.top20Quota}`}
                        />
                      </Stack>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    TEAMS DRAWING FROM IT
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
                    {group.teams.map((t, i) => (
                      <Chip
                        key={`${t.parQuotaId}-${i}`}
                        size="small"
                        label={allocationTeamLabel(t)}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </ParSection>
  );
}
