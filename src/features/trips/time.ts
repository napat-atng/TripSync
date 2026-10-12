const localMinutePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value ?? "";
  return {
    year: Number(value("year")), month: Number(value("month")), day: Number(value("day")),
    hour: Number(value("hour")), minute: Number(value("minute")),
  };
}

export function zonedInputValue(iso: string | null, timeZone: string): string {
  if (!iso || !isValidTimeZone(timeZone)) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = localParts(date, timeZone);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${two(parts.month)}-${two(parts.day)}T${two(parts.hour)}:${two(parts.minute)}`;
}

export function parseZonedInput(local: string, timeZone: string): Date | null {
  if (!localMinutePattern.test(local) || !isValidTimeZone(timeZone)) return null;
  const [year, month, day, hour, minute] = local.match(/\d+/g)!.map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(naive).toISOString().slice(0, 16) !== local) return null;

  const matches = new Set<number>();
  for (const sampleTime of [naive - 86_400_000, naive, naive + 86_400_000]) {
    const sample = localParts(new Date(sampleTime), timeZone);
    const offset = Date.UTC(sample.year, sample.month - 1, sample.day, sample.hour, sample.minute)
      - sampleTime;
    const candidate = naive - offset;
    if (zonedInputValue(new Date(candidate).toISOString(), timeZone) === local) {
      matches.add(candidate);
    }
  }
  return matches.size === 1 ? new Date([...matches][0]) : null;
}
