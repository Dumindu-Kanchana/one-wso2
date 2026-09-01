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

import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { Alert, Skeleton } from "@wso2/oxygen-ui";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import LeaveShell from "../components/LeaveShell";
import { useLeaveGate } from "../api/useLeaveGate";
import { firstAllowedTab, leaveGroup, type LeaveGateId, type LeaveGroupDef } from "../leaveTabs";

// One page frame for all four Leave groups: the shell, the tab bar, and an
// <Outlet /> for whichever tab the URL names.
//
// The tab bar is filtered by the same gate that guards the tab routes, so the
// bar cannot offer something the route would refuse — but the route is the
// thing that actually enforces it. Hiding a tab is not access control; the URL
// can be typed.
export default function LeaveGroupPage({ groupKey }: { groupKey: LeaveGroupDef["key"] }) {
  const group = leaveGroup(groupKey);
  const gate = useLeaveGate();
  const visible = group.tabs.filter((t) => gate.canSee(t.gateId));

  return (
    <LeaveShell title={group.title} subtitle={group.subtitle}>
      {gate.isResolving ? (
        <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 1.5 }} />
      ) : visible.length === 0 ? (
        <Alert severity="info">This isn&apos;t available for your role.</Alert>
      ) : (
        <>
          {/* Drawn even for a single tab. A lead's Reports group and a
              People-Ops-only account's both have two, but Approve can collapse
              to one, and without the label the screen reads as whatever the
              subtitle says. */}
          <RoutedTabs basePath={group.path} tabs={visible} ariaLabel={`${group.title} sections`} />
          <Outlet />
        </>
      )}
    </LeaveShell>
  );
}

/**
 * The index route of a group: sends the visitor to the first tab they are
 * allowed, so /me/leave/apply lands somewhere real.
 *
 * Waits for the gate rather than guessing. Redirecting while /user-info is
 * still in flight would bounce a lead out of Approve on every cold load.
 */
export function LeaveGroupIndex({ groupKey }: { groupKey: LeaveGroupDef["key"] }) {
  const group = leaveGroup(groupKey);
  const gate = useLeaveGate();

  // No `isResolving` branch here on purpose: LeaveGroupPage holds the <Outlet />
  // behind its own, so nothing below it renders until the privileges are known.
  // One guard, in the one place it can be reached.
  const first = firstAllowedTab(group, gate.canSee);
  if (!first) return null; // the group page already explains this case
  return <Navigate to={`${group.path}/${first.segment}`} replace />;
}

/**
 * Guards one tab's route. A tab the gate refuses is not merely hidden from the
 * bar — reaching its URL directly redirects to whatever the visitor may see, or
 * says so plainly when that is nothing.
 */
export function LeaveTabRoute({
  groupKey,
  gateId,
  children,
}: {
  groupKey: LeaveGroupDef["key"];
  gateId: LeaveGateId;
  children: ReactNode;
}) {
  const group = leaveGroup(groupKey);
  const gate = useLeaveGate();

  // Reached only once the gate has resolved — see LeaveGroupIndex above.
  if (!gate.canSee(gateId)) {
    const first = firstAllowedTab(group, gate.canSee);
    if (first) return <Navigate to={`${group.path}/${first.segment}`} replace />;
    return <Alert severity="info">This isn&apos;t available for your role.</Alert>;
  }
  return <>{children}</>;
}
