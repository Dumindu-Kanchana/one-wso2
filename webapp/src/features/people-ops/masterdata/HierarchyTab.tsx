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

import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronRightIcon, PencilIcon, PlusIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import PersonCell from "../components/PersonCell";
import type {
  MappingLevel,
  OrgChartNode,
  UpdateMappingPayload,
} from "../api/peopleOpsTypes";
import { useCreateMapping, useOrgHierarchy, useUpdateMapping } from "../api/useOrgHierarchy";
import { useOrgChartEntities } from "../api/useOrgChartEntities";
import AssignEntityDialog from "./AssignEntityDialog";
import EditMappingDialog from "./EditMappingDialog";
import {
  availableEntities,
  nodeStatusNote,
  sortBusinessUnits,
  sortNodes,
} from "./hierarchyLogic";

// The org chart as four drill-down columns: business unit → team → sub team →
// unit. Picking an item in one column fills the next.
//
// Columns rather than an expanding tree because the depth is fixed at four
// and the levels are named. A tree makes you hold the level in your head; four
// labelled columns say where you are, and keep the siblings of every ancestor
// visible while you work.
//
// Selection below is stored as MAPPING ids for teams and sub teams, not entity
// ids — a team under two business units is two different placements with
// different children, and keying on the entity would merge them.

