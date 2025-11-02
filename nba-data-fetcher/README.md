# NBA Data Fetcher

A TypeScript utility to fetch NBA teams and complete rosters from ESPN's API, organized by player positions.

## Features

- ✅ Fetch all 30 NBA teams
- ✅ Complete player rosters with detailed information
- ✅ Organize players by position (PG, SG, SF, PF, C)
- ✅ Export to JSON files
- ✅ No authentication required (uses ESPN's public API)
- ✅ TypeScript support with full type definitions
- ✅ Can be used as a CLI tool or imported as a module

## Installation

```bash
cd nba-data-fetcher
npm install
```

## Quick Start

### Fetch All Teams and Rosters

```bash
npm run fetch
```

This will:
1. Fetch all 30 NBA teams
2. Fetch complete rosters for each team
3. Organize players by position
4. Save everything to the `data/` folder

### Fetch a Specific Team

```bash
npm run fetch lakers
# or
npm run fetch bos
```

## Output Structure

The script generates the following files in the `data/` folder:

```
data/
├── nba-complete.json       # Complete dataset (teams + rosters)
├── teams.json              # Just the teams
├── rosters.json            # All rosters with position organization
├── summary.json            # Quick overview with stats
└── teams/
    ├── lal.json            # Lakers roster
    ├── bos.json            # Celtics roster
    ├── gsw.json            # Warriors roster
    └── ...                 # All 30 teams
```

## Data Format

### Team Data

```json
{
  "id": "13",
  "abbreviation": "LAL",
  "displayName": "Los Angeles Lakers",
  "shortDisplayName": "Lakers",
  "name": "Lakers",
  "location": "Los Angeles",
  "color": "552583",
  "logos": [...]
}
```

### Player Data (Organized by Position)

```json
{
  "team": { ... },
  "roster": [ ... ],
  "byPosition": [
    {
      "position": "PG",
      "positionName": "Point Guard",
      "players": [
        {
          "id": "1966",
          "firstName": "D'Angelo",
          "lastName": "Russell",
          "displayName": "D'Angelo Russell",
          "jerseyNumber": "1",
          "position": {
            "name": "Point Guard",
            "abbreviation": "PG"
          },
          "height": "6' 3\"",
          "weight": 193,
          "college": "Ohio State",
          "headshot": "https://..."
        }
      ]
    },
    {
      "position": "SG",
      "positionName": "Shooting Guard",
      "players": [ ... ]
    }
  ],
  "lastUpdated": "2025-01-15T10:30:00.000Z"
}
```

## Using as a Module

You can import and use the fetcher in your Next.js or Node.js projects:

```typescript
import { fetchAllNBAData, fetchTeamBySlug, fetchTeamRoster } from './nba-data-fetcher/src';

// Fetch all data
const nbaData = await fetchAllNBAData();
console.log(`Found ${nbaData.teams.length} teams`);

// Fetch specific team
const lakers = await fetchTeamBySlug('lakers');
const lakersRoster = await fetchTeamRoster('lakers');

// Access organized roster
lakersRoster.byPosition.forEach(positionGroup => {
  console.log(`${positionGroup.positionName}:`);
  positionGroup.players.forEach(player => {
    console.log(`  - ${player.displayName} (#${player.jerseyNumber})`);
  });
});
```

## API Reference

### Functions

#### `fetchAllNBAData()`
Fetches all NBA teams and their rosters.

**Returns:** `Promise<NBAData>`

#### `fetchAllTeams()`
Fetches just the list of NBA teams.

**Returns:** `Promise<Team[]>`

#### `fetchTeamBySlug(slug: string)`
Fetch a specific team by slug or abbreviation.

**Parameters:**
- `slug` - Team slug (e.g., 'lakers', 'celtics') or abbreviation (e.g., 'LAL', 'BOS')

**Returns:** `Promise<Team | null>`

#### `fetchTeamRoster(teamSlug: string)`
Fetch roster for a specific team.

**Parameters:**
- `teamSlug` - Team slug or abbreviation

**Returns:** `Promise<Player[]>`

#### `saveToJSON(data: NBAData, outputDir?: string)`
Save NBA data to JSON files.

**Parameters:**
- `data` - The NBA data to save
- `outputDir` - Output directory (default: './data')

### Types

All TypeScript types are exported from `src/types.ts`:

- `Team` - NBA team information
- `Player` - Player information with position, stats, etc.
- `Position` - Position type ('PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F')
- `PositionGroup` - Players grouped by position
- `TeamRoster` - Complete team roster with position organization
- `NBAData` - Complete NBA dataset

## Example: Using in Next.js

```typescript
// app/api/nba/route.ts
import { fetchAllNBAData } from '@/nba-data-fetcher/src';

export async function GET() {
  const data = await fetchAllNBAData();
  return Response.json(data);
}
```

```typescript
// app/teams/page.tsx
import { fetchAllTeams } from '@/nba-data-fetcher/src';

export default async function TeamsPage() {
  const teams = await fetchAllTeams();

  return (
    <div>
      <h1>NBA Teams</h1>
      {teams.map(team => (
        <div key={team.id}>
          <h2>{team.displayName}</h2>
          <p>{team.location}</p>
        </div>
      ))}
    </div>
  );
}
```

## Position Organization

Players are automatically organized into these position groups:

- **PG** - Point Guard
- **SG** - Shooting Guard
- **SF** - Small Forward
- **PF** - Power Forward
- **C** - Center
- **G** - Guard (generic)
- **F** - Forward (generic)

Players are sorted within each position by:
1. Jersey number (if available)
2. Last name (alphabetically)

## Data Source

This tool uses ESPN's public API:
- **Base URL:** `https://site.api.espn.com/apis/site/v2/sports/basketball/nba`
- **No authentication required**
- **Free to use**

The script includes small delays (300ms) between requests to be respectful to ESPN's servers.

## Notes

- **Depth Charts:** ESPN's API doesn't provide official depth chart data. Players are organized by position only.
- **Starter Estimation:** The `getEstimatedStarters()` function provides a simple heuristic (first player per position) but this is not official starter data.
- **Season:** The API returns current roster data. Historical rosters are not available.
- **Rate Limiting:** The script includes delays to avoid overwhelming the API. For production use, consider implementing caching.

## Development

### Build

```bash
npm run build
```

This compiles TypeScript to the `dist/` folder.

### Run in Development Mode

```bash
npm run dev
```

This runs the script with hot-reloading enabled.

## License

MIT

## Contributing

Feel free to open issues or submit pull requests!
