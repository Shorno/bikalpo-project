# Property registration location lists

Source: [client Location document](https://docs.google.com/document/d/1UdG6O_YLls-w8XGEODcjEPdXssKe6JVGqM_DankYsx8/edit?tab=t.9t17yuarxtc1), read 2026-09-08. All 71 division/district subtabs were exported and inspected.

## Coverage

- Existing Division / District selector retains all 8 divisions and 64 districts.
- Imported 62 districts, 542 Upazila / Thana options and 13777 parent-specific area entries. The area count is not a count of globally unique locations.
- Gopalganj and Kishoreganj have no detailed district tab in the supplied document; they remain selectable with manual Upazila / Area entry.
- Some source entries are incomplete. For example, Bhola has detailed areas for Bhola Sadar and Daulatkhan only. Its other explicitly listed upazilas remain selectable with manual area entry.
- This is the client's supplied location dataset, not a verified government administrative register. Source spelling variants are preserved rather than silently merged.

## Mapping rules

- Division → District → Upazila / Thana → Area. Changing a parent clears its children; reselecting the same parent preserves them.
- Search is local, case-insensitive and works without a third-party geocoding API. Only the selected parent's options are shown.
- Direct district bullets define Upazila / Thana and their areas. Explicitly parented Union subsections are flattened into that Upazila's Area choices, never promoted to Upazila.
- Keraniganj's separate tab explicitly identifies Dhaka District and is merged there.
- Case-insensitive duplicates are removed within each parent, not across different parents.
- Unparented urban/landmark appendices and ambiguous metropolitan summary groups are not assigned by guesswork. They remain possible through manual entry.
- Division summary tabs supplement explicitly listed Upazilas with no detailed area appendix. They do not invent area mappings.
- Manual entry is labelled “not listed”; existing saved free-text values remain visible. Maximum input length remains 150 characters.

Both registration and property editing use the same location component. This change does not run database migrations, write property records or publish to GitHub.

## Verification

Run `bun test apps/web/constants/property-location-options.test.ts` for parent isolation, document examples, canonical district keys, label limits and duplicate checks.
