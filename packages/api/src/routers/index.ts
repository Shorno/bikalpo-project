import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { adminAnnouncementRouter } from "./admin-announcement";
import { adminApplicationRouter } from "./admin-application";
import { adminAreaRouter } from "./admin-area";
import { adminAreaAnalyticsRouter } from "./admin-area-analytics";
import { adminAssistedInviteRouter } from "./admin-assisted-invite";
import { adminBrandUpdateRouter } from "./admin-brand-update";
import { adminComplaintRouter } from "./admin-complaint";
import { adminCoreProductRouter } from "./admin-core-product";
import { adminCustomerHomeTabRouter } from "./admin-customer-home-tab";
import { adminEmployeeReportRouter } from "./admin-employee-report";
import { adminEstimateRouter } from "./admin-estimate";
import { adminInviteTrackingRouter } from "./admin-invite-tracking";
import { adminInvoiceRouter } from "./admin-invoice";
import { adminItemRequestRouter } from "./admin-item-request";
import { adminLandingRouter } from "./admin-landing";
import { adminMarketingRouter } from "./admin-marketing";
import { adminOfferRouter } from "./admin-offer";
import { adminOrderRouter } from "./admin-order";
import { adminProductConfigRouter } from "./admin-product-config";
import { adminProductTypeRouter } from "./admin-product-type";
import { adminProductVariantRouter } from "./admin-product-variant";
import { adminRewardRouter } from "./admin-reward";
import { adminSalesReportRouter } from "./admin-sales-report";
import { adminSellerAreaRouter } from "./admin-seller-area";
import { adminShopCategoryAssignmentRouter } from "./admin-shop-category-assignment";
import { adminSubcategoryRouter } from "./admin-subcategory";
import { adminTicketRouter } from "./admin-ticket";
import { adminUserManagementRouter } from "./admin-user-management";
import { adminVariantOptionRouter } from "./admin-variant-option";
import { adminWarehouseAssignmentRouter } from "./admin-warehouse-assignment";
import { auditRouter } from "./audit";
import { balanceSheetRouter } from "./balance-sheet";
import { barikoiRouter } from "./barikoi";
import { brandRouter } from "./brand";
import {
  adminCatalogApprovalRouter,
  catalogRequestRouter,
} from "./catalog-approval-request";
import { categoryRouter } from "./category";
import { cloudinaryRouter } from "./cloudinary";
import { customerRouter } from "./customer";
import { customerManagementRouter } from "./customer-management";
import { dashboardRouter } from "./dashboard";
import { deliverymanRouter } from "./deliveryman";
import { devOtpRouter } from "./dev-otp";
import { employeeRouter } from "./employee";
import { expenseRouter } from "./expense";
import { financeRouter } from "./finance";
import { inventoryRouter } from "./inventory";
import { landingRouter } from "./landing";
import { marketingRouter } from "./marketing";
import { payeeRouter } from "./payee";
import { productRouter } from "./product";
import { profitLossRouter } from "./profit-loss";
import { purchaseRouter } from "./purchase";
import { retailerPosRouter } from "./retailer-pos";
import { returnsRouter } from "./returns";
import { salesmanRouter } from "./salesman";
import { sellerApplicationRouter } from "./seller-application";
import { shopOwnerRouter } from "./shop-owner";
import { stockAdjustmentRouter } from "./stock-adjustment";
import { stockOverviewRouter } from "./stock-overview";
import { supplierPaymentRouter } from "./supplier-payment";
import { adminToLetRouter, toLetRouter } from "./tolet";
import { toLetBookingRouter } from "./tolet-booking";
import { toLetPropertyRouter } from "./tolet-property";
import { toLetRentalRouter } from "./tolet-rental";
import { toLetUnitListingRouter } from "./tolet-unit-listing";
import { userComplaintRouter } from "./user-complaint";
import { userInviteRouter } from "./user-invite";
import { userTicketRouter } from "./user-ticket";
import { verifiedUserRouter } from "./verified-user";
import { warehouseRouter } from "./warehouse";
import { warehouseApplicationRouter } from "./warehouse-application";
import { warehouseDeliveryRouter } from "./warehouse-delivery";
import { warehouseEmployeeRouter } from "./warehouse-employee";
import { warehouseEstimateRouter } from "./warehouse-estimate";
import { warehousePosRouter } from "./warehouse-pos";
import { warehouseSalesRouter } from "./warehouse-sales";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  audit: auditRouter,
  adminCoreProduct: adminCoreProductRouter,
  adminProductConfig: adminProductConfigRouter,
  adminOffer: adminOfferRouter,
  adminProductType: adminProductTypeRouter,
  adminVariantOption: adminVariantOptionRouter,
  adminEmployeeReport: adminEmployeeReportRouter,
  adminBrandUpdate: adminBrandUpdateRouter,
  adminAnnouncement: adminAnnouncementRouter,
  adminApplication: adminApplicationRouter,
  adminCustomerHomeTab: adminCustomerHomeTabRouter,
  adminEstimate: adminEstimateRouter,
  adminInvoice: adminInvoiceRouter,
  adminItemRequest: adminItemRequestRouter,
  adminOrder: adminOrderRouter,
  adminProductVariant: adminProductVariantRouter,
  adminSalesReport: adminSalesReportRouter,
  adminSubcategory: adminSubcategoryRouter,
  adminTicket: adminTicketRouter,
  brand: brandRouter,
  category: categoryRouter,
  cloudinary: cloudinaryRouter,
  customerManagement: customerManagementRouter,

  employee: employeeRouter,
  inventory: inventoryRouter,
  product: productRouter,
  customer: customerRouter,
  salesman: salesmanRouter,
  deliveryman: deliverymanRouter,
  returns: returnsRouter,
  retailerPos: retailerPosRouter,
  dashboard: dashboardRouter,

  verifiedUser: verifiedUserRouter,
  sellerApplication: sellerApplicationRouter,
  shopOwner: shopOwnerRouter,
  warehouseApplication: warehouseApplicationRouter,
  warehouse: warehouseRouter,
  adminLanding: adminLandingRouter,
  landing: landingRouter,
  toLet: toLetRouter,
  toLetBooking: toLetBookingRouter,
  toLetProperty: toLetPropertyRouter,
  toLetRental: toLetRentalRouter,
  toLetUnitListing: toLetUnitListingRouter,
  adminToLet: adminToLetRouter,
  adminWarehouseAssignment: adminWarehouseAssignmentRouter,
  adminShopCategoryAssignment: adminShopCategoryAssignmentRouter,
  adminArea: adminAreaRouter,
  adminSellerArea: adminSellerAreaRouter,
  adminAreaAnalytics: adminAreaAnalyticsRouter,
  barikoi: barikoiRouter,
  devOtp: devOtpRouter,
  payee: payeeRouter,
  expense: expenseRouter,
  finance: financeRouter,
  supplierPayment: supplierPaymentRouter,
  balanceSheet: balanceSheetRouter,
  profitLoss: profitLossRouter,
  purchase: purchaseRouter,
  stockOverview: stockOverviewRouter,
  adminInviteTracking: adminInviteTrackingRouter,
  adminAssistedInvite: adminAssistedInviteRouter,
  adminReward: adminRewardRouter,
  userInvite: userInviteRouter,
  adminUserManagement: adminUserManagementRouter,
  adminMarketing: adminMarketingRouter,
  marketing: marketingRouter,
  userTicket: userTicketRouter,
  userComplaint: userComplaintRouter,
  adminComplaint: adminComplaintRouter,
  warehouseEmployee: warehouseEmployeeRouter,
  warehouseEstimate: warehouseEstimateRouter,
  warehouseDelivery: warehouseDeliveryRouter,
  stockAdjustment: stockAdjustmentRouter,
  warehousePos: warehousePosRouter,
  warehouseSales: warehouseSalesRouter,
  catalogRequest: catalogRequestRouter,
  adminCatalogApproval: adminCatalogApprovalRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
