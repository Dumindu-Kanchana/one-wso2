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

import { Alert, Box, Button, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useUserInfo } from "@api/useUserInfo";
import { capabilitiesFromPrivileges } from "@constants/appMenu";

// Placeholder for My Team — mirrors people-app's lead-only "My Team" nav
// item (direct + indirect reports). The real subordinates view is on hold
// for this iteration; this just reserves the spot in the Me rail.
export default function MyTeamComingSoonPage() {
  const { data, isLoading, isError, error, isFetching, refetch } = useUserInfo();

  if (isLoading) {
    return <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1.5 }} />;
  }

  // A failed user-info fetch must not silently read as "not a lead" — that
  // hides a real, retryable error behind a message implying it's permanent.
  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        }
      >
        Couldn't check your access to My Team.
        {error instanceof Error ? ` ${error.message}` : ""}
      </Alert>
    );
  }

  const caps = capabilitiesFromPrivileges(data?.privileges);
  if (!caps.has("lead")) {
    return <Alert severity="info">My Team is available to leads.</Alert>;
  }

  return (
    <Box>
      <PerspectiveHeader eyebrow="My Team" title="My Team" subtitle="Your direct and indirect reports." />

      <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Coming soon</Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          Your team roster isn't available here yet — check back once it ships.
        </Typography>
      </Card>
    </Box>
  );
}
