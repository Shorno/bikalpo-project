# To-Let landing platform statistics

The landing page replaces rental-only summary cards with aggregate platform counts.
`landing.getPlatformStats` is public and returns numbers only; it does not expose
individual users, orders, or registration data. No migration or database writes are required.

- Registered Users: all existing user rows (accounts, not sessions).
- Active Sellers: distinct approved, non-banned shop-owner/warehouse accounts from
  the existing seller-directory registration rules. Missing map coordinates do not
  exclude an otherwise approved seller. This does not mean recently online.
- Products & Services: active, public product rows. There is no independent service
  catalog source currently included; this counts catalog items, not inventory units
  or variant rows. If services get a separate catalog, extend this metric explicitly.
- Daily Orders: orders created during the current Asia/Dhaka calendar day, excluding
  cancelled orders; both B2B and B2C rows in the order table are included. This is
  not a daily average, rent bookings, or separate POS sales.

The server-rendered page uses its existing 60-second public fetch cache. Zero is
a valid value. Failed requests show an em dash and unavailable status, never fake
sample totals. Figures from reference images are not seeded into the database.
