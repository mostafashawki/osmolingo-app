import { describe, expect, it } from "vitest";
import { formatElapsed } from "./time";

describe("formatElapsed", () => {
  it("formats elapsed waiting time for a generated question", () => {
    expect(formatElapsed("2026-07-08T10:00:00.000Z", new Date("2026-07-08T10:00:20.000Z"))).toBe(
      "less than a minute"
    );
    expect(formatElapsed("2026-07-08T10:00:00.000Z", new Date("2026-07-08T10:07:00.000Z"))).toBe("7 min");
    expect(formatElapsed("2026-07-08T10:00:00.000Z", new Date("2026-07-08T12:05:00.000Z"))).toBe(
      "2 hr 5 min"
    );
  });
});
