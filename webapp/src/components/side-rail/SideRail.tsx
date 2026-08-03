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

import { useState } from "react";
import { Box, ListItemButton, ListItemText, Typography } from "@wso2/oxygen-ui";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useActivePerspective } from "@context/perspective/PerspectiveContext";
import { CROSS_PERSPECTIVES, type PerspectiveSection } from "@constants/perspectives";
import { capabilitiesFromPrivileges, type Capability } from "@constants/appMenu";
import { useUserInfo } from "@api/useUserInfo";

// Context-sensitive left rail. Header = the active perspective; body =
// its sections (jump-anchor to canvas ids); footer = For you (My +
// Service Requests). Functional persona switching goes through the
// waffle (top-right), not the rail — the prototype behaviour.
//
// Sections render generically from the perspective registry: a leaf
// section is a scroll-anchor button; a section with `children` (People
// Ops apps) renders as a collapsible group whose children are filtered
// by the caller's capabilities. A group with a single visible child
// collapses to a plain leaf (e.g. Menu → its one Home item).
export default function SideRail() {
  const active = useActivePerspective();
  const userInfo = useUserInfo();
  const caps = capabilitiesFromPrivileges(userInfo.data?.privileges);
  const navigate = useNavigate();
  const location = useLocation();

  // App groups start expanded so the menu is immediately useful; a group
  // id in this set is collapsed.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Scroll a canvas anchor into view. If we're on a sub-route of the
  // perspective (e.g. a Leave screen) rather than its overview page, jump
  // to the overview first, then scroll once its DOM has mounted.
  const basePath = active.path;
  const scrollToSection = (id: string) => {
    const doScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (basePath && location.pathname !== basePath) {
      navigate(basePath);
      // Give the overview page a beat to render its anchor cards.
      window.setTimeout(doScroll, 80);
    } else {
      doScroll();
    }
  };

  const sections = active.sections ?? [];
  const crossPerspectives = CROSS_PERSPECTIVES.filter((p) => p.access && p.path);

  // The perspective eyebrow ("FINANCE", "PEOPLE OPS", …). When the
  // perspective has a landing route, the whole header links to it.
  const perspectiveHeaderSx = {
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
  } as const;
  const headerInner = (
    <>
      <span style={{ fontSize: 13 }}>{active.emoji}</span>
      {active.label}
    </>
  );

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
        {/* Active perspective header — links to the perspective's landing
            page when it has one (e.g. Finance → /finance overview). */}
        {active.path ? (
          <Typography
            component={NavLink}
            to={active.path}
            sx={{
              ...perspectiveHeaderSx,
              textDecoration: "none",
              cursor: "pointer",
              "&:hover": { color: "text.secondary" },
              "&.active": { color: "primary.main" },
            }}
            end
          >
            {headerInner}
          </Typography>
        ) : (
          <Typography sx={perspectiveHeaderSx}>{headerInner}</Typography>
        )}

        {sections.length > 0 ? (
          sections.map((s) => (
            <SectionNode
              key={s.id}
              section={s}
              caps={caps}
              collapsed={collapsed}
              onToggle={toggle}
              onScroll={scrollToSection}
            />
          ))
        ) : (
          <Box sx={{ fontSize: 11.5, color: "text.disabled", px: 1.25, py: 1, lineHeight: 1.5 }}>
            No sub-sections. Use the ⊞ waffle to switch functions.
          </Box>
        )}

        {/* For you — only render when there's at least one accessible
            cross-cutting perspective (currently none by default; the
            header would otherwise sit above an empty list). */}
        {crossPerspectives.length > 0 && (
          <>
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
            {crossPerspectives.map((p) => (
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
          </>
        )}
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

function sectionAllowed(requires: Capability[] | undefined, caps: Set<Capability>): boolean {
  if (!requires || requires.length === 0) return true;
  return requires.some((r) => caps.has(r));
}

// Renders one section: an app group (collapsible), a single-child group
// collapsed to a leaf, or a plain scroll-anchor leaf.
function SectionNode({
  section,
  caps,
  collapsed,
  onToggle,
  onScroll,
}: {
  section: PerspectiveSection;
  caps: Set<Capability>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onScroll: (id: string) => void;
}) {
  // Group section (has children) — filter children by capability.
  if (section.children && section.children.length > 0) {
    const visible = section.children.filter((c) => sectionAllowed(c.requires, caps));
    if (visible.length === 0) return null;

    // Single visible child → collapse the whole app to a plain leaf that
    // scrolls (or routes) straight to it (e.g. Menu → Home).
    if (visible.length === 1) {
      const only = visible[0];
      return (
        <Leaf
          label={section.label}
          emoji={section.emoji}
          to={only.path}
          onClick={() => onScroll(only.id)}
        />
      );
    }

    const isOpen = !collapsed.has(section.id);
    return (
      <>
        <ListItemButton
          onClick={() => onToggle(section.id)}
          sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}
        >
          <Box sx={{ width: 18, mr: 1.25, fontSize: 13, textAlign: "center" }}>{section.emoji}</Box>
          <ListItemText
            primary={section.label}
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
          />
          <Chevron open={isOpen} />
        </ListItemButton>
        {isOpen &&
          visible.map((c) =>
            c.path ? (
              <ListItemButton
                key={c.id}
                component={NavLink}
                to={c.path}
                sx={{
                  borderRadius: 1.125,
                  py: 0.5,
                  pl: 4.5,
                  pr: 1.25,
                  "&.active .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
                }}
              >
                <ListItemText
                  primary={c.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}
                />
              </ListItemButton>
            ) : (
              <ListItemButton
                key={c.id}
                onClick={() => onScroll(c.id)}
                sx={{ borderRadius: 1.125, py: 0.5, pl: 4.5, pr: 1.25 }}
              >
                <ListItemText
                  primary={c.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}
                />
              </ListItemButton>
            ),
          )}
      </>
    );
  }

  // Leaf section — a route (e.g. Dashboard) when it has a `path`, otherwise
  // a scroll-anchor (e.g. the My perspective's General/Personal sections).
  if (!sectionAllowed(section.requires, caps)) return null;
  return (
    <Leaf
      label={section.label}
      emoji={section.emoji}
      bullet
      to={section.path}
      onClick={() => onScroll(section.id)}
    />
  );
}

function Leaf({
  label,
  emoji,
  bullet,
  to,
  onClick,
}: {
  label: string;
  emoji?: string;
  bullet?: boolean;
  // When present, render as a route link (active-highlighted); otherwise
  // an onClick button (scroll-anchor).
  to?: string;
  onClick: () => void;
}) {
  const inner = (
    <>
      <Box sx={{ width: 18, mr: 1.25, color: emoji ? undefined : "text.disabled", fontSize: emoji ? 13 : undefined, textAlign: "center" }}>
        {emoji ?? (bullet ? "›" : null)}
      </Box>
      <ListItemText
        primary={label}
        primaryTypographyProps={{ fontSize: 13.5, fontWeight: emoji ? 600 : 500 }}
      />
    </>
  );
  if (to) {
    return (
      <ListItemButton
        component={NavLink}
        to={to}
        sx={{
          borderRadius: 1.125,
          py: 0.75,
          px: 1.25,
          "&.active .MuiListItemText-primary": { color: "primary.main", fontWeight: 700 },
        }}
      >
        {inner}
      </ListItemButton>
    );
  }
  return (
    <ListItemButton onClick={onClick} sx={{ borderRadius: 1.125, py: 0.75, px: 1.25 }}>
      {inner}
    </ListItemButton>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      sx={{
        width: 15,
        height: 15,
        color: "text.disabled",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform .15s",
        flexShrink: 0,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </Box>
  );
}
