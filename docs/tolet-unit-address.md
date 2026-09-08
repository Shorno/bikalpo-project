# Unit address selection

- Unit create/edit defaults to **Use property registration address**. A null `addressOverride` inherits the property's current location; property edits continue to apply to these units.
- **Use a different address for this unit** stores a complete location object on the unit. Division, district, upazila/thana, area, full address and GPS capture are required, matching registration. Landmark is optional. GPS capture checks Bangladesh bounds and uses the same reverse-geocoding service to populate location fields; coordinates are retained if address lookup fails. Existing typed full address is preserved.
- The property record is never overwritten. Custom addresses do not inherit the property's GPS or landmark.
- Switching between the two options preserves the unsaved custom draft. Changing a location parent resets its descendants and GPS. Changing full address clears captured GPS.
- Existing units inherit automatically. Older API clients omitting the new field preserve an existing override on update; explicit null switches back to inheritance.
- Public listing location/map fields, owner posts, new booking snapshots, and alert matching/display resolve the selected unit address. Existing booking snapshots remain historical.
- Owner unit details display the address source and effective address.

## Database / deployment

`0079_tolet_unit_address.sql` adds nullable JSONB `tolet_unit.address_override`. Renumbered from 0074 during upstream integration to preserve upstream migration order. It is additive and idempotent. Apply before deploying code that selects the new column. The migration was applied to the configured local-development connection; no business records were modified for this task. No GitHub push or production code deployment was performed.

## Checks

`bun test packages/api/src/lib/tolet-unit-address.test.ts apps/web/constants/property-location-options.test.ts`

Local browser checks covered custom address selection, parent resets and toggling/draft preservation. No real unit was created for testing.
