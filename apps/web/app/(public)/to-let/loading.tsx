export default function ToLetLoading() {
  return <div className="site-container space-y-6 px-4 py-8" role="status" aria-label="Loading To-Let">
    <p className="sr-only">To-Let লোড হচ্ছে…</p>
    <div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1,2,3,4].map(n => <div key={n} className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>
  </div>;
}
