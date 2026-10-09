import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./navigation";

describe("OAuth return paths", () => {
  it("preserves invitation routes and query parameters", () => {
    expect(safeReturnPath("/join/abc?from=invite")).toBe("/join/abc?from=invite");
  });
  it.each(["https://attacker.example", "//attacker.example", "/\\attacker.example", "/login", "/auth/callback", null, "/\n/attacker.example"])("rejects unsafe or looping paths: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});
