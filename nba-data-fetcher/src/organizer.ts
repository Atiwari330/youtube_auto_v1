/**
 * Position Organizer
 * Organizes NBA players by their positions
 */

import { Player, Position, PositionGroup, Team, TeamRoster } from './types';

/**
 * Normalize position abbreviation to standard format
 */
function normalizePosition(positionAbbr: string): Position {
  const normalized = positionAbbr.toUpperCase().trim();

  // Map various position formats to standard positions
  const positionMap: Record<string, Position> = {
    'PG': 'PG',
    'POINT GUARD': 'PG',
    'SG': 'SG',
    'SHOOTING GUARD': 'SG',
    'SF': 'SF',
    'SMALL FORWARD': 'SF',
    'PF': 'PF',
    'POWER FORWARD': 'PF',
    'C': 'C',
    'CENTER': 'C',
    'G': 'G',  // Generic Guard
    'F': 'F',  // Generic Forward
    'G-F': 'G',
    'F-G': 'F',
    'F-C': 'F',
    'C-F': 'C',
  };

  return positionMap[normalized] || 'UNKNOWN';
}

/**
 * Get full position name
 */
function getPositionName(position: Position): string {
  const names: Record<Position, string> = {
    'PG': 'Point Guard',
    'SG': 'Shooting Guard',
    'SF': 'Small Forward',
    'PF': 'Power Forward',
    'C': 'Center',
    'G': 'Guard',
    'F': 'Forward',
    'UNKNOWN': 'Unknown Position',
  };

  return names[position];
}

/**
 * Organize players by position
 */
export function organizeByPosition(players: Player[]): PositionGroup[] {
  // Group players by normalized position
  const grouped = new Map<Position, Player[]>();

  for (const player of players) {
    const position = normalizePosition(player.position.abbreviation);

    if (!grouped.has(position)) {
      grouped.set(position, []);
    }

    grouped.get(position)!.push(player);
  }

  // Convert to array and sort by position order
  const positionOrder: Position[] = ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C', 'UNKNOWN'];

  const result: PositionGroup[] = [];

  for (const position of positionOrder) {
    if (grouped.has(position)) {
      const positionPlayers = grouped.get(position)!;

      // Sort players by jersey number (if available), then by name
      positionPlayers.sort((a, b) => {
        // First try to sort by jersey number
        if (a.jerseyNumber && b.jerseyNumber) {
          const numA = parseInt(a.jerseyNumber);
          const numB = parseInt(b.jerseyNumber);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
        }

        // Fallback to alphabetical by last name
        return a.lastName.localeCompare(b.lastName);
      });

      result.push({
        position,
        positionName: getPositionName(position),
        players: positionPlayers,
      });
    }
  }

  return result;
}

/**
 * Create a complete team roster with position organization
 */
export function createTeamRoster(team: Team, players: Player[]): TeamRoster {
  return {
    team,
    roster: players,
    byPosition: organizeByPosition(players),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get position summary statistics
 */
export function getPositionStats(roster: TeamRoster): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const posGroup of roster.byPosition) {
    stats[posGroup.positionName] = posGroup.players.length;
  }

  return stats;
}

/**
 * Find players by position
 */
export function getPlayersByPosition(roster: TeamRoster, position: Position): Player[] {
  const posGroup = roster.byPosition.find(pg => pg.position === position);
  return posGroup?.players || [];
}

/**
 * Get starters (first player of each position)
 * Note: This is a simplified heuristic since ESPN doesn't provide actual starter data
 */
export function getEstimatedStarters(roster: TeamRoster): Player[] {
  const starters: Player[] = [];
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

  for (const position of positions) {
    const players = getPlayersByPosition(roster, position);
    if (players.length > 0) {
      // Take the first player (sorted by jersey number or name)
      starters.push(players[0]);
    } else if (position === 'SG') {
      // If no SG, try generic G
      const guards = getPlayersByPosition(roster, 'G');
      if (guards.length > 0) {
        starters.push(guards[0]);
      }
    } else if (position === 'SF' || position === 'PF') {
      // If no SF/PF, try generic F
      const forwards = getPlayersByPosition(roster, 'F');
      if (forwards.length > 0) {
        starters.push(forwards[0]);
      }
    }
  }

  return starters;
}
