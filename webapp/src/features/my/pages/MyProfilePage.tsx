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

import { Alert, Box, Button, Chip, Typography } from "@wso2/oxygen-ui";
import ProfileHero from "../components/ProfileHero";
import GeneralInfo from "../components/GeneralInfo";
import PersonalInfo from "../components/PersonalInfo";
import EmergencyContacts from "../components/EmergencyContacts";
import ConnectedServices from "../components/ConnectedServices";
import SectionHeader from "../../people-ops/components/SectionHeader";
import { isPeopleBackendConfigured, useMeProfile } from "../api/useMeProfile";

export default function MyProfilePage() {
  const backendConfigured = isPeopleBackendConfigured();
  const { data, isLoading, isError, error, refetch, isFetching } = useMeProfile();

  const userInfo = data?.userInfo;
  const employee = data?.employee;
  const personalInfo = data?.personalInfo;
  const firstName = employee?.firstName ?? userInfo?.firstName ?? "";

  return (
    <Box>
      <Chip
        label="✦ My"
        color="primary"
        size="small"
        sx={{ mb: 0.5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}
      />
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", mb: 2.25 }}>
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
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()} disabled={isFetching}>
              Retry
            </Button>
          }
        >
          Couldn't load your profile from the people-app backend.
          {error instanceof Error ? ` ${error.message}` : ""}
        </Alert>
      )}

      <ProfileHero userInfo={userInfo} employee={employee} isLoading={isLoading} />

      <SectionHeader id="my-general">General information</SectionHeader>
      <GeneralInfo employee={employee} isLoading={isLoading} />

      <SectionHeader id="my-personal">Personal information</SectionHeader>
      <PersonalInfo
        personalInfo={personalInfo}
        employeeId={userInfo?.employeeId ?? employee?.employeeId}
        isLoading={isLoading}
      />

      <SectionHeader id="my-emergency">Emergency contacts</SectionHeader>
      <EmergencyContacts
        contacts={personalInfo?.emergencyContacts ?? undefined}
        employeeId={userInfo?.employeeId ?? employee?.employeeId}
        isLoading={isLoading}
      />

      <SectionHeader id="my-connected">Connected apps</SectionHeader>
      <ConnectedServices />
    </Box>
  );
}
