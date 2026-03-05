/**
 * @file loading.tsx — app/(main)/board
 *
 * Skeleton-лоадер для /board.
 * Показывается пока BoardRoute загружает getAllEpicsWithTasks().
 */
export default function BoardLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center px-6 gap-4"
        style={{
          height: "var(--header-h)",
          background: "rgba(8,9,15,0.80)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex-1">
          <div className="h-3.5 w-16 rounded" style={{ background: "var(--glass-03)" }} />
          <div className="h-2.5 w-32 rounded mt-1.5" style={{ background: "var(--glass-02)" }} />
        </div>
        <div className="h-7 w-24 rounded-xl" style={{ background: "var(--glass-02)" }} />
        <div className="h-7 w-32 rounded-xl" style={{ background: "var(--glass-02)" }} />
      </div>

      {/* Filters bar */}
      <div
        className="shrink-0 px-6 py-3 border-b flex gap-3"
        style={{ background: "rgba(8,9,15,0.7)", borderColor: "var(--glass-border)" }}
      >
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full" style={{ background: "var(--glass-02)" }} />
        ))}
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto">
        <div
          className="p-6 grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}
        >
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                borderLeft: "3px solid var(--glass-03)",
              }}
            >
              {/* Column header */}
              <div
                className="px-4 py-3.5 flex items-center gap-3"
                style={{ borderBottom: "1px solid var(--glass-border)" }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--glass-03)" }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded" style={{ background: "var(--glass-03)" }} />
                </div>
                <div className="h-5 w-10 rounded-full" style={{ background: "var(--glass-02)" }} />
              </div>

              {/* Progress bar */}
              <div className="h-0.5" style={{ background: "var(--glass-02)" }} />

              {/* Task cards */}
              <div className="p-3 space-y-2.5">
                {[...Array(3 - i)].map((_, j) => (
                  <div
                    key={j}
                    className="rounded-xl px-3.5 py-3 space-y-2"
                    style={{
                      background: "var(--bg-overlay)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-20 rounded-full" style={{ background: "var(--glass-02)" }} />
                      <div className="h-3 w-10 rounded" style={{ background: "var(--glass-02)" }} />
                    </div>
                    <div className="h-3.5 w-full rounded" style={{ background: "var(--glass-02)" }} />
                    <div className="h-3.5 w-3/4 rounded" style={{ background: "var(--glass-02)" }} />
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex -space-x-1.5">
                        <div className="w-5 h-5 rounded-full" style={{ background: "var(--glass-03)" }} />
                        <div className="w-5 h-5 rounded-full" style={{ background: "var(--glass-03)" }} />
                      </div>
                      <div className="w-8 h-8 rounded-full" style={{ background: "var(--glass-02)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}