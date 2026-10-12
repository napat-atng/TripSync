export function isBeforeDeadline(deadline: string): boolean {
  return new Date(deadline).getTime() > Date.now();
}

export function isDeadlineNear(deadline: string): boolean {
  const remaining = new Date(deadline).getTime() - Date.now();
  return remaining > 0 && remaining <= 24 * 60 * 60 * 1000;
}
