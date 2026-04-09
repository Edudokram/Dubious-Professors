// Curated list of funny 3-letter lobby codes.
// Edit this list to add/remove codes.
const CODES = [
  'ASS', 'SUS', 'WTF', 'SMH', 'IDK', 'PEE', 'POO', 'NUT', 'AYO',
  'BRB', 'LOL', 'YAP', 'CAP', 'MID', 'HOE', 'RAW'
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function randomCode() {
  return LETTERS[Math.floor(Math.random() * 26)]
    + LETTERS[Math.floor(Math.random() * 26)]
    + LETTERS[Math.floor(Math.random() * 26)]
}

export function generateRoomCode() {
  const roll = Math.random()
  if (roll < 0.34) {
    return CODES[Math.floor(Math.random() * CODES.length)]
  }
  return randomCode()
}
