/** Local and computer games need a unique identity independently of the wall clock. */
export function createLocalGameId(): string {
  return `local-${crypto.randomUUID()}`;
}
