/**
 * ESPN API Fetcher
 * Fetches NBA teams and rosters from ESPN's public API
 */

import { Team, Player, ESPNTeamResponse, ESPNRosterResponse } from './types';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

/**
 * Fetch all NBA teams from ESPN API
 */
export async function fetchAllTeams(): Promise<Team[]> {
  try {
    console.log('Fetching all NBA teams from ESPN API...');
    const response = await fetch(`${ESPN_API_BASE}/teams?limit=50`);

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }

    const data: ESPNTeamResponse = await response.json();

    // Extract teams from nested structure
    const teams: Team[] = [];

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamWrapper of data.sports[0].leagues[0].teams) {
        const espnTeam = teamWrapper.team;

        // Only include active teams
        if (espnTeam.isActive !== false) {
          teams.push({
            id: espnTeam.id,
            uid: espnTeam.uid,
            slug: espnTeam.slug,
            abbreviation: espnTeam.abbreviation,
            displayName: espnTeam.displayName,
            shortDisplayName: espnTeam.shortDisplayName,
            name: espnTeam.name,
            nickname: espnTeam.nickname,
            location: espnTeam.location,
            color: espnTeam.color,
            alternateColor: espnTeam.alternateColor,
            logos: espnTeam.logos,
          });
        }
      }
    }

    console.log(`✓ Fetched ${teams.length} NBA teams`);
    return teams;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
}

/**
 * Fetch roster for a specific team
 */
export async function fetchTeamRoster(teamSlug: string): Promise<Player[]> {
  try {
    const response = await fetch(`${ESPN_API_BASE}/teams/${teamSlug}/roster`);

    if (!response.ok) {
      throw new Error(`ESPN API error for ${teamSlug}: ${response.status} ${response.statusText}`);
    }

    const data: ESPNRosterResponse = await response.json();

    if (!data.athletes || data.athletes.length === 0) {
      console.warn(`⚠ No roster data found for ${teamSlug}`);
      return [];
    }

    const players: Player[] = data.athletes.map(athlete => {
      // Handle birth place
      let birthPlace: string | undefined;
      if (athlete.birthPlace) {
        const parts = [
          athlete.birthPlace.city,
          athlete.birthPlace.state,
          athlete.birthPlace.country
        ].filter(Boolean);
        birthPlace = parts.join(', ');
      }

      return {
        id: athlete.id,
        firstName: athlete.firstName || '',
        lastName: athlete.lastName || '',
        fullName: athlete.fullName,
        displayName: athlete.displayName,
        jerseyNumber: athlete.jersey,
        position: {
          name: athlete.position?.name || 'Unknown',
          displayName: athlete.position?.displayName || 'Unknown',
          abbreviation: athlete.position?.abbreviation || 'UNKNOWN',
        },
        height: athlete.displayHeight,
        weight: athlete.weight,
        age: athlete.age,
        dateOfBirth: athlete.dateOfBirth,
        birthPlace,
        college: athlete.college?.name || athlete.college?.shortName,
        experience: athlete.experience?.years,
        slug: athlete.slug,
        headshot: athlete.headshot?.href,
      };
    });

    return players;
  } catch (error) {
    console.error(`Error fetching roster for ${teamSlug}:`, error);
    throw error;
  }
}

/**
 * Fetch rosters for all teams
 * Includes delay to avoid overwhelming the API
 */
export async function fetchAllRosters(teams: Team[], delayMs: number = 300): Promise<Map<string, Player[]>> {
  const rosters = new Map<string, Player[]>();

  console.log(`\nFetching rosters for ${teams.length} teams...`);
  console.log('(Adding small delays to be respectful to ESPN API)\n');

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];

    try {
      console.log(`[${i + 1}/${teams.length}] Fetching ${team.displayName}...`);
      const roster = await fetchTeamRoster(team.abbreviation.toLowerCase());
      rosters.set(team.id, roster);

      console.log(`  ✓ ${roster.length} players\n`);

      // Add delay between requests (except for last request)
      if (i < teams.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`  ✗ Failed to fetch ${team.displayName}`);
      rosters.set(team.id, []); // Store empty array on error
    }
  }

  console.log(`✓ Completed fetching all rosters\n`);
  return rosters;
}

/**
 * Fetch a single team by abbreviation or slug
 */
export async function fetchTeamBySlug(slug: string): Promise<Team | null> {
  const teams = await fetchAllTeams();
  return teams.find(t =>
    t.slug.toLowerCase() === slug.toLowerCase() ||
    t.abbreviation.toLowerCase() === slug.toLowerCase()
  ) || null;
}
