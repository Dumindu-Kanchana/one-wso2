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

import { UserMenu } from "@wso2/oxygen-ui";
import { useAsgardeo } from "@asgardeo/react";
import { useUserInfo } from "@api/useUserInfo";
import { authConfig } from "@config/authConfig";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";

// Top-bar profile menu. Same composition pattern as
// customer-portal/webapp/src/components/header/UserProfile.tsx —
// UserMenu.Trigger (avatar), UserMenu.Header (name + email), a Profile
// item that opens Asgardeo's hosted My Account portal in a new tab, and
// UserMenu.Logout that calls the Asgardeo signOut flow. One-WSO2 doesn't
// have a custom user-details backend, so unlike customer-portal we do
// not render a local editing modal — profile editing is delegated to
// Asgardeo's My Account UI.
//
// Name resolution: prefer people-app /user-info (firstName + lastName,
// same source the My profile page uses), fall back to id_token name
// claims via useAsgardeoUser, then to the email local-part. Asgardeo
// tenants often don't include `name` / `given_name` / `family_name`
// claims in the id_token, so the people-app lookup is what actually
// gives us "Suhan Dharmasuriya" instead of "suhanr".
export default function UserProfileMenu() {
  const { isSignedIn, signOut } = useAsgardeo();
  const user = useAsgardeoUser();
  const userInfo = useUserInfo();

  if (!isSignedIn) return null;

  const backendName =
    userInfo.data && (userInfo.data.firstName || userInfo.data.lastName)
      ? `${userInfo.data.firstName ?? ""} ${userInfo.data.lastName ?? ""}`.trim()
      : undefined;
  const name =
    backendName ??
    user.displayName ??
    (user.email ? user.email.split("@")[0] : "");
  const email = userInfo.data?.workEmail ?? user.email ?? "";
  // Same source ProfileHero uses — people-app /user-info's employeeThumbnail.
  // UserMenu.Trigger + Header fall back to initials when this is null.
  const avatarUrl = userInfo.data?.employeeThumbnail ?? null;

  // Prefer initials from the backend name (Suhan Dharmasuriya → SD) so
  // the avatar matches whatever's shown in the header row.
  const backendInitials = backendName
    ? backendName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "";
  const initials = backendInitials || user.initials || (user.ready ? "?" : "");

  const handleProfile = () => {
    window.open(authConfig.myAccountUrl, "_blank", "noopener,noreferrer");
  };
  const handleLogout = () => {
    void signOut();
  };

  return (
    <UserMenu>
      <UserMenu.Trigger name={initials} avatar={avatarUrl} />
      <UserMenu.Header name={name || "—"} email={email || " "} avatar={avatarUrl} />
      <UserMenu.Divider />
      <UserMenu.Item icon={<UserIcon />} label="Profile" onClick={handleProfile} />
      <UserMenu.Logout icon={<LogOutIcon />} label="Log out" onClick={handleLogout} />
    </UserMenu>
  );
}

// Inline SVGs — oxygen-ui-icons-react in this version only ships brand
// icons (Facebook / GitHub / Google / WSO2), so we bring our own like the
// rest of TopBar does.
function UserIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1={21} y1={12} x2={9} y2={12} />
    </svg>
  );
}
