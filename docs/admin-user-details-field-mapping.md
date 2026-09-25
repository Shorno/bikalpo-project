# Admin user details: field mapping

The retailer and warehouse detail pages follow the supplied User Details wireframe: company logo and business summary, five tabs (Basic Information, Documents, Plan, Performance, Admin Notes), and the existing seller actions. The document's names, amounts, dates, ratings and rankings are examples, not application data.

No database columns or sample business data were added. A dash means that the value is missing or the requested concept is not recorded. Zero is used only when a real count or sum returns zero.

### Fields completed after registration

The owner Settings editor updates the existing latest `sellerApplication` and account fields in one transaction. Admin details read that same latest record, so the saved business type, nature, experience, sales volume, contact details, social links, location, tax identifiers and documents are current, not a frozen registration copy. The five tabs and original two-column Business Info / Social Network layout remain shared by retailer, warehouse and approval details.

The Basic Information tab also exposes these existing settings fields:

- Owner Name, Mobile Number and Email Address from the application. Profile owner name/mobile can fall back to the linked account when absent. Email falls back only when no application exists, so clearing the business email keeps it blank. Generated phone-login email addresses are not shown as contact email. Request details retain the selected application's values.
- Division, District, Upazila / Thana, Area and Post Code, plus coordinates when recorded. Profiles can use account coordinates when application coordinates are absent.
- Messenger, Telegram and X / Twitter when saved, alongside the original social fields.
- Trade License Number, TIN Number and BIN Number when any registration identifier exists.
- Retailer opening/closing times when recorded on the account.
- Bank Accounts and Mobile Banking from existing `financePaymentAccount` settings, scoped by both business owner ID and owner type. These are read without creating default accounts. Cash accounts and balances are outside the profile. Account numbers follow the existing profile convention of showing only their last four characters; Active/Inactive comes from the saved account state. Historical application bank fields, when present, are separately labelled Registration Bank Details.

The Documents tab additionally shows Warehouse Photo when its explicitly labelled upload exists. No schema fields, seeded values, or guessed document types were added. Empty optional sections are omitted; empty rows within an existing section retain a dash. The warehouse settings page currently exposes fewer editable fields, but admin details use all corresponding saved warehouse-application fields.

Edit Seller loads business contacts from the same profile record as the displayed fields and submits only changed values. Owner-name edits update the account and its latest business application together. Business mobile/email edits update that application's existing contact fields; the separately labelled Sign-in Phone retains the existing account-identity update behavior. Earlier applications are not rewritten. Contact edits do not change document verification or application review status.

## Existing fields used

| Document field | Existing source |
| --- | --- |
| Company Logo / Change Logo | Retailer `user.shopLogo`; admin editing now updates this existing field. Warehouse accounts have no dedicated company-logo field. Owner/profile photographs are not substituted for company logos. |
| ID Number | Latest application's `applicationNumber`; actual user ID if no application number exists. |
| Business Name | Account `shopName` / `warehouseName`, falling back to the account name. |
| Type / Business Type | Application's linked `productType.name`, then saved `businessCategory`. Platform role is not substituted for product type. |
| Nature | Application `businessNature`, with its existing display label. |
| Complete | Existing `computeProfileCompletion` calculation. |
| Plan / Current Plan | Existing current subscription and admin-managed plan catalog, with the previously implemented Free / Free Trial fallback. |
| Since / Registered | Account `createdAt`. |
| Coverage | Application `area`, `district`, `division`. These are recorded registration locations, not an inferred delivery-service territory. |
| Address | Account shop/warehouse address, then the linked application's address. |
| Experience | Application `yearsInBusiness`. |
| Sales Volume | Application's declared `monthlyRevenue` band; separate from measured Total Sales. |
| Facebook, WhatsApp, Instagram, Website, TikTok | Corresponding saved application social fields. Only HTTP(S) addresses become external links. |
| Referral ID | Application `referralId`, displayed as saved text. It is not assumed to identify a valid linked referral record. |
| Trade License, National ID, Shop Photo, Store Front, Warehouse Photo | Explicitly labelled `documentUrls.tradeLicense`, `nid`, `shopPhoto`, `storeFront`, `warehouse`. The first four slots remain blank with View disabled when missing; the optional warehouse photo appears only when recorded. Unlabelled legacy files are not guessed into another document type. |
| Subscription Status, Plan Start Date, Expiry Date, Auto Renewal, Next Billing Date, Payment Status | Existing subscription DTO and subscription policy. A fallback plan label does not create a subscription, active status, dates, or payment. |
| Last Active, Device, IP Address | Latest retained session's `updatedAt`, parsed `userAgent`, and `ipAddress`. Last Active is the latest recorded session update, not live activity. Missing session records stay blank. |
| Application Approved | Application `reviewedAt`, only when its status is approved. |
| KYC Verified | KYC `reviewedAt`, only when verified. |
| Last Verification text, Last Reviewed By, Last Reviewed Date | Most recent dated KYC/application review, keeping its notes, reviewer and date together. Reviewer name is resolved from the stored reviewer ID. No canned verification statements are generated. |
| Edit Seller, Suspend Seller | Existing admin update and suspension procedures. A suspended account has the existing Reactivate action. KYC verification remains available in the summary's icon controls. |

