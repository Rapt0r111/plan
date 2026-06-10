import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionButton } from "@/shared/ui/ActionButton";

describe("ActionButton", () => {
  it("renders a semantic variant and native button attributes", () => {
    const html = renderToStaticMarkup(
      <ActionButton type="submit" variant="danger" disabled aria-label="Удалить задачу">
        Удалить
      </ActionButton>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('aria-label="Удалить задачу"');
    expect(html).toContain("disabled");
    expect(html).toContain("rgba(239,68,68,0.12)");
    expect(html).toContain("#f87171");
  });

  it("supports compact sizing and merges caller classes", () => {
    const html = renderToStaticMarkup(
      <ActionButton size="sm" className="min-w-20">
        Сохранить
      </ActionButton>,
    );

    expect(html).toContain("rounded-lg");
    expect(html).toContain("px-3");
    expect(html).toContain("py-1.5");
    expect(html).toContain("text-xs");
    expect(html).toContain("min-w-20");
  });
});