export default function HierarchyTab() {
  const hierarchy = useOrgHierarchy();
  const { showSuccess } = useNotifications();

  const [selectedBuId, setSelectedBuId] = useState<number | null>(null);
  const [selectedTeamMappingId, setSelectedTeamMappingId] = useState<number | null>(null);
  const [selectedSubTeamMappingId, setSelectedSubTeamMappingId] = useState<number | null>(null);

  const [assignLevel, setAssignLevel] = useState<MappingLevel | null>(null);

  // The pool to assign from — an entity has to exist before it can be placed.
  // Each fetches only once its own Add dialog opens: browsing the tree is the
  // common case and needs none of them, so loading all three on mount would
  // be three requests nobody asked for. They are cached, so the dialog is
  // instant on every subsequent open.
  const teams = useOrgChartEntities("team", assignLevel === "team");
  const subTeams = useOrgChartEntities("subTeam", assignLevel === "subTeam");
  const units = useOrgChartEntities("unit", assignLevel === "unit");
  const [editing, setEditing] = useState<{ level: MappingLevel; node: OrgChartNode } | null>(
    null,
  );

  const createTeam = useCreateMapping("team");
  const createSubTeam = useCreateMapping("subTeam");
  const createUnit = useCreateMapping("unit");
  const updateTeam = useUpdateMapping("team");
  const updateSubTeam = useUpdateMapping("subTeam");
  const updateUnit = useUpdateMapping("unit");

  const businessUnits = useMemo(
    () => sortBusinessUnits(hierarchy.data ?? []),
    [hierarchy.data],
  );

  // Each selection is resolved from the freshly fetched tree rather than
  // stored as an object, so a refetch after a save updates what is on screen
  // instead of leaving a stale copy selected.
  const selectedBu = businessUnits.find((bu) => bu.id === selectedBuId) ?? null;
  const teamNodes = useMemo(() => sortNodes(selectedBu?.teams ?? []), [selectedBu]);
  const selectedTeam =
    teamNodes.find((t) => t.mappingId === selectedTeamMappingId) ?? null;
  const subTeamNodes = useMemo(() => sortNodes(selectedTeam?.subTeams ?? []), [selectedTeam]);
  const selectedSubTeam =
    subTeamNodes.find((st) => st.mappingId === selectedSubTeamMappingId) ?? null;
  const unitNodes = useMemo(() => sortNodes(selectedSubTeam?.units ?? []), [selectedSubTeam]);

  // Selecting an ancestor clears its descendants: a sub team selected under
  // the previous team is meaningless under a new one, and leaving it would
  // show a fourth column belonging to a branch nobody is looking at.
  function selectBu(id: number) {
    setSelectedBuId((prev) => (prev === id ? null : id));
    setSelectedTeamMappingId(null);
    setSelectedSubTeamMappingId(null);
  }
  function selectTeam(mappingId: number) {
    setSelectedTeamMappingId((prev) => (prev === mappingId ? null : mappingId));
    setSelectedSubTeamMappingId(null);
  }

  const assignOptions = useMemo(() => {
    if (assignLevel === "team") return availableEntities(teams.data ?? [], selectedBu?.teams ?? []);
    if (assignLevel === "subTeam")
      return availableEntities(subTeams.data ?? [], selectedTeam?.subTeams ?? []);
    if (assignLevel === "unit")
      return availableEntities(units.data ?? [], selectedSubTeam?.units ?? []);
    return [];
  }, [assignLevel, teams.data, subTeams.data, units.data, selectedBu, selectedTeam, selectedSubTeam]);

  async function handleAssign(entityId: number, headEmail: string) {
    const head = headEmail || undefined;
    if (assignLevel === "team" && selectedBu) {
      // A team is placed by ENTITY ids — the business unit's and the team's.
      await createTeam.mutateAsync({
        businessUnitId: selectedBu.id,
        teamId: entityId,
        headEmail: head,
      });
      showSuccess(`Team added to ${selectedBu.name}`);
    } else if (assignLevel === "subTeam" && selectedTeam) {
      // Below the top level the parent is a MAPPING id, not an entity id —
      // the sub team hangs off this team-in-this-BU, not off the team.
      await createSubTeam.mutateAsync({
        businessUnitTeamId: selectedTeam.mappingId,
        subTeamId: entityId,
        headEmail: head,
      });
      showSuccess(`Sub team added to ${selectedTeam.name}`);
    } else if (assignLevel === "unit" && selectedSubTeam) {
      await createUnit.mutateAsync({
        businessUnitTeamSubTeamId: selectedSubTeam.mappingId,
        unitId: entityId,
        headEmail: head,
      });
      showSuccess(`Unit added to ${selectedSubTeam.name}`);
    }
  }

  async function handleEdit(mappingId: number, payload: UpdateMappingPayload) {
    if (!editing) return;
    const mutation =
      editing.level === "team" ? updateTeam : editing.level === "subTeam" ? updateSubTeam : updateUnit;
    await mutation.mutateAsync({ mappingId, payload });
    showSuccess(`${editing.node.name} updated`);
  }

  if (hierarchy.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void hierarchy.refetch()}>
            Retry
          </Button>
        }
      >
        Couldn't load the org structure. {describeError(hierarchy.error)}
      </Alert>
    );
  }

  const assignLabels: Record<MappingLevel, string> = {
    team: "team",
    subTeam: "sub team",
    unit: "unit",
  };

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          minHeight: 420,
        }}
      >
        <Column
          title="Business units"
          loading={hierarchy.isPending}
          empty={businessUnits.length === 0 ? "No business units yet" : null}
        >
          {businessUnits.map((bu) => (
            <Row
              key={bu.id}
              name={bu.name}
              headEmail={bu.headEmail}
              selected={bu.id === selectedBuId}
              dimmed={!bu.isActive}
              statusNote={bu.isActive ? null : "Deactivated"}
              hasChildren={bu.teams.length > 0}
              onClick={() => selectBu(bu.id)}
            />
          ))}
        </Column>

        <Column
          title="Teams"
          loading={hierarchy.isPending}
          onAssign={selectedBu ? () => setAssignLevel("team") : undefined}
          assignHint={selectedBu ? undefined : "Select a business unit first"}
          empty={
            !selectedBu
              ? "Select a business unit"
              : teamNodes.length === 0
                ? "No teams here yet"
                : null
          }
        >
          {teamNodes.map((team) => (
            <Row
              key={team.mappingId}
              name={team.name}
              headEmail={team.mappingHeadEmail}
              selected={team.mappingId === selectedTeamMappingId}
              dimmed={!team.isActive || !team.mappingIsActive}
              statusNote={nodeStatusNote(team)}
              hasChildren={team.subTeams.length > 0}
              onClick={() => selectTeam(team.mappingId)}
              onEdit={() => setEditing({ level: "team", node: team })}
            />
          ))}
        </Column>

        <Column
          title="Sub teams"
          loading={hierarchy.isPending}
          onAssign={selectedTeam ? () => setAssignLevel("subTeam") : undefined}
          assignHint={selectedTeam ? undefined : "Select a team first"}
          empty={
            !selectedTeam
              ? "Select a team"
              : subTeamNodes.length === 0
                ? "No sub teams here yet"
                : null
          }
        >
          {subTeamNodes.map((subTeam) => (
            <Row
              key={subTeam.mappingId}
              name={subTeam.name}
              headEmail={subTeam.mappingHeadEmail}
              selected={subTeam.mappingId === selectedSubTeamMappingId}
              dimmed={!subTeam.isActive || !subTeam.mappingIsActive}
              statusNote={nodeStatusNote(subTeam)}
              hasChildren={subTeam.units.length > 0}
              onClick={() => setSelectedSubTeamMappingId((prev) =>
                prev === subTeam.mappingId ? null : subTeam.mappingId,
              )}
              onEdit={() => setEditing({ level: "subTeam", node: subTeam })}
            />
          ))}
        </Column>

        <Column
          title="Units"
          loading={hierarchy.isPending}
          onAssign={selectedSubTeam ? () => setAssignLevel("unit") : undefined}
          assignHint={selectedSubTeam ? undefined : "Select a sub team first"}
          empty={
            !selectedSubTeam
              ? "Select a sub team"
              : unitNodes.length === 0
                ? "No units here yet"
                : null
          }
          last
        >
          {unitNodes.map((unit) => (
            <Row
              key={unit.mappingId}
              name={unit.name}
              headEmail={unit.mappingHeadEmail}
              dimmed={!unit.isActive || !unit.mappingIsActive}
              statusNote={nodeStatusNote(unit)}
              onEdit={() => setEditing({ level: "unit", node: unit })}
            />
          ))}
        </Column>
      </Box>

      <AssignEntityDialog
        open={assignLevel !== null}
        onClose={() => setAssignLevel(null)}
        entityLabel={assignLevel ? assignLabels[assignLevel] : ""}
        parentLabel={
          assignLevel === "team"
            ? (selectedBu?.name ?? "")
            : assignLevel === "subTeam"
              ? (selectedTeam?.name ?? "")
              : (selectedSubTeam?.name ?? "")
        }
        options={assignOptions}
        // The entity list is fetched on open, so the dialog has to tell
        // "still loading" from "nothing left to add" — they look identical
        // as an empty array but mean opposite things.
        loadingOptions={
          assignLevel === "team"
            ? teams.isPending
            : assignLevel === "subTeam"
              ? subTeams.isPending
              : assignLevel === "unit"
                ? units.isPending
                : false
        }
        onSubmit={handleAssign}
      />

      <EditMappingDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        entityLabel={editing ? assignLabels[editing.level] : ""}
        node={editing?.node ?? null}
        parentLabel={
          editing?.level === "team"
            ? (selectedBu?.name ?? "")
            : editing?.level === "subTeam"
              ? (selectedTeam?.name ?? "")
              : (selectedSubTeam?.name ?? "")
        }
        onSubmit={handleEdit}
      />
    </Box>
  );
}

