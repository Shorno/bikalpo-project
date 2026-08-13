import { ORPCError } from "@orpc/client";
import { getPublicOrpcClient } from "@/lib/orpc/public-server";

function isNotFoundError(error: unknown) {
  return (
    error instanceof ORPCError &&
    (error.code === "NOT_FOUND" || error.status === 404)
  );
}

export interface ProductListFilters {
  category?: string;
  subcategory?: string;
  brand?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface ProductPaginationData {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export async function getVerifiedUsersForHome(revalidate = 1800) {
  const client = getPublicOrpcClient(revalidate);
  try {
    const result = await client.verifiedUser.getForHome();
    return result.users ?? [];
  } catch {
    return [];
  }
}

export async function getVerifiedUsersCount(revalidate = 1800) {
  const client = getPublicOrpcClient(revalidate);
  try {
    const result = await client.customer.getVerifiedUsersCount();
    return result.count ?? 0;
  } catch {
    return 0;
  }
}

export async function getVerifiedUsers(
  params?: {
    search?: string;
    area?: string;
    sortBy?: "top_buyers" | "most_orders" | "newest";
    page?: number;
    limit?: number;
  },
  revalidate = 1800,
) {
  const client = getPublicOrpcClient(revalidate);
  try {
    return await client.customer.getVerifiedUsers(params ?? {});
  } catch {
    return {
      users: [],
      areas: [],
      totalPages: 1,
      currentPage: 1,
      totalCount: 0,
    };
  }
}

export async function getCategoryBySlug(slug: string, revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);

  try {
    const result = await client.customer.getCategoryBySlug({ slug });
    return result.category;
  } catch {
    return null;
  }
}

export async function getActiveCategories(revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getActiveCategories();
  return result.categories ?? [];
}

export async function getActiveBrands(revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getActiveBrands();
  return result.brands ?? [];
}

export async function getActiveOffers(limit = 4, revalidate = 60) {
  const client = getPublicOrpcClient(revalidate);

  try {
    const result = await client.customer.getActiveOffers({ limit });
    return result.offers ?? [];
  } catch {
    return [];
  }
}

export async function getCategoriesWithProducts(limit = 8, revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getCategoriesWithProducts({ limit });
  return result.categories ?? [];
}

export async function getSubcategoriesByCategory(
  slug: string,
  revalidate = 600,
) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getSubcategoriesByCategory({ slug });
  return result.subcategories ?? [];
}

export async function getToLetListings(revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.toLet.getAll();
  return result ?? [];
}

export async function getToLetById(id: number, revalidate = 600) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.toLet.getById({ id });
  return result ?? null;
}

export async function listPublicToLetUnitListings(revalidate = 0) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.toLetUnitListing.listPublic();
  return result.listings ?? [];
}

export async function getPublicToLetUnitListingByCode(
  listingCode: string,
  revalidate = 0,
) {
  const client = getPublicOrpcClient(revalidate);

  try {
    const result = await client.toLetUnitListing.getPublicByCode({
      listingCode,
    });
    return result.listing ?? null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function getToLetQrProperty(qrToken: string, revalidate = 0) {
  const client = getPublicOrpcClient(revalidate);

  try {
    return await client.toLetUnitListing.getQrProperty({ qrToken });
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function getToLetQrUnitListingByCode(
  qrToken: string,
  listingCode: string,
  revalidate = 0,
) {
  const client = getPublicOrpcClient(revalidate);

  try {
    const result = await client.toLetUnitListing.getQrListingByCode({
      qrToken,
      listingCode,
    });
    return result.listing ?? null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function getProductBySlug(slug: string, revalidate = 30) {
  const client = getPublicOrpcClient(revalidate);

  try {
    return await client.customer.getProductDetails({ slug });
  } catch {
    return null;
  }
}

export async function getRetailerProductBySlug(
  shopSlug: string,
  productSlug: string,
  revalidate = 0,
) {
  const client = getPublicOrpcClient(revalidate);

  try {
    return await client.customer.getShopBySlug({
      slug: shopSlug,
      productSlug,
      sort: "recommended",
      page: 1,
      limit: 1,
    });
  } catch {
    return null;
  }
}

export async function getStoreProductDetail(
  shopSlug: string,
  productSlug: string,
  revalidate = 0,
) {
  const client = getPublicOrpcClient(revalidate);

  try {
    return await client.customer.getStoreProductDetail({
      shopSlug,
      productSlug,
    });
  } catch {
    return null;
  }
}

export async function getStoreCatalog(
  shopSlug: string,
  options: {
    category?: string;
    productSlug?: string;
    page?: number;
    limit?: number;
  } = {},
  revalidate = 0,
) {
  const client = getPublicOrpcClient(revalidate);

  try {
    return await client.customer.getShopBySlug({
      slug: shopSlug,
      category: options.category,
      productSlug: options.productSlug,
      sort: "recommended",
      page: options.page ?? 1,
      limit: options.limit ?? 8,
    });
  } catch {
    return null;
  }
}

export async function getProductsWithQuery(
  filters: ProductListFilters,
  revalidate = 60,
) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getCustomerProducts(filters);

  return {
    products: result.products ?? [],
    pagination: result.pagination as ProductPaginationData,
  };
}

export async function getReferenceProductsWithQuery(
  filters: ProductListFilters,
  revalidate = 60,
) {
  const client = getPublicOrpcClient(revalidate);
  const result = await client.customer.getReferenceProducts(filters);

  return {
    products: result.products ?? [],
    pagination: result.pagination as ProductPaginationData,
  };
}
