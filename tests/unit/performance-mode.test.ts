import { describe, expect, it } from "vitest";
import { resolvePerformanceMode } from "@/shared/lib/usePerformanceMode";

describe("resolvePerformanceMode", () => {
  it("keeps subtle motion lightweight without disabling state transitions", () => {
    expect(resolvePerformanceMode("subtle", false)).toEqual({
      lowMotion: true,
      noMotion: false,
    });
  });

  it("honors the operating-system reduced-motion preference", () => {
    expect(resolvePerformanceMode("full", true)).toEqual({
      lowMotion: true,
      noMotion: true,
    });
  });
});