// ---- column + row -----------------------------------------------------------

function Column({
  title,
  loading,
  empty,
  onAssign,
  assignHint,
  last,
  children,
}: {
  title: string;
  loading?: boolean;
  /** Message to show instead of children; null when there is content. */
  empty: string | null;
  onAssign?: () => void;
  /** Why assigning isn't available — shown as a tooltip on the disabled button. */
  assignHint?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        borderRight: last ? 0 : { md: 1 },
        borderBottom: { xs: 1, md: 0 },
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 1.5,
          py: 1,
          minHeight: 48,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {/* The button is rendered even when unavailable, with the reason on
            hover — a control that appears only sometimes is harder to find
            than one that explains itself. */}
        {(onAssign || assignHint) && (
          <Tooltip title={assignHint ?? ""}>
            <Box component="span">
              <Button
                size="small"
                startIcon={<PlusIcon size={14} />}
                onClick={onAssign}
                disabled={!onAssign}
                sx={{ minWidth: 0 }}
              >
                Add
              </Button>
            </Box>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", maxHeight: 480 }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="45%" height={14} />
            </Box>
          ))
        ) : empty ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.disabled">
              {empty}
            </Typography>
          </Box>
        ) : (
          children
        )}
      </Box>
    </Box>
  );
}

function Row({
  name,
  headEmail,
  selected,
  dimmed,
  statusNote,
  hasChildren,
  onClick,
  onEdit,
}: {
  name: string;
  headEmail: string;
  selected?: boolean;
  dimmed?: boolean;
  statusNote: string | null;
  hasChildren?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.5,
        py: 1,
        borderBottom: 1,
        borderColor: "divider",
        cursor: onClick ? "pointer" : "default",
        bgcolor: selected ? "action.selected" : "transparent",
        opacity: dimmed ? 0.55 : 1,
        "&:hover": { bgcolor: selected ? "action.selected" : "action.hover" },
        "&:hover .row-edit": { opacity: 1 },
      }}
      onClick={onClick}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: selected ? 700 : 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </Typography>
          {statusNote && (
            <Chip label={statusNote} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          )}
        </Box>
        <PersonCell email={headEmail} placeholder="No head" />
      </Box>

      {onEdit && (
        <IconButton
          className="row-edit"
          size="small"
          aria-label={`Edit ${name}`}
          onClick={(e) => {
            // Without this the row's own onClick also fires, changing the
            // selection behind the dialog that is opening.
            e.stopPropagation();
            onEdit();
          }}
          sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity .12s" }}
        >
          <PencilIcon size={14} />
        </IconButton>
      )}
      {/* Only where there is something to drill into, so the affordance
          means "this goes somewhere" rather than decorating every row. */}
      {hasChildren && <ChevronRightIcon size={14} opacity={0.45} />}
    </Box>
  );
}
