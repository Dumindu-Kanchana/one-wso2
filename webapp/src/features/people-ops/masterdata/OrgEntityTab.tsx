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

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { InboxIcon, PencilIcon, PlusIcon, SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import PersonCell from "../components/PersonCell";
import { emailKey } from "../components/employeePickerOptions";
import { fullName } from "@features/my/api/derive";
import type { OrgChartEntity, OrgEntityKind } from "../api/peopleOpsTypes";
import {
  ORG_ENTITY_CONFIG,
  useCreateOrgChartEntity,
  useEmployeesBasicInfo,
  useOrgChartEntities,
  useUpdateOrgChartEntity,
} from "../api/useOrgChartEntities";
import OrgEntityDialog from "./OrgEntityDialog";
import { filterOrgEntities, type StatusFilter } from "./orgEntityFilter";

// One kind's management table: search, an active/inactive filter, and a
// create/edit dialog. All four kinds render this — the only difference is the
// `kind` prop, which selects the endpoints and the wording.
//
// Everything here is client-side: these lists are tens of rows, not
// thousands, and the endpoints return them whole with no pagination. Filtering
// in the browser keeps it instant and avoids a request per keystroke.

// Entity labels are stored lower-case ("sub team") so they read correctly
// mid-sentence in buttons; a toast opens with one, so it needs a capital.
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function OrgEntityTab({ kind }: { kind: OrgEntityKind }) {
  const config = ORG_ENTITY_CONFIG[kind];
  const entities = useOrgChartEntities(kind);
  const createMutation = useCreateOrgChartEntity(kind);
  const { showSuccess } = useNotifications();
  const updateMutation = useUpdateOrgChartEntity(kind);

  const [search, setSearch] = useState("");
  // Defaults to active: the inactive ones are archive, and showing them by
  // default would pad the list with entities nobody can assign to.
  const [status, setStatus] = useState<StatusFilter>("active");
  const [editing, setEditing] = useState<OrgChartEntity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // The head column renders names, so search has to match them too — see
  // filterOrgEntities. Reads the roster the picker already caches, so this
  // adds no request; before it loads, search falls back to emails.
  const employees = useEmployeesBasicInfo();
  const headNameByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees.data ?? []) {
      map.set(emailKey(e.workEmail), fullName(e));
    }
    return map;
  }, [employees.data]);

  const rows = useMemo(
    () => filterOrgEntities(entities.data ?? [], search, status, (email) =>
      headNameByEmail.get(emailKey(email)),
    ),
    [entities.data, search, status, headNameByEmail],
  );

  const isPending = entities.isPending;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(entity: OrgChartEntity) {
    setEditing(entity);
    setDialogOpen(true);
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 1.5,
        }}
      >
        <TextField
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${config.pluralLabel.toLowerCase()}`}
          aria-label={`Search ${config.pluralLabel.toLowerCase()}`}
          sx={{ flex: "1 1 240px", maxWidth: 340 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                    <XIcon size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        <Select
          size="small"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
          <MenuItem value="all">All</MenuItem>
        </Select>

        <Box sx={{ flex: 1 }} />

        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={openCreate}>
          Add {config.label}
        </Button>
      </Box>

      {entities.isError && (
        <Alert
          severity="error"
          sx={{ mb: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => void entities.refetch()}>
              Retry
            </Button>
          }
        >
          Couldn't load {config.pluralLabel.toLowerCase()}. {describeError(entities.error)}
        </Alert>
      )}

      <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>{config.headColumnLabel}</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 150 }} align="right">
                Active employees
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: 110 }} align="center">
                Status
              </TableCell>
              <TableCell sx={{ width: 60 }} align="center" />
            </TableRow>
          </TableHead>

          <TableBody>
            {isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                  {/* Mirrors PersonCell's avatar + name, so the row doesn't
                      change shape when the real data lands. */}
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Skeleton variant="text" width={140} />
                    </Box>
                  </TableCell>
                  <TableCell align="right"><Skeleton variant="text" width={30} sx={{ ml: "auto" }} /></TableCell>
                  <TableCell align="center"><Skeleton variant="rounded" width={64} height={22} sx={{ mx: "auto" }} /></TableCell>
                  <TableCell align="center"><Skeleton variant="circular" width={24} height={24} sx={{ mx: "auto" }} /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ borderBottom: 0 }}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                      py: 5,
                      color: "text.disabled",
                    }}
                  >
                    <InboxIcon size={32} />
                    <Typography variant="body2">
                      {/* Distinguishes "your filters hid everything" from
                          "there is nothing here", which need different fixes. */}
                      {entities.data?.length
                        ? "No matches for these filters"
                        : `No ${config.pluralLabel.toLowerCase()} yet`}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{row.name}</TableCell>
                  <TableCell>
                    <PersonCell email={row.headEmail} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {row.activeEmployeeCount}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={row.isActive ? "Active" : "Inactive"}
                      size="small"
                      variant="outlined"
                      color={row.isActive ? "success" : "default"}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={`Edit ${row.name}`}>
                      <IconButton
                        size="small"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => openEdit(row)}
                      >
                        <PencilIcon size={15} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <OrgEntityDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        label={config.label}
        headEmailLabel={config.headEmailLabel}
        entity={editing}
        // mutateAsync, not mutate: the dialog awaits these and stays open on
        // failure to show the message, which needs a rejected promise.
        //
        // The toast is raised here rather than in the dialog because the
        // dialog is gone by the time it appears — confirmation belongs to
        // the screen you are left looking at.
        onCreate={async (payload) => {
          const result = await createMutation.mutateAsync(payload);
          showSuccess(`${capitalize(config.label)} "${payload.name}" created`);
          return result;
        }}
        onUpdate={async (id, payload) => {
          const result = await updateMutation.mutateAsync({ id, payload });
          // Names the entity by what it is called AFTER the edit, so a
          // rename confirms the new name rather than the one just replaced.
          // Not capitalized — this is a proper name, and forcing a capital
          // would misspell one that is legitimately lower-case.
          showSuccess(`${capitalize(config.label)} "${payload.name ?? editing?.name}" updated`);
          return result;
        }}
      />
    </Box>
  );
}
