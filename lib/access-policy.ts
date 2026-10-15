// Saved roles never grant ownership. Unknown roles fail closed as viewers.
export function tournamentRole(isOwner: boolean, accountId: string, ownerId: string, savedRole: string) {
  if (isOwner && accountId === ownerId) return 'admin';
  return savedRole === 'manager' || savedRole === 'participant' ? 'manager' : 'viewer';
}
