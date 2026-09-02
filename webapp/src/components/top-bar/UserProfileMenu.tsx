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
import { CompassIcon, LogOutIcon, UserRoundIcon } from "@wso2/oxygen-ui-icons-react";
import { useTour } from "@features/tour/tourContext";
import { useAsgardeo } from "@asgardeo/react";
import { useUserInfo } from "@api/useUserInfo";
import { authConfig } from "@config/authConfig";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useSecureSignOut } from "@hooks/useSecureSignOut";

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
  const { isSignedIn } = useAsgardeo();
  const secureSignOut = useSecureSignOut();
  const user = useAsgardeoUser();
  const userInfo = useUserInfo();
  const tour = useTour();

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
  const handleTour = () => {
    tour.start();
  };

  const handleLogout = () => {
    secureSignOut();
  };

  return (
    <UserMenu>
      <UserMenu.Trigger name={initials} avatar={avatarUrl} />
      <UserMenu.Header name={name || "—"} email={email || " "} avatar={avatarUrl} />
      <UserMenu.Divider />
      <UserMenu.Item icon={<UserRoundIcon size={18} />} label="Profile" onClick={handleProfile} />
      {/* The tour is offered once, on a first visit, and lives here afterwards —
          so someone who declined it, or who wants it again, has somewhere to go.

          UserMenu.Item appends a trailing chevron that cannot be turned off (its
          props are icon/label/badge/onClick, and it drops className). A plain
          MenuItem avoids the chevron but does not inherit Oxygen's item styling,
          so the row read as foreign next to Profile and Log out. The chevron is
          the smaller of the two problems; worth asking Oxygen for a way to
          suppress it rather than hand-rolling the row. */}
      <UserMenu.Item icon={<CompassIcon size={18} />} label="Take the tour" onClick={handleTour} />
      <UserMenu.Logout icon={<LogOutIcon size={18} />} label="Log out" onClick={handleLogout} />
    </UserMenu>
  );
}

