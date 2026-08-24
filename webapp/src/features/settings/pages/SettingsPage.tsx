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

import { Box, MenuItem, TextField, Typography } from "@wso2/oxygen-ui";
import { useState, type JSX } from "react";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import {
  deploymentLandingKey,
  landingOptions,
  landingPreference,
  setLandingPreference,
} from "@config/landingConfig";

/** Sentinel for "no preference of my own", which is not the same as choosing Me. */
const FOLLOW_DEPLOYMENT = "";

export default function SettingsPage(): JSX.Element {
  const options = landingOptions();
  const [choice, setChoice] = useState<string>(() => landingPreference() ?? FOLLOW_DEPLOYMENT);

  const deploymentKey = deploymentLandingKey();
  const deploymentLabel =
    options.find((o) => o.key === deploymentKey)?.label ?? deploymentKey;

  const handleChange = (next: string) => {
    setChoice(next);
    setLandingPreference(next === FOLLOW_DEPLOYMENT ? undefined : next);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PerspectiveHeader
        title="Settings"
        subtitle="Preferences that apply to you, on this browser."
      />

      <Box sx={{ maxWidth: 420 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Open on"
          value={choice}
          onChange={(e) => handleChange(e.target.value)}
          helperText={
            choice === FOLLOW_DEPLOYMENT
              ? `Following the default set for this deployment (${deploymentLabel}).`
              : "Saved. This overrides the deployment default."
          }
        >
          {/* Kept as a distinct option rather than pre-selecting the deployment
              value: choosing "follow the default" means this user keeps moving
              when that default changes, where picking the same perspective
              explicitly would pin them to it. */}
          <MenuItem value={FOLLOW_DEPLOYMENT}>
            Deployment default ({deploymentLabel})
          </MenuItem>
          {options.map((o) => (
            <MenuItem key={o.key} value={o.key}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Takes effect the next time you open One WSO2 without a specific page in
          the address bar.
        </Typography>
      </Box>
    </Box>
  );
}
