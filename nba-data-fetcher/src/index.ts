/**
 * NBA Data Fetcher - Main Module
 * Fetch and organize NBA teams and rosters from ESPN API
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchAllTeams, fetchAllRosters, fetchTeamBySlug, fetchTeamRoster } from './fetcher';
import { createTeamRoster, organizeByPosition } from './organizer';
import { NBAData, Team, TeamRoster } from './types';

// Re-export types and functions for external use
export * from './types';
export * from './fetcher';
export * from './organizer';

/**
 * Main function to fetch all NBA data
 */
export async function fetchAllNBAData(): Promise<NBAData> {
  console.log('🏀 NBA Data Fetcher Starting...\n');

  // Fetch all teams
  const teams = await fetchAllTeams();

  // Fetch all rosters
  const rostersMap = await fetchAllRosters(teams);

  // Organize into team rosters
  const rosters: TeamRoster[] = [];

  for (const team of teams) {
    const players = rostersMap.get(team.id) || [];
    const teamRoster = createTeamRoster(team, players);
    rosters.push(teamRoster);
  }

  const nbaData: NBAData = {
    teams,
    rosters,
    generatedAt: new Date().toISOString(),
  };

  console.log('✅ Successfully fetched all NBA data!\n');
  console.log(`Total Teams: ${teams.length}`);
  console.log(`Total Players: ${rosters.reduce((sum, r) => sum + r.roster.length, 0)}`);

  return nbaData;
}

/**
 * Save NBA data to JSON files
 */
export async function saveToJSON(data: NBAData, outputDir: string = './data'): Promise<void> {
  console.log(`\n💾 Saving data to ${outputDir}...\n`);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Save complete dataset
  const allDataPath = path.join(outputDir, 'nba-complete.json');
  await fs.writeFile(allDataPath, JSON.stringify(data, null, 2));
  console.log(`✓ Saved complete data: ${allDataPath}`);

  // Save teams only
  const teamsPath = path.join(outputDir, 'teams.json');
  await fs.writeFile(teamsPath, JSON.stringify(data.teams, null, 2));
  console.log(`✓ Saved teams: ${teamsPath}`);

  // Save rosters
  const rostersPath = path.join(outputDir, 'rosters.json');
  await fs.writeFile(rostersPath, JSON.stringify(data.rosters, null, 2));
  console.log(`✓ Saved rosters: ${rostersPath}`);

  // Save individual team files
  const teamsDir = path.join(outputDir, 'teams');
  await fs.mkdir(teamsDir, { recursive: true });

  for (const roster of data.rosters) {
    const teamFileName = `${roster.team.abbreviation.toLowerCase()}.json`;
    const teamFilePath = path.join(teamsDir, teamFileName);
    await fs.writeFile(teamFilePath, JSON.stringify(roster, null, 2));
  }

  console.log(`✓ Saved ${data.rosters.length} individual team files to ${teamsDir}/`);

  // Create a summary file
  const summary = {
    generatedAt: data.generatedAt,
    totalTeams: data.teams.length,
    totalPlayers: data.rosters.reduce((sum, r) => sum + r.roster.length, 0),
    teams: data.teams.map(t => ({
      abbreviation: t.abbreviation,
      displayName: t.displayName,
      playerCount: data.rosters.find(r => r.team.id === t.id)?.roster.length || 0,
    })),
  };

  const summaryPath = path.join(outputDir, 'summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary: ${summaryPath}`);

  console.log('\n✅ All files saved successfully!\n');
}

/**
 * Fetch and save specific team data
 */
export async function fetchAndSaveTeam(teamSlug: string, outputDir: string = './data'): Promise<void> {
  console.log(`🏀 Fetching data for ${teamSlug}...\n`);

  const team = await fetchTeamBySlug(teamSlug);

  if (!team) {
    throw new Error(`Team not found: ${teamSlug}`);
  }

  const players = await fetchTeamRoster(team.abbreviation.toLowerCase());
  const roster = createTeamRoster(team, players);

  // Save to file
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${team.abbreviation.toLowerCase()}.json`);
  await fs.writeFile(filePath, JSON.stringify(roster, null, 2));

  console.log(`✓ Saved ${team.displayName} roster to ${filePath}`);
  console.log(`  Players: ${players.length}`);
}

/**
 * CLI execution (when run directly)
 */
async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length > 0 && args[0] !== '--all') {
      // Fetch specific team
      const teamSlug = args[0];
      const outputDir = args[1] || './data/teams';
      await fetchAndSaveTeam(teamSlug, outputDir);
    } else {
      // Fetch all teams and rosters
      const data = await fetchAllNBAData();

      // Save to JSON files
      const outputDir = args.includes('--output')
        ? args[args.indexOf('--output') + 1]
        : './data';

      await saveToJSON(data, outputDir);

      console.log('\n📊 Sample Data:');
      console.log('\nFirst team:', data.teams[0].displayName);
      if (data.rosters[0]?.byPosition.length > 0) {
        console.log('\nPosition breakdown:');
        data.rosters[0].byPosition.forEach(pg => {
          console.log(`  ${pg.positionName}: ${pg.players.length} players`);
        });
      }
    }

    console.log('\n🎉 Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
