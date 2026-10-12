import assert from "node:assert/strict";
import test from "node:test";
import { isValidTimeZone, parseZonedInput, zonedInputValue } from "./time.ts";

test("converts local trip time using its IANA timezone", () => {
  assert.equal(parseZonedInput("2026-10-12T10:30", "Asia/Bangkok")?.toISOString(), "2026-10-12T03:30:00.000Z");
  assert.equal(parseZonedInput("2026-07-01T10:30", "Europe/London")?.toISOString(), "2026-07-01T09:30:00.000Z");
  assert.equal(parseZonedInput("2026-10-12T10:30", "Asia/Kathmandu")?.toISOString(), "2026-10-12T04:45:00.000Z");
  assert.equal(zonedInputValue("2026-10-12T03:30:00.000Z", "Asia/Bangkok"), "2026-10-12T10:30");
});

test("rejects invalid and ambiguous local times", () => {
  assert.equal(isValidTimeZone("Invalid/Zone"), false);
  assert.equal(parseZonedInput("2026-02-30T10:00", "Asia/Bangkok"), null);
  assert.equal(parseZonedInput("2026-03-08T02:30", "America/New_York"), null);
  assert.equal(parseZonedInput("2026-11-01T01:30", "America/New_York"), null);
});
