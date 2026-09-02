/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The first-visit offer. Not the tour — an invitation to it.
 *
 * Deliberately an offer rather than an auto-start: a tour that begins on its own
 * interrupts whatever someone arrived to do, and the people most likely to
 * arrive on a deep link are the ones least likely to want it. Either answer is
 * final; the tour stays reachable from the profile menu.
 */
import { Box, Button, Paper, Typography } from "@wso2/oxygen-ui";
import { CompassIcon } from "@wso2/oxygen-ui-icons-react";
import { useTour } from "./tourContext";

export default function TourPrompt() {
  const tour = useTour();
  if (!tour.shouldOffer) return null;

  return (
    <Paper
      elevation={8}
      role="region"
      aria-label="Introductory tour"
      sx={{
        position: "fixed",
        // Clear of the footer, and on the side the profile menu lives on, so the
        // eye is already in the right corner when the tour points there.
        right: 20,
        bottom: 20,
        zIndex: (t) => t.zIndex.snackbar,
        maxWidth: 340,
        p: 2,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CompassIcon size={18} />
        <Typography sx={{ fontWeight: 600 }}>New here?</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        A one-minute tour of the basics — where things are, and how to keep the pages you use.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button size="small" color="inherit" onClick={tour.decline}>
          No thanks
        </Button>
        <Button size="small" variant="contained" onClick={tour.start}>
          Take the tour
        </Button>
      </Box>
    </Paper>
  );
}
