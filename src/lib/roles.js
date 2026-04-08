/**
 * Assign roles to players.
 * - If randomRoles is OFF: host is interrogator, one random non-host is truthful, rest are dubious.
 * - If randomRoles is ON: one random player is interrogator, one other random is truthful, rest dubious.
 *
 * Returns { playerUpdates: { [playerId]: { role } }, selectedArticleTitle }
 */
export function assignRoles(players, hostId, randomRoles) {
  const playerIds = Object.keys(players)

  let interrogatorId

  if (randomRoles) {
    // Random player becomes interrogator
    interrogatorId = playerIds[Math.floor(Math.random() * playerIds.length)]
  } else {
    // Host is always interrogator
    interrogatorId = hostId
  }

  // Professors are everyone except the interrogator
  const professorIds = playerIds.filter(id => id !== interrogatorId)

  // Pick one random professor as truthful
  const truthfulIdx = Math.floor(Math.random() * professorIds.length)
  const truthfulId = professorIds[truthfulIdx]

  // The selected article is the truthful professor's article
  const selectedArticleTitle = players[truthfulId].articleTitle

  const playerUpdates = {}

  for (const id of playerIds) {
    if (id === interrogatorId) {
      playerUpdates[id] = { role: 'interrogator' }
    } else if (id === truthfulId) {
      playerUpdates[id] = { role: 'truthful' }
    } else {
      playerUpdates[id] = { role: 'dubious' }
    }
  }

  return { playerUpdates, selectedArticleTitle }
}
