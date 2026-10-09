import { describe, expect, it } from "vitest";
import { tripInput } from "./validation";

const valid = { name: "  Weekend  ", description: "", timezone: "Asia/Bangkok", joinMode: "open" };
describe("room creation validation", () => {
  it("normalizes names and accepts the Bangkok default", () => expect(tripInput.parse(valid).name).toBe("Weekend"));
  it.each([{ name: " " }, { timezone: "invalid/zone" }, { name: "x".repeat(121) }, { joinMode: "guest" }])("rejects invalid input: %s", patch => {
    expect(tripInput.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
