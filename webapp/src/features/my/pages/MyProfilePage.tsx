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

import { Alert, Box, Typography } from "@wso2/oxygen-ui";
import { useState } from "react";
import ProfileHero from "../components/ProfileHero";
import GeneralInfo from "../components/GeneralInfo";
import PersonalInfo from "../components/PersonalInfo";
import EmergencyContacts from "../components/EmergencyContacts";
import ConnectedServices from "../components/ConnectedServices";
import SectionHeader from "../../people-ops/components/SectionHeader";
import { isPeopleBackendConfigured, useMeProfile, useMePersonalInfo } from "../api/useMeProfile";
import CollapsibleSection from "../components/CollapsibleSection";
import ErrorNotice from "@components/error-notice/ErrorNotice";

// The Me home landing: own profile + the cross-app "More about you"
// aggregation.
export default function MyProfilePage() {
  const backendConfigured = isPeopleBackendConfigured();
  const { data, isLoading, isError, error, refetch, isFetching } = useMeProfile();

  const userInfo = data?.userInfo;
  const employee = data?.employee;
  const firstName = employee?.firstName ?? userInfo?.firstName ?? "";

  // Personal details and emergency contacts come from one request, and it is
  // not made until a reader opens one of the two sections that show them.
  // Either section opening is enough: they read the same payload, so React
  // Query serves the second from the first one's result.
  const [wantsPersonal, setWantsPersonal] = useState(false);
  const personal = useMePersonalInfo(undefined, wantsPersonal);
  const personalInfo = personal.data;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2.25 }}>
        Welcome back{firstName ? `, ${firstName}` : ""}
      </Typography>

      {!backendConfigured && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Live profile data isn't loaded because <code>ONE_WSO2_PEOPLE_BACKEND_URL</code> isn't set in{" "}
          <code>public/config.js</code>. Add the people-app backend URL (same value people-app itself uses for{" "}
          <code>REACT_APP_BACKEND_BASE_URL</code>) and reload.
        </Alert>
      )}

      {backendConfigured && isError && (
        <ErrorNotice
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
          sx={{ mb: 2 }}
        >
          Couldn't load your profile from the people-app backend.
        </ErrorNotice>
      )}

      <ProfileHero userInfo={userInfo} employee={employee} isLoading={isLoading} />

      <SectionHeader>General information</SectionHeader>
      <GeneralInfo employee={employee} isLoading={isLoading} />

      <CollapsibleSection
        title="Personal information"
        rememberAs="me-personal"
        onOpen={() => setWantsPersonal(true)}
      >
        <PersonalInfo
          personalInfo={personalInfo}
          employeeId={userInfo?.employeeId ?? employee?.employeeId}
          isLoading={personal.isPending}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Emergency contacts"
        rememberAs="me-emergency"
        onOpen={() => setWantsPersonal(true)}
      >
        <EmergencyContacts
          contacts={personalInfo?.emergencyContacts ?? undefined}
          employeeId={userInfo?.employeeId ?? employee?.employeeId}
          isLoading={personal.isPending}
        />
      </CollapsibleSection>

      {/* Main dropped the dead scroll-anchor ids from these headers; the rail
          never targeted them. Only the label changes here. */}
      <SectionHeader>More about you</SectionHeader>
      <ConnectedServices />
    </Box>
  );
}
