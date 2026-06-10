import { afterEach, describe, expect, it } from "vitest";
import {
  getDialogFocusableElements,
  trapDialogTabKey,
} from "@/shared/lib/hooks/useAccessibleDialog";

afterEach(() => {
  document.body.replaceChildren();
});

describe("accessible dialog focus helpers", () => {
  it("returns only interactive elements available to keyboard users", () => {
    const dialog = document.createElement("div");
    dialog.innerHTML = `
      <button id="first">First</button>
      <button disabled>Disabled</button>
      <a href="/tasks">Tasks</a>
      <input type="hidden" />
      <button hidden>Hidden</button>
      <button aria-hidden="true">Decorative</button>
      <div tabindex="-1">Programmatic only</div>
    `;

    expect(getDialogFocusableElements(dialog).map((element) => element.textContent)).toEqual([
      "First",
      "Tasks",
    ]);
  });

  it("wraps Tab and Shift+Tab inside the dialog", () => {
    const dialog = document.createElement("div");
    dialog.innerHTML = `<button>First</button><button>Last</button>`;
    document.body.append(dialog);
    const [first, last] = getDialogFocusableElements(dialog);

    last.focus();
    const forward = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapDialogTabKey(forward, dialog);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backward = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      cancelable: true,
    });
    trapDialogTabKey(backward, dialog);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});
