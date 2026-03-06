# Supplier Profile Page: Rating, Follow System & Tab Reorder

Three changes to the supplier/vendor profile page (`/supplier/{slug}`): reorder the navigation tabs, show rating below location, and implement a working follow system.

## Proposed Changes

### 1. Tab Reordering (Frontend Only)

#### [MODIFY] [SupplierDetailsComponent.tsx](file:///c:/Users/Shorno/WebstormProjects/selfshop/Client/src/components/pages/supplier/SupplierDetailsComponent.tsx)

Current order: `[Category pills: All, Men's Fashion, ...]` → divider → `[All Products, Profile]`

New order: `[All Products, Profile]` → divider → `[All, category pills...]`

This means "All Products" and "Profile" tabs come from the left side first, then the category filter pills.

---

### 2. Rating Below Location

#### [MODIFY] [SupplierDetailsComponent.tsx](file:///c:/Users/Shorno/WebstormProjects/selfshop/Client/src/components/pages/supplier/SupplierDetailsComponent.tsx)

Move the rating display (stars + review count) from the inline stats row to a separate row below the location/product count line. This makes it more visible on mobile.

---

### 3. Follow System (Full Stack)

#### Backend

#### [NEW] Migration: `create_vendor_followers_table`

```php
Schema::create('vendor_followers', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('cascade');
    $table->foreignId('vendor_id')->constrained()->onDelete('cascade');
    $table->timestamps();
    $table->unique(['user_id', 'vendor_id']); // prevent duplicate follows
});
```

#### [NEW] [VendorFollower.php](file:///c:/Users/Shorno/WebstormProjects/selfshop/backend/app/Models/VendorFollower.php)

Simple pivot model with `user_id` and `vendor_id`.

#### [MODIFY] [Vendor.php](file:///c:/Users/Shorno/WebstormProjects/selfshop/backend/app/Models/Vendor.php)

Add `followers()` relationship and append `followers_count` to the vendor data.

#### [MODIFY] [FrontendApiController.php](file:///c:/Users/Shorno/WebstormProjects/selfshop/backend/app/Http/Controllers/FrontendApiController.php)

Add 3 methods:
- `followVendor(vendor_id)` — POST, toggle follow (create or delete)
- `unfollowVendor(vendor_id)` — POST, remove follow
- `checkFollowStatus(vendor_id)` — GET, return `{is_following: bool}`

Also update [supplierDetails()](file:///c:/Users/Shorno/WebstormProjects/selfshop/backend/app/Http/Controllers/FrontendApiController.php#3305-3386) to include `followers_count`.

#### [MODIFY] [api.php](file:///c:/Users/Shorno/WebstormProjects/selfshop/backend/routes/api.php)

Add inside `auth:sanctum` middleware group:
```php
Route::post('/vendor/{id}/follow', ...);
Route::post('/vendor/{id}/unfollow', ...);
Route::get('/vendor/{id}/follow-status', ...);
```

#### Frontend

#### [MODIFY] [homeApi.ts](file:///c:/Users/Shorno/WebstormProjects/selfshop/Client/src/redux/features/home/homeApi.ts)

Add RTK Query endpoints:
- `followVendor` mutation
- `unfollowVendor` mutation  
- `getFollowStatus` query

#### [MODIFY] [baseApi.ts](file:///c:/Users/Shorno/WebstormProjects/selfshop/Client/src/redux/api/baseApi.ts)

Add `"vendorFollow"` tag type.

#### [MODIFY] [SupplierDetailsComponent.tsx](file:///c:/Users/Shorno/WebstormProjects/selfshop/Client/src/components/pages/supplier/SupplierDetailsComponent.tsx)

Replace the "Coming soon" tooltip Follow button with a working toggle:
- Logged in + active → shows "Follow" / "Following" with toggle behavior
- Not logged in → shows "Follow" but prompts to login on click
- Show follower count next to/below the button

---

## Verification Plan

### Manual Verification
1. Navigate to a supplier page (e.g. `app.selfshop.com.bd/supplier/{slug}`)
2. **Tabs**: Verify "All Products" and "Profile" tabs appear on the LEFT side, followed by "All" and category pills
3. **Rating**: Verify rating stars appear below the location line, not inline
4. **Follow (logged out)**: Click Follow → should prompt login
5. **Follow (logged in)**: Click Follow → button should change to "Following", click again → should toggle back to "Follow"
6. **Follow persistence**: Refresh page → follow state should persist
7. Check both mobile and desktop views

> [!IMPORTANT]
> The backend migration needs to be run (`php artisan migrate`) after the changes are deployed. Please confirm you're okay with me creating a new migration.
