export default function TodayLoading() {
  return (
    <div className="animate-pulse px-4 py-5 sm:px-6 sm:py-6" aria-label="Загружается рабочая очередь">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-[20px] border border-(--glass-border) bg-(--bg-elevated)">
        <div className="border-b border-(--glass-border) p-5">
          <div className="h-4 w-24 rounded bg-(--glass-02)" />
          <div className="mt-3 h-7 w-80 max-w-full rounded bg-(--glass-02)" />
          <div className="mt-3 h-4 w-[34rem] max-w-full rounded bg-(--glass-01)" />
          <div className="mt-5 flex gap-2 overflow-hidden">
            {[88, 104, 92, 112, 124].map((width) => <div key={width} className="h-9 shrink-0 rounded-lg bg-(--glass-02)" style={{ width }} />)}
          </div>
        </div>
        <div className="grid min-h-[560px] xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="divide-y divide-(--glass-border) xl:border-r xl:border-(--glass-border)">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="p-5">
                <div className="h-4 rounded bg-(--glass-02)" style={{ width: `${58 + item * 5}%` }} />
                <div className="mt-3 h-3 w-2/5 rounded bg-(--glass-01)" />
                <div className="mt-4 flex gap-2"><div className="h-8 w-20 rounded-lg bg-(--glass-01)" /><div className="h-8 w-24 rounded-lg bg-(--glass-01)" /></div>
              </div>
            ))}
          </div>
          <div className="space-y-5 p-5">
            <div className="h-4 w-28 rounded bg-(--glass-02)" />
            {[1, 2, 3].map((item) => <div key={item} className="h-14 rounded-lg bg-(--glass-01)" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
