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

import { useCallback, useEffect, useState } from "react";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { readFavourites, toggleFavourite } from "@features/favourites/favouritesStore";

interface UseFavourites {
  /** Favourited perspective keys, in the order they were added. */
  favourites: string[];
  isFavourite: (key: string) => boolean;
  toggle: (key: string) => void;
}

/**
 * The user's favourite apps.
 *
 * No change event or cross-tab sync, unlike the pinned store: the only consumer
 * is the launcher, which is mounted and torn down per opening, so it re-reads
 * naturally. Add one if favourites ever appear on a second surface at the same
 * time.
 */
export function useFavourites(): UseFavourites {
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const [favourites, setFavourites] = useState<string[]>(() => readFavourites(sub));

  // The launcher can open before the ID token has decoded, in which case the
  // first read ran against no user. Re-read once the subject arrives.
  useEffect(() => {
    setFavourites(readFavourites(sub));
  }, [sub]);

  const toggle = useCallback(
    (key: string) => {
      setFavourites(toggleFavourite(sub, key));
    },
    [sub],
  );

  const isFavourite = useCallback(
    (key: string) => favourites.includes(key),
    [favourites],
  );

  return { favourites, isFavourite, toggle };
}