## Business performance scope

The Performance tab reads existing records on demand:

- **Shop Followers:** existing retailer `shop_follower` records. Unavailable for warehouses and accounts without the retail storefront capability.
- **Total Orders:** B2C orders assigned to the retailer, or B2B orders supplied by the warehouse. Orders the business placed to buy stock are excluded.
- **Pending Orders / Cancelled Orders:** those sales orders with the corresponding stored status.
- **Total Sales:** sum of those sales-order totals whose status is Delivered. This is not a profit, cash-collection, or accounting report; POS transactions and procurement are outside this figure.
- **Last Month Orders:** those sales orders created in the previous complete calendar month in Asia/Dhaka, using an inclusive start and exclusive end.

The relevant labels have explanatory tooltips. No synthetic orders, followers, sales, or percentages are shown.

## Missing fields and additions

| Missing item | Current handling | What adding it requires |
| --- | --- | --- |
| Warehouse company logo / Change Logo | Logo slot blank; no unsupported upload control. | Small addition: dedicated nullable logo column, validated admin update, and the existing image uploader. |
| Referral Relation | Dash. | Small schema/form addition for an explicit relationship, or an agreed mapping to validated referral records. Do not infer it from a person's name or account role. |
| Referral ID link | ID remains plain text. | A verified relationship between the saved referral identifier and its destination record; free-text IDs are not sufficient. |
| Compliance Status | Dash. | A stored compliance/review outcome and rules for setting it. Approval or verified KYC alone does not mean “Good Standing.” |
| Average Rating | Dash. | Seller-specific review attribution. Existing ratings describe products shared across sellers; they cannot establish this business's own rating. |
| Success Rate | Dash. | Easy to calculate from existing order statuses after agreeing on the denominator and treatment of pending, returned and cancelled orders. No formula is assumed. |
| Nature Rank, Type Rank, Area Rank | Dashes. | Ranking metric, time window, comparison population and tie rules. These ranks are not currently recorded. |
| Warehouse followers | Dash. | A warehouse-following feature and real follow records. |
| Separate Block Seller / warning action | Omitted. Suspend and Reactivate remain functional. | A distinct state/action and access rules. The existing `banned` flag already implements suspension; a second label would not be a separate capability. |

These missing items were not added to the database. Existing fields that are empty for one account remain blank until real information is supplied.

## Approval list and request details

The approval list uses the requested search, three filters, three summary blocks and six columns. Both retailer and warehouse requests remain included. The example IDs, names and counts in the wireframe are not seeded.

| Approval field | Existing source / definition |
| --- | --- |
| ID Number | Application number, falling back to the actual application ID. |
| Name | Application owner name. |
| Location | Saved district, then area if district is missing. |
| Business Nature | Saved application business nature and its existing label. |
| Business Type | Linked product-type name, falling back to the saved business category. The filter uses this same value. |
| Active | Approved requests whose linked account is not suspended. |
| Verified | Requests whose linked account's latest KYC record is verified and whose account is not suspended. This may overlap Active. |
| Pending | Pending applications whose linked account is not suspended. |
| Suspended | Requests whose linked account has the existing suspension flag. Counts requests, not distinct accounts. |
| Total Requests | All requests matching the current search and filters, including status. |
| Frozen | Blank: there is no stored Frozen request/account state. Rejected and Pending are not relabelled as Frozen. |

Summary counts and the table use the same database filters. Pagination happens in the database. Existing links from the overview can carry an account-type, business-nature or referral scope; those appear as removable filter chips, and Reset Filter clears them along with the three documented filters and search.

Profile and request details use the same layout, hero, five tabs, field sections and responsive behavior. A request displays the specifically selected application's business details, documents and review notes, even if a newer application exists. Account registration and login/KYC information come from its linked account. The current subscription and retailer logo are used only when that account has the matching business role; otherwise, the selected plan is resolved against the admin catalog without inventing subscription dates or payments. Performance stays blank until the request is approved and the linked account has the corresponding business role. The existing Approve, Reject and KYC procedures remain available; approved requests can open the business profile.

Financial settings and retailer operating hours in request details are current linked-account information and appear only for the matching business role. Registration contacts, location, tax and bank fields still come from the specifically selected application.
