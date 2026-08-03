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

import { Box, Card, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { NavLink } from "react-router";
import { useUserInfo } from "@api/useUserInfo";
import {
  CAPABILITY_LABEL,
  capabilitiesFromPrivileges,
  visibleItems,
} from "@constants/appMenu";
import { FINANCE_APPS } from "@constants/financeApps";

// Finance perspective overview — the three digiops-finance apps (OPD claims,
// credit-card expenses, expense claims), now native. Every item is a route,
// so the overview renders each visible item as a link card (the left rail
// jumps to the same routes). What shows is scoped to the caller's role.
export default function FinancePage() {
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);

  return (
    <Box>
      <Chip
        label="✦ Finance perspective"
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.5 }}>
        Finance
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2.25, maxWidth: "68ch" }}>
        Claims and card expenses in one place — jump to any area from here or the left rail.
        What you see is scoped to your role.
      </Typography>

      {FINANCE_APPS.map((app) => {
        const items = visibleItems(app, caps);
        if (items.length === 0) return null;
        return (
          <Box key={app.key}>
            <Typography
              component="h2"
              sx={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.disabled",
                fontWeight: 700,
                mt: 3,
                mb: 1.25,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
              }}
            >
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <span style={{ fontSize: 14 }}>{app.emoji}</span>
                {app.name}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 1.5, mt: -0.5 }}>
              {app.purpose}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {items.map((it) => (
                <Card
                  key={it.id}
                  component={NavLink}
                  to={it.path!}
                  variant="outlined"
                  sx={{
                    p: 1.75,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color .12s, box-shadow .12s",
                    "&:hover": { borderColor: "primary.main", boxShadow: 1 },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {it.label}
                    </Typography>
                    {it.requires && it.requires.length > 0 && (
                      <Chip
                        label={it.requires.map((r) => CAPABILITY_LABEL[r]).join(" · ")}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: 10, fontWeight: 600, borderWidth: 1.5 }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
                    {it.desc}
                  </Typography>
                </Card>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
