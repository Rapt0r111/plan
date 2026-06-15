import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("variable and settings hardening contracts", () => {
  it("keeps variable calendar dialogs inside the shared accessible-dialog lifecycle", () => {
    const source = readSource("app/(main)/variable/VariablePageClient.tsx");

    expect(source).toContain('import { useAccessibleDialog } from "@/shared/lib/hooks/useAccessibleDialog"');
    expect(source.match(/useAccessibleDialog\(true,/g)).toHaveLength(2);
    expect(source.match(/role="dialog"/g)).toHaveLength(2);
    expect(source.match(/tabIndex=\{-1\}/g)).toHaveLength(2);
  });

  it("does not expose hover-only settings actions to pointer users only", () => {
    const settingsSources = [
      "app/(main)/settings/EpicsTab.tsx",
      "app/(main)/settings/PersonnelGroupsTab.tsx",
      "app/(main)/settings/RolesTab.tsx",
      "app/(main)/settings/TasksTab.tsx",
      "app/(main)/settings/UsersTab.tsx",
    ].map(readSource);

    for (const source of settingsSources) {
      for (const className of source.matchAll(/className="([^"]*opacity-0[^\"]*group-hover:opacity-100[^\"]*)"/g)) {
        expect(className[1]).toContain("focus-visible:opacity-100");
      }
    }
  });

  it("associates personnel-group labels and inputs programmatically", () => {
    const source = readSource("app/(main)/settings/PersonnelGroupsTab.tsx");

    expect(source).toContain("useId");
    expect(source).toContain("htmlFor={inputId}");
    expect(source).toContain("id={inputId}");
    expect(source).toContain('aria-label={`Цвет состава ${group.label}`}');
    expect(source).toContain('aria-label={`Название состава ${group.label}`}');
  });
});
