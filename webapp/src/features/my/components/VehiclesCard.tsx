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
import { Card, IconButton, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import DetailRow from "@components/detail-row/DetailRow";
import Pager from "@features/people-ops/components/Pager";
import type { Vehicle, VehicleType } from "../api/types";
import { useVehicles } from "../api/useVehicles";
import AddVehicleDialog from "./AddVehicleDialog";
import DeleteVehicleDialog from "./DeleteVehicleDialog";

const PAGE_SIZE = 2;
const TYPE_ICON: Record<VehicleType, string> = { CAR: "🚗", MOTORCYCLE: "🏍" };
const TYPE_LABEL: Record<VehicleType, string> = { CAR: "Car", MOTORCYCLE: "Motorcycle" };

// Live vehicles card in the ConnectedServices strip on the My profile.
// Reads from people-app's GET /employees/{email}/vehicles?vehicleStatus=ACTIVE.
// Add/delete backed by the corresponding POST and DELETE endpoints.
// Client-side paginates 2 at a time; the pager appears only when > 2.
export default function VehiclesCard({ ownerEmail }: { ownerEmail?: string }) {
  const query = useVehicles(ownerEmail);
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  const vehicles = useMemo(() => query.data?.vehicles ?? [], [query.data]);
  const pageCount = Math.max(1, Math.ceil(vehicles.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = vehicles.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Tooltip title={ownerEmail ? "Add a new vehicle" : "Sign in to add a vehicle"}>
          {/* span wrapper so Tooltip works on a disabled IconButton */}
          <span>
            <IconButton
              size="small"
              aria-label="Add vehicle"
              disabled={!ownerEmail}
              onClick={() => setAddOpen(true)}
              sx={{
                width: 22,
                height: 22,
                border: 1,
                borderColor: "divider",
                borderRadius: 0.75,
                color: "primary.main",
              }}
            >
              <PlusIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          sx={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "text.secondary",
            fontWeight: 600,
            flex: 1,
          }}
        >
          Vehicles
        </Typography>
        {vehicles.length > PAGE_SIZE && (
          <Pager
            total={vehicles.length}
            page={clampedPage}
            pageCount={pageCount}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        )}
      </Stack>

      {query.isLoading ? (
        <VehiclesSkeleton />
      ) : query.isError ? (
        <Typography sx={{ fontSize: 12.5, color: "error.main", py: 1 }}>
          Couldn't load vehicles. {query.error instanceof Error ? query.error.message : ""}
        </Typography>
      ) : vehicles.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 1.5 }}>
          No vehicles registered — click <b>+</b> to add one.
        </Typography>
      ) : (
        visible.map((v, idx) => (
          <DetailRow
            key={v.vehicleId}
            icon={TYPE_ICON[v.vehicleType] ?? "🚗"}
            title={v.vehicleRegistrationNumber}
            meta={TYPE_LABEL[v.vehicleType] ?? v.vehicleType}
            trailing={
              <IconButton
                size="small"
                aria-label={`Delete vehicle ${v.vehicleRegistrationNumber}`}
                onClick={() => setDeleteTarget(v)}
                sx={{
                  width: 26,
                  height: 26,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 0.75,
                  color: "text.secondary",
                  "&:hover": { color: "error.main", borderColor: "error.main" },
                }}
              >
                <TrashIcon />
              </IconButton>
            }
            last={idx === visible.length - 1}
          />
        ))
      )}

      <AddVehicleDialog
        open={addOpen}
        ownerEmail={ownerEmail}
        onClose={() => setAddOpen(false)}
      />
      <DeleteVehicleDialog
        vehicle={deleteTarget}
        ownerEmail={ownerEmail}
        onClose={() => setDeleteTarget(null)}
      />
    </Card>
  );
}

function VehiclesSkeleton() {
  return (
    <Stack spacing={1.25} sx={{ py: 0.5 }}>
      <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
    </Stack>
  );
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1={12} y1={5} x2={12} y2={19} />
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

