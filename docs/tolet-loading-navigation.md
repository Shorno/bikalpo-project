# To-Let loading and navigation

Align To-Let marketplace and detail navigation with the existing public/store pages, without redesigning their content or adding unrelated features.

- Keep oRPC server fetching and fresh availability data.
- Use in-app search navigation with pending feedback rather than a document reload.
- Give public, QR and legacy detail routes appropriate loading skeletons; QR property loading should match its listing grid.
- Enable normal Next link prefetching for listing cards.
- Make public/QR listing reads side-effect free. Count displayed detail views separately without blocking rendering or changing booking freshness timestamps. Preserve existing public and QR access rules.
- Provide recoverable To-Let fetch-error UI.

Validation: browser search/detail navigation and responsive layout; isolated database integration coverage for read/view separation, timestamps and public/QR access; full existing test suite and typecheck.
