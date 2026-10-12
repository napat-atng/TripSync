export function isBeforeDeadline(deadline: string): boolean {
  return new Date(deadline).getTime() > Date.now();
}
