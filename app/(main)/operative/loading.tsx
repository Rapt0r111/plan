/**
 * @file loading.tsx — app/(main)/operative
 * Skeleton-лоадер для /operative.
 */
export default function OperativeLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center px-6 gap-4"
        style={{
          height:      "var(--header-h)",
          background:  "var(--header-bg)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-40 rounded" style={{ background: "var(--glass-03)" }} />
          <div className="h-2.5 w-56 rounded" style={{ background: "var(--glass-02)" }} />
        </div>
        <div className="h-7 w-20 rounded-xl" style={{ background: "var(--glass-02)" }} />
      </div>

      {/* Grid */}
      <div
        className="p-6 grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{
              background:  "var(--bg-elevated)",
              border:      "1px solid var(--glass-border)",
              borderTop:   "3px solid var(--glass-03)",
              minHeight:   240,
              opacity:     1 - i * 0.1,
            }}
          >
            {/* Block header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid var(--glass-border)" }}
            >
              <div
                className="w-9 h-9 rounded-xl shrink-0"
                style={{ background: "var(--glass-03)" }}
              />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded" style={{ background: "var(--glass-03)" }} />
                <div className="h-2.5 w-20 rounded-full" style={{ background: "var(--glass-02)" }} />
              </div>
            </div>

            {/* Tasks skeleton */}
            <div className="p-3 space-y-2">
              {[...Array(3 - (i % 2))].map((_, j) => (
                <div
                  key={j}
                  className="rounded-xl px-3 py-2.5 space-y-2"
                  style={{
                    background: "var(--bg-overlay)",
                    border:     "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-20 rounded-full" style={{ background: "var(--glass-02)" }} />
                    <div className="h-3.5 flex-1 rounded" style={{ background: "var(--glass-02)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}