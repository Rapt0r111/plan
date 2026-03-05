/**
 * @file loading.tsx — app/(main)/dashboard
 *
 * Skeleton-лоадер для /dashboard.
 * THEME v4: hardcoded rgba(8,9,15,…) → var(--header-bg)
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-10 flex items-center px-6 gap-4"
        style={{
          height: "var(--header-h)",
          background: "var(--header-bg)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex-1">
          <div className="h-3.5 w-20 rounded" style={{ background: "var(--glass-03)" }} />
          <div className="h-2.5 w-48 rounded mt-1.5" style={{ background: "var(--glass-02)" }} />
        </div>
        <div className="h-7 w-24 rounded-xl" style={{ background: "var(--glass-02)" }} />
        <div className="h-7 w-16 rounded-xl" style={{ background: "var(--glass-02)" }} />
      </div>

      <div className="p-6 space-y-8">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-4"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
            >
              <div className="h-2.5 w-20 rounded mb-3" style={{ background: "var(--glass-02)" }} />
              <div className="h-7 w-12 rounded" style={{ background: "var(--glass-03)" }} />
            </div>
          ))}
        </div>

        {/* Epics grid skeleton */}
        <section>
          <div className="h-2.5 w-12 rounded mb-3" style={{ background: "var(--glass-02)" }} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-16 rounded" style={{ background: "var(--glass-02)" }} />
                    <div className="h-3.5 w-32 rounded" style={{ background: "var(--glass-03)" }} />
                  </div>
                  <div className="w-11 h-11 rounded-full" style={{ background: "var(--glass-02)" }} />
                </div>
                <div className="px-4 pb-3">
                  <div className="h-1 rounded-full" style={{ background: "var(--glass-02)" }} />
                </div>
                <div
                  className="px-4 py-2.5 flex justify-between"
                  style={{ borderTop: "1px solid var(--glass-border)" }}
                >
                  <div className="h-2.5 w-16 rounded" style={{ background: "var(--glass-02)" }} />
                  <div className="h-2.5 w-20 rounded" style={{ background: "var(--glass-02)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team skeleton */}
        <section>
          <div className="h-2.5 w-16 rounded mb-3" style={{ background: "var(--glass-02)" }} />
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)" }}
          >
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="px-4 py-3 flex items-center gap-3"
                style={{ borderBottom: i < 4 ? "1px solid var(--glass-border)" : "none" }}
              >
                <div className="w-7 h-7 rounded-full" style={{ background: "var(--glass-03)" }} />
                <div className="h-3 flex-1 rounded" style={{ background: "var(--glass-02)" }} />
                <div className="h-5 w-20 rounded-full" style={{ background: "var(--glass-02)" }} />
              </div>
            ))}
          </div>
        </section>

        {/* Heavy widgets skeleton */}
        <section>
          <div className="h-2.5 w-20 rounded mb-3" style={{ background: "var(--glass-02)" }} />
          <div
            className="rounded-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 56 }}
          />
        </section>

        <section>
          <div className="h-2.5 w-24 rounded mb-3" style={{ background: "var(--glass-02)" }} />
          <div
            className="rounded-2xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--glass-border)", height: 200 }}
          />
        </section>
      </div>
    </div>
  );
}