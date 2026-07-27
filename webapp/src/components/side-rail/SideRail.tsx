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

import { Box, ListItemButton, ListItemText, Typography } from "@wso2/oxygen-ui";
import { NavLink } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { CROSS_PERSPECTIVES } from "@constants/perspectives";

// Context-sensitive left rail. Header = the active perspective; body =
// its sections (jump-anchor to canvas ids); footer = For you (My +
// Service Requests). Functional persona switching goes through the
// waffle (top-right), not the rail — the prototype behaviour.
export default function SideRail() {
  const active = useActivePerspective();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box
      component="nav"
      sx={{
        borderRight: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Scrollable body — perspective sections + For you. Settings row
          below sits pinned to the rail's viewport bottom. */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.25, py: 1.75 }}>
      {/* Active perspective header */}
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "text.disabled",
          fontWeight: 600,
          mb: 0.75,
          mx: 1,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <span style={{ fontSize: 13 }}>{active.emoji}</span>
        {active.label}
      </Typography>

      {active.sections && active.sections.length > 0 ? (
        active.sections.map((s) => (
          <ListItemButton
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}
          >
            <Box sx={{ width: 18, mr: 1.25, color: "text.disabled" }}>›</Box>
            <ListItemText
              primary={s.label}
              primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
            />
          </ListItemButton>
        ))
      ) : (
        <Box sx={{ fontSize: 11.5, color: "text.disabled", px: 1.25, py: 1, lineHeight: 1.5 }}>
          No sub-sections. Use the ⊞ waffle to switch functions.
        </Box>
      )}

      {/* For you */}
      <Typography
        sx={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "text.disabled",
          fontWeight: 600,
          mt: 1.75,
          mb: 0.75,
          mx: 1,
        }}
      >
        For you
      </Typography>
      {CROSS_PERSPECTIVES.filter((p) => p.access && p.path).map((p) => (
        <ListItemButton
          key={p.key}
          component={NavLink}
          to={p.path!}
          sx={{
            borderRadius: 1.125,
            py: 0.75,
            px: 1.25,
            "&.active": {
              bgcolor: "primary.light",
              color: "primary.main",
              "& .MuiListItemText-primary": { fontWeight: 600 },
            },
          }}
        >
          <Box sx={{ width: 18, mr: 1.25 }}>{p.emoji}</Box>
          <ListItemText
            primary={p.label}
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
          />
        </ListItemButton>
      ))}

      </Box>

      {/* Settings — pinned to the rail's viewport bottom, same treatment as
          cs-tools customer-portal. Currently inert; wire to /settings when
          the page exists. */}
      <Box
        sx={{
          borderTop: 1,
          borderColor: "divider",
          px: 1.25,
          py: 1.25,
        }}
      >
        <ListItemButton sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}>
          <Box sx={{ width: 18, mr: 1.25 }}>⚙</Box>
          <ListItemText
            primary="Settings"
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
}
