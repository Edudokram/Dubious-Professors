// Curated list of funny 3-letter lobby codes.
// Edit this list to add/remove codes.
const CODES = [
  'ASS', 'SUS', 'WTF', 'SMH', 'IDK', 'PEE', 'POO', 'NUT', 'AYO',
  'BRB', 'LOL', 'YAP', 'CAP', 'MID', 'HOE', 'RAW', 'CUM', 'ABG'
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randomCode() {
  return LETTERS[Math.floor(Math.random() * 26)]
    + LETTERS[Math.floor(Math.random() * 26)]
    + LETTERS[Math.floor(Math.random() * 26)]
}

// Pick a code, avoiding any in `takenCodes` (a Set or array of currently-used codes).
// 50% chance to pick from the funny pool — but only from funny codes that aren't taken.
// If all funny codes are taken, falls back to random. Random codes also avoid collisions.
export function generateRoomCode(takenCodes = new Set()) {
  const taken = takenCodes instanceof Set ? takenCodes : new Set(takenCodes)

  if (Math.random() < 0.5) {
    const availableFunny = CODES.filter((c) => !taken.has(c))
    if (availableFunny.length > 0) {
      return availableFunny[Math.floor(Math.random() * availableFunny.length)]
    }
    // every funny code is in use — fall through to random
  }

  // Try random codes; bail after 50 attempts (17,576 possibilities, collisions are rare)
  for (let i = 0; i < 50; i++) {
    const code = randomCode()
    if (!taken.has(code)) return code
  }
  // Extreme fallback (essentially unreachable) — caller will retry on collision
  return randomCode()
}
