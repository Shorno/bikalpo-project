export default function ToLetLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading To-Let marketplace"
      className="min-h-screen bg-background text-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="flex min-h-[470px] animate-pulse items-end rounded-xl bg-slate-900 p-6 sm:min-h-[500px] sm:p-10">
          <div className="w-full max-w-3xl space-y-4">
            <div className="h-4 w-32 rounded bg-white/20" />
            <div className="h-11 w-4/5 rounded bg-white/20" />
            <div className="h-5 w-3/5 rounded bg-white/15" />
            <div className="h-14 w-full rounded-xl bg-white/20" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl animate-pulse gap-3 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 rounded-xl border border-border bg-muted/40"
          />
        ))}
      </div>

      <div className="border-y border-border bg-muted/20 py-14">
        <div className="mx-auto max-w-7xl animate-pulse px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-72 rounded bg-muted" />
          <div className="mt-4 h-5 max-w-xl rounded bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-44 rounded-xl border border-border bg-background"
              />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading current listings and map data…</span>
    </div>
  );
}
