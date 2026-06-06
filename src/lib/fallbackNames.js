// Fallback names for players who submit an empty name.
// Inspired by Bill Hader's "Bobson Dugnutt" Mets bit.
// Capitalization preserves the "McX" pattern where the letter after Mc is capitalized.
export const FALLBACK_NAMES = [
  'Sleve McDichael',
  'Onson Sweemey',
  'Darryl Archideld',
  'Anatoli Smorin',
  'Rey McSriff',
  'Glenallen Mixon',
  'Mario McRlwain',
  'Raul Chamgerlain',
  'Kevin Nogilny',
  'Tony Smehrik',
  'Bobson Dugnutt',
  'Willie Dustice',
  'Jeromy Gride',
  'Scott Douroue',
  'Shown Furcotte',
  'Dean Wesrey',
  'Mike Truk',
  'Dwigt Rortugal',
  'Tim Sandaele',
  'Karl Dandleton',
  'Mike Sernandez',
  'Todd Bonzalez',
]

// Pick a fallback name that isn't already taken in the lobby.
// `existingNames` is an array of names already in use (case-insensitive compare).
// If every fallback is somehow taken, returns one anyway with a numeric suffix.
export function pickFallbackName(existingNames = []) {
  const takenLower = new Set(existingNames.map((n) => n.toLowerCase()))
  const available = FALLBACK_NAMES.filter((n) => !takenLower.has(n.toLowerCase()))

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]
  }

  // Pathological case: 22+ players all named themselves Bobson Dugnutt.
  // Append a random 2-digit suffix to break the tie.
  const base = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)]
  return `${base} ${Math.floor(Math.random() * 90) + 10}`
}

// True if `name` is one of our fallback names (with or without the suffix variant).
// Used to detect when a "name already taken" error came from a fallback collision
// so the caller can transparently retry with a different fallback.
export function isFallbackName(name) {
  if (!name) return false
  const lower = name.toLowerCase()
  for (const fallback of FALLBACK_NAMES) {
    const f = fallback.toLowerCase()
    if (lower === f) return true
    // Match the "Bobson Dugnutt 42" suffix-variant pattern.
    if (lower.startsWith(f + ' ') && /^\d{2}$/.test(lower.slice(f.length + 1))) return true
  }
  return false
}
