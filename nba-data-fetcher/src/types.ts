/**
 * NBA Data Types
 * Based on ESPN API structure
 */

// Position types
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F' | 'UNKNOWN';

// Player information
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  jerseyNumber?: string;
  position: {
    name: string;
    displayName: string;
    abbreviation: string;
  };
  height?: string;
  weight?: number;
  age?: number;
  dateOfBirth?: string;
  birthPlace?: string;
  college?: string;
  experience?: number;
  slug?: string;
  headshot?: string;
}

// Team information
export interface Team {
  id: string;
  uid: string;
  slug: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  nickname?: string;
  location: string;
  color?: string;
  alternateColor?: string;
  logos?: {
    href: string;
    alt?: string;
    rel?: string[];
    width?: number;
    height?: number;
  }[];
}

// Roster organized by position
export interface PositionGroup {
  position: Position;
  positionName: string;
  players: Player[];
}

export interface TeamRoster {
  team: Team;
  roster: Player[];
  byPosition: PositionGroup[];
  lastUpdated: string;
}

// ESPN API Response Types
export interface ESPNTeamResponse {
  sports: Array<{
    leagues: Array<{
      teams: Array<{
        team: {
          id: string;
          uid: string;
          slug: string;
          abbreviation: string;
          displayName: string;
          shortDisplayName: string;
          name: string;
          nickname?: string;
          location: string;
          color?: string;
          alternateColor?: string;
          isActive?: boolean;
          logos?: Array<{
            href: string;
            alt?: string;
            rel?: string[];
            width?: number;
            height?: number;
          }>;
        };
      }>;
    }>;
  }>;
}

export interface ESPNRosterResponse {
  team?: {
    id: string;
    slug: string;
    abbreviation: string;
    displayName: string;
  };
  athletes?: Array<{
    id: string;
    uid?: string;
    guid?: string;
    firstName?: string;
    lastName?: string;
    fullName: string;
    displayName: string;
    shortName?: string;
    weight?: number;
    displayWeight?: string;
    height?: number;
    displayHeight?: string;
    age?: number;
    dateOfBirth?: string;
    birthPlace?: {
      city?: string;
      state?: string;
      country?: string;
    };
    citizenship?: string;
    slug?: string;
    jersey?: string;
    position?: {
      name: string;
      displayName: string;
      abbreviation: string;
    };
    college?: {
      name?: string;
      shortName?: string;
    };
    headshot?: {
      href: string;
      alt?: string;
    };
    experience?: {
      years?: number;
    };
  }>;
}

// Complete NBA data structure
export interface NBAData {
  teams: Team[];
  rosters: TeamRoster[];
  generatedAt: string;
}
