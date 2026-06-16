// Script temporal: agrega passes_avg / fouls_avg a equipos que no los tienen en teams.js
import { readFileSync, writeFileSync } from 'fs'

const OVERRIDES = {
  'Switzerland':    { passes_avg: 510, passes_against_avg: 400, fouls_avg: 11.2, fouls_against_avg: 13.5 },
  'Brazil':         { passes_avg: 550, passes_against_avg: 370, fouls_avg: 10.8, fouls_against_avg: 14.2 },
  'Morocco':        { passes_avg: 480, passes_against_avg: 390, fouls_avg: 14.6, fouls_against_avg: 12.5 },
  'Haiti':          { passes_avg: 370, passes_against_avg: 480, fouls_avg: 15.8, fouls_against_avg: 12.2 },
  'Scotland':       { passes_avg: 420, passes_against_avg: 450, fouls_avg: 14.1, fouls_against_avg: 13.6 },
  'USA':            { passes_avg: 460, passes_against_avg: 420, fouls_avg: 13.4, fouls_against_avg: 13.8 },
  'Australia':      { passes_avg: 450, passes_against_avg: 430, fouls_avg: 12.6, fouls_against_avg: 13.2 },
  'Turkey':         { passes_avg: 440, passes_against_avg: 430, fouls_avg: 16.8, fouls_against_avg: 14.2 },
  'Paraguay':       { passes_avg: 400, passes_against_avg: 450, fouls_avg: 14.0, fouls_against_avg: 13.0 },
  'Curacao':        { passes_avg: 360, passes_against_avg: 490, fouls_avg: 14.5, fouls_against_avg: 13.0 },
  'Ecuador':        { passes_avg: 430, passes_against_avg: 440, fouls_avg: 13.8, fouls_against_avg: 13.5 },
  'Germany':        { passes_avg: 560, passes_against_avg: 380, fouls_avg: 11.5, fouls_against_avg: 14.0 },
  'Ivory Coast':    { passes_avg: 460, passes_against_avg: 420, fouls_avg: 13.2, fouls_against_avg: 13.8 },
  'Japan':          { passes_avg: 520, passes_against_avg: 400, fouls_avg: 10.4, fouls_against_avg: 14.5 },
  'Netherlands':    { passes_avg: 530, passes_against_avg: 390, fouls_avg: 11.8, fouls_against_avg: 14.0 },
  'Sweden':         { passes_avg: 430, passes_against_avg: 440, fouls_avg: 12.5, fouls_against_avg: 13.0 },
  'Tunisia':        { passes_avg: 420, passes_against_avg: 450, fouls_avg: 14.8, fouls_against_avg: 13.2 },
  'Belgium':        { passes_avg: 530, passes_against_avg: 390, fouls_avg: 11.6, fouls_against_avg: 14.4 },
  'Egypt':          { passes_avg: 410, passes_against_avg: 450, fouls_avg: 14.0, fouls_against_avg: 13.0 },
  'Iran':           { passes_avg: 400, passes_against_avg: 450, fouls_avg: 14.5, fouls_against_avg: 13.0 },
  'New Zealand':    { passes_avg: 410, passes_against_avg: 450, fouls_avg: 13.0, fouls_against_avg: 13.0 },
  'Cape Verde':     { passes_avg: 430, passes_against_avg: 440, fouls_avg: 14.2, fouls_against_avg: 13.5 },
  'Saudi Arabia':   { passes_avg: 420, passes_against_avg: 450, fouls_avg: 15.5, fouls_against_avg: 13.0 },
  'Spain':          { passes_avg: 620, passes_against_avg: 310, fouls_avg: 9.8,  fouls_against_avg: 15.2 },
  'Uruguay':        { passes_avg: 450, passes_against_avg: 430, fouls_avg: 14.6, fouls_against_avg: 13.4 },
  'France':         { passes_avg: 540, passes_against_avg: 380, fouls_avg: 12.4, fouls_against_avg: 14.2 },
  'Iraq':           { passes_avg: 390, passes_against_avg: 460, fouls_avg: 15.0, fouls_against_avg: 13.0 },
  'Norway':         { passes_avg: 460, passes_against_avg: 410, fouls_avg: 11.8, fouls_against_avg: 14.0 },
  'Senegal':        { passes_avg: 450, passes_against_avg: 420, fouls_avg: 14.8, fouls_against_avg: 13.6 },
  'Algeria':        { passes_avg: 460, passes_against_avg: 410, fouls_avg: 15.4, fouls_against_avg: 13.2 },
  'Argentina':      { passes_avg: 510, passes_against_avg: 390, fouls_avg: 13.8, fouls_against_avg: 14.6 },
  'Austria':        { passes_avg: 470, passes_against_avg: 420, fouls_avg: 13.5, fouls_against_avg: 13.8 },
  'Jordan':         { passes_avg: 430, passes_against_avg: 440, fouls_avg: 13.2, fouls_against_avg: 13.5 },
  'Colombia':       { passes_avg: 490, passes_against_avg: 400, fouls_avg: 13.6, fouls_against_avg: 14.0 },
  'Congo DR':       { passes_avg: 420, passes_against_avg: 430, fouls_avg: 13.0, fouls_against_avg: 13.5 },
  'Portugal':       { passes_avg: 520, passes_against_avg: 390, fouls_avg: 12.8, fouls_against_avg: 14.5 },
  'Uzbekistan':     { passes_avg: 380, passes_against_avg: 470, fouls_avg: 14.0, fouls_against_avg: 13.0 },
  'Croatia':        { passes_avg: 500, passes_against_avg: 400, fouls_avg: 12.2, fouls_against_avg: 14.0 },
  'England':        { passes_avg: 520, passes_against_avg: 390, fouls_avg: 10.6, fouls_against_avg: 14.2 },
  'Ghana':          { passes_avg: 430, passes_against_avg: 445, fouls_avg: 13.5, fouls_against_avg: 13.8 },
  'Panama':         { passes_avg: 390, passes_against_avg: 470, fouls_avg: 15.8, fouls_against_avg: 12.8 },
}

let src = readFileSync('src/lib/teams.js', 'utf8')

for (const [name, vals] of Object.entries(OVERRIDES)) {
  // Find the goalkicks_avg line for this team and insert passes/fouls after it
  // Pattern: goalkicks_avg: XX.X, throwins_avg: XX.X, freekicks_avg: XX.X,
  // We want to add passes/fouls after freekicks_avg line IF not already present

  // Build a regex that finds the team block and the freekicks_avg line
  const teamPattern = new RegExp(
    `(makeTeam\\('${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?freekicks_avg: [\\d.]+,)(?!\\s*passes_avg)`,
    'g'
  )

  const insert = `\n    passes_avg: ${vals.passes_avg}, passes_against_avg: ${vals.passes_against_avg}, fouls_avg: ${vals.fouls_avg}, fouls_against_avg: ${vals.fouls_against_avg},`

  src = src.replace(teamPattern, `$1${insert}`)
}

writeFileSync('src/lib/teams.js', src)
console.log('Done — passes/fouls added to all teams')
