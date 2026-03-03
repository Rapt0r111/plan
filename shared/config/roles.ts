/**
 * @file roles.ts - shared/config
 * Re-exports the Single Source of Truth from types to keep imports clean.
 */
import { ROLE_META as SHARED_ROLE_META } from "@/shared/types";
import type { RoleMeta } from "@/shared/types";

// Re-export the Type so components importing from here still work
export type { RoleMeta };

// Re-export the Constant
export const ROLE_META = SHARED_ROLE_META;

// Generate the list from the shared source of truth
export const ROLES_LIST: RoleMeta[] = Object.values(ROLE_META);