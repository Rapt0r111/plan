"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NotificationItem = {
  id: number;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      if (data.ok) setItems(data.data);
    } catch {
      // The notification center must never break the sidebar.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    const ids = items.filter((item) => !item.readAt).map((item) => item.id);
    if (!ids.length) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setItems((prev) => prev.map((item) => ids.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item));
  }, [items]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all"
        style={{ background: "var(--glass-01)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: unread ? "#f59e0b" : "#34d399" }} />
        <span className="flex-1 text-left">Уведомления</span>
        {unread > 0 && (
          <span className="px-1.5 py-0.5 rounded-full font-mono text-[10px]" style={{ background: "rgba(245,158,11,0.14)", color: "#fbbf24" }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl overflow-hidden shadow-2xl z-30"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
        >
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: "var(--glass-border)" }}>
            <span className="text-xs font-semibold flex-1" style={{ color: "var(--text-primary)" }}>Центр уведомлений</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[10px]" style={{ color: "var(--accent-400)" }}>
                прочитано
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Пока нет уведомлений.
              </div>
            ) : items.slice(0, 10).map((item) => (
              <div key={item.id} className="px-3 py-2.5 border-b last:border-b-0" style={{ borderColor: "var(--glass-border)" }}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.readAt ? "#64748b" : "#f59e0b" }} />
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                </div>
                <p className="text-[11px] mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
