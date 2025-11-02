# Usage Examples

## Example 1: Import from Next.js API Route

```typescript
// app/api/nba/teams/route.ts
import { fetchAllTeams } from '@/nba-data-fetcher/src';

export async function GET() {
  const teams = await fetchAllTeams();
  return Response.json(teams);
}
```

## Example 2: Get Team Roster in Server Component

```typescript
// app/teams/[slug]/page.tsx
import { fetchTeamBySlug, fetchTeamRoster, createTeamRoster } from '@/nba-data-fetcher/src';

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const team = await fetchTeamBySlug(params.slug);

  if (!team) {
    return <div>Team not found</div>;
  }

  const players = await fetchTeamRoster(team.abbreviation.toLowerCase());
  const roster = createTeamRoster(team, players);

  return (
    <div>
      <h1>{team.displayName}</h1>

      {roster.byPosition.map(positionGroup => (
        <div key={positionGroup.position}>
          <h2>{positionGroup.positionName}</h2>
          <ul>
            {positionGroup.players.map(player => (
              <li key={player.id}>
                {player.displayName} (#{player.jerseyNumber})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

## Example 3: Use Pre-fetched JSON Data

```typescript
// app/teams/page.tsx
import fs from 'fs/promises';
import path from 'path';
import type { NBAData } from '@/nba-data-fetcher/src/types';

export default async function TeamsPage() {
  // Read the pre-fetched data
  const dataPath = path.join(process.cwd(), 'nba-data-fetcher', 'data', 'nba-complete.json');
  const data: NBAData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

  return (
    <div>
      <h1>NBA Teams ({data.teams.length})</h1>
      <p>Last updated: {new Date(data.generatedAt).toLocaleDateString()}</p>

      <div className="grid grid-cols-3 gap-4">
        {data.teams.map(team => (
          <div key={team.id} className="border p-4">
            <h2>{team.displayName}</h2>
            <p>{team.abbreviation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 4: Standalone Node.js Script

```typescript
// scripts/check-lakers.ts
import { fetchTeamBySlug, fetchTeamRoster, createTeamRoster } from '../nba-data-fetcher/src';

async function main() {
  const lakers = await fetchTeamBySlug('lakers');

  if (!lakers) {
    console.log('Lakers not found');
    return;
  }

  const players = await fetchTeamRoster(lakers.abbreviation.toLowerCase());
  const roster = createTeamRoster(lakers, players);

  console.log(`${lakers.displayName} Roster:`);
  console.log(`Total Players: ${roster.roster.length}\n`);

  roster.byPosition.forEach(posGroup => {
    console.log(`${posGroup.positionName}:`);
    posGroup.players.forEach(player => {
      console.log(`  - ${player.displayName} (#${player.jerseyNumber})`);
    });
    console.log('');
  });
}

main();
```

Run with:
```bash
tsx scripts/check-lakers.ts
```

## Example 5: Filter Players by Criteria

```typescript
import type { TeamRoster } from '@/nba-data-fetcher/src/types';
import fs from 'fs/promises';

async function getRookies() {
  const rostersPath = './nba-data-fetcher/data/rosters.json';
  const rosters: TeamRoster[] = JSON.parse(await fs.readFile(rostersPath, 'utf-8'));

  const allRookies = rosters.flatMap(roster =>
    roster.roster.filter(player => player.experience === 0)
  );

  console.log(`Found ${allRookies.length} rookies across all teams`);
  return allRookies;
}
```

## Example 6: Get Team by Conference

```typescript
import { fetchAllTeams } from '@/nba-data-fetcher/src';

async function getEasternConferenceTeams() {
  const teams = await fetchAllTeams();

  // You could add conference data to the Team type, or maintain a separate mapping
  const easternTeams = [
    'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND',
    'MIA', 'MIL', 'NY', 'ORL', 'PHI', 'TOR', 'WSH'
  ];

  return teams.filter(team => easternTeams.includes(team.abbreviation));
}
```

## Example 7: Create a Custom Player Search

```typescript
import type { NBAData } from '@/nba-data-fetcher/src/types';
import fs from 'fs/promises';

async function searchPlayers(searchTerm: string) {
  const dataPath = './nba-data-fetcher/data/nba-complete.json';
  const data: NBAData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

  const results = data.rosters.flatMap(roster =>
    roster.roster
      .filter(player =>
        player.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(player => ({
        player,
        team: roster.team
      }))
  );

  return results;
}

// Usage
const lebronMatches = await searchPlayers('LeBron');
console.log(lebronMatches);
```

## Example 8: Get All Guards

```typescript
import type { NBAData } from '@/nba-data-fetcher/src/types';
import fs from 'fs/promises';

async function getAllGuards() {
  const dataPath = './nba-data-fetcher/data/nba-complete.json';
  const data: NBAData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));

  const guards = data.rosters.flatMap(roster =>
    roster.byPosition
      .filter(pg => pg.position === 'G' || pg.position === 'PG' || pg.position === 'SG')
      .flatMap(pg => pg.players.map(player => ({
        ...player,
        team: roster.team.abbreviation
      })))
  );

  console.log(`Total guards in NBA: ${guards.length}`);
  return guards;
}
```

## Tips

1. **Caching**: Fetch data once and save to JSON files to avoid repeated API calls
2. **Revalidation**: In Next.js, use `revalidate` to periodically refresh data
3. **Type Safety**: Import types from `@/nba-data-fetcher/src/types`
4. **Performance**: Use pre-fetched JSON files for better performance
5. **Updates**: Run `npm run fetch` periodically to get latest rosters
