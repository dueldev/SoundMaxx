import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOL_HREF,
  TOOL_CONFIGS,
  getToolConfigBySlug,
  getToolConfigByType,
} from "@/lib/tool-config";

describe("tool-config", () => {
  it("maps every tool slug to a config with an href", () => {
    for (const tool of TOOL_CONFIGS) {
      const bySlug = getToolConfigBySlug(tool.slug);
      const byType = getToolConfigByType(tool.toolType);

      expect(bySlug).toBeDefined();
      expect(byType).toBeDefined();
      expect(bySlug?.href).toBe(`/tools/${tool.slug}`);
      expect(byType?.slug).toBe(tool.slug);
    }
  });

  it("returns undefined for unknown slugs", () => {
    expect(getToolConfigBySlug("unknown-tool")).toBeUndefined();
  });

  it("has a stable default tool route", () => {
    expect(DEFAULT_TOOL_HREF).toBe("/tools/stem-isolation");
  });
});
