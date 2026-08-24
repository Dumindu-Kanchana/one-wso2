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

import type React from "react";
import { Box, Card, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { Link as RouterLink } from "react-router";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";
import { useUserInfo } from "@api/useUserInfo";
import {
  CAPABILITY_LABEL,
  capabilitiesFromPrivileges,
  visibleItems,
  type MenuApp,
  type MenuAppItem,
} from "@constants/appMenu";

// Generic persona canvas: renders a persona's App → items registry as a section
// per app with a card per item, filtered by the caller's capabilities.
//
// An item WITHOUT a path is a scroll target the left rail jumps to; an item WITH
// one navigates. Routed items used to be filtered out entirely, on the reasoning
// that the rail already reaches them — but that made a fully-routed app render
// nothing at all, taking its section heading and purpose line with it. The
// overview is a map of the perspective, so every visible item belongs on it.
//
// Sole consumer: the Workspace overview page.
export default function AppMenuBoard({ apps }: { apps: readonly MenuApp[] }) {
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);

  return (
    <>
      {apps.map((app) => {
        const items = visibleItems(app, caps);
        if (items.length === 0) return null;
        return (
          <Box key={app.key}>
            <SectionHeader id={`sec-app-${app.key}`} icon={app.icon} label={app.name} />
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
                <ItemCard key={it.id} item={it} />
              ))}
            </Box>
          </Box>
        );
      })}
    </>
  );
}

function SectionHeader({ id, icon: Icon, label }: { id: string; icon: LucideIcon; label: string }) {
  return (
    <Typography
      id={id}
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
        scrollMarginTop: 14,
        "&::after": { content: '""', flex: 1, height: "1px", bgcolor: "divider" },
      }}
    >
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        <Icon size={14} />
        {label}
      </Box>
    </Typography>
  );
}

function ItemCard({ item }: { item: MenuAppItem }) {
  // A routed item is a link; an anchor item is a scroll target the rail jumps
  // to. `id` stays on both, since the rail addresses cards by it either way.
  const routed = Boolean(item.path);
  return (
    <Card
      id={item.id}
      variant="outlined"
      {...(item.path
        ? { component: RouterLink as React.ElementType, to: item.path, style: { textDecoration: "none" } }
        : {})}
      sx={{
        p: 1.75,
        scrollMarginTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        color: "text.primary",
        ...(routed && {
          transition: "border-color .15s, background-color .15s",
          "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
          "&:focus-visible": {
            outline: 2,
            outlineStyle: "solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }}>
          {item.label}
        </Typography>
        {item.requires && item.requires.length > 0 && (
          <Chip
            label={item.requires.map((r) => CAPABILITY_LABEL[r]).join(" · ")}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: 10, fontWeight: 600, borderWidth: 1.5 }}
          />
        )}
      </Stack>
      <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
        {item.desc}
      </Typography>
    </Card>
  );
}
