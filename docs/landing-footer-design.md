# Landing footer design

## Current design

The user-approved footer reference controls the composition: three columns for brand/participants/social, seller locations/apps, and About/contact, followed by a full-width copyright band. The supplied Bikalpo logo remains unchanged. The slogan remains “Multi-channel digital e-commerce.”

The complete footer uses one uninterrupted soft aqua surface (#e4f3ef), including the copyright area. Headings and icons use brand blue (#2455c6), body ink is #244459, and secondary ink is #466572. The earlier top rule and blue copyright band were removed in response to client feedback. These values are scoped to landing-footer.module.css, not the global product theme.

The desktop layout has 40px vertical padding and compact 32px navigation rows. Mobile and coarse-pointer links keep 44px targets. At intermediate widths the brand spans both columns; narrow screens stack sections. Participant labels are dot-separated, matching the reference. The logo occupies 48px, alongside a 24px Bikalpo name. Apps and social icons retain pale outlined placeholder styling.

## Behavior preserved

Seller locations and exact counts are loaded from approved business map registrations. When fewer than five live locations are available, the section-level note labels the supplemental sample entries so the three-column composition can be evaluated without repeating a badge on every row. Each live location opens its real seller list. Loading, unavailable, and retry states inherit the aqua palette. The six About destinations and contact page remain linked; provisional contact, app, and social details remain clearly marked.

## Verification

Desktop (1440), intermediate (768), and mobile (390) layouts checked in the live browser, with no horizontal overflow. Targeted Biome passed; design detector reported no findings. Brand colors were checked for text contrast. Screenshot: artifacts/footer/brand-footer-desktop.png. Earlier screenshots document superseded designs.

## Matching public header

The shared public header uses the same soft aqua #e4f3ef and brand blue #2455c6. The supplied logo and Bikalpo name sit beside a white search field with an aqua border and blue focus outline. Desktop navigation is arranged as three equal, icon-free text blocks on the same aqua surface, with larger type and weight-only active emphasis. The earlier blue navigation band and mobile divider were removed. Cart, menu, login, and avatar text use brand blue; the cart becomes icon-only on mobile to preserve space. Store-specific retailer navigation retains its existing identity.

Targeted lint and design detector passed. Desktop/mobile layouts were inspected, mobile width has no horizontal overflow, and search input/clear plus mobile navigation open/close were exercised. Screenshots: artifacts/footer/brand-header-desktop.png and brand-header-mobile.png.
