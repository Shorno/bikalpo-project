import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { adminOfferRouter } from "./admin-offer";
import { adminProductTypeRouter } from "./admin-product-type";
import { adminEmployeeReportRouter } from "./admin-employee-report";
import { adminBrandUpdateRouter } from "./admin-brand-update";
import { adminAnnouncementRouter } from "./admin-announcement";
import { adminCustomerHomeTabRouter } from "./admin-customer-home-tab";
import { adminEstimateRouter } from "./admin-estimate";
import { adminInvoiceRouter } from "./admin-invoice";
import { adminItemRequestRouter } from "./admin-item-request";
import { adminOrderRouter } from "./admin-order";
import { adminProductVariantRouter } from "./admin-product-variant";
import { adminSalesReportRouter } from "./admin-sales-report";
import { adminSubcategoryRouter } from "./admin-subcategory";
import { adminTicketRouter } from "./admin-ticket";
import { auditRouter } from "./audit";
import { brandRouter } from "./brand";
import { categoryRouter } from "./category";
import { cloudinaryRouter } from "./cloudinary";
import { customerManagementRouter } from "./customer-management";
import { dashboardRouter } from "./dashboard";
import { deliverymanRouter } from "./deliveryman";
import { employeeRouter } from "./employee";
import { productRouter } from "./product";
import { customerRouter } from "./customer";
import { returnsRouter } from "./returns";
import { salesmanRouter } from "./salesman";
import { inventoryRouter } from "./inventory";

import { verifiedUserRouter } from "./verified-user";
import { sellerApplicationRouter } from "./seller-application";
import { shopOwnerRouter } from "./shop-owner";
import { warehouseApplicationRouter } from "./warehouse-application";
import { warehouseRouter } from "./warehouse";
import { adminLandingRouter } from "./admin-landing";
import { landingRouter } from "./landing";
import { adminWarehouseAssignmentRouter } from "./admin-warehouse-assignment";
import { adminToLetRouter, toLetRouter } from "./tolet";

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
  adminOffer: adminOfferRouter,
  adminProductType: adminProductTypeRouter,
  adminEmployeeReport: adminEmployeeReportRouter,
  adminBrandUpdate: adminBrandUpdateRouter,
  adminAnnouncement: adminAnnouncementRouter,
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
  dashboard: dashboardRouter,

  verifiedUser: verifiedUserRouter,
  sellerApplication: sellerApplicationRouter,
  shopOwner: shopOwnerRouter,
  warehouseApplication: warehouseApplicationRouter,
  warehouse: warehouseRouter,
  adminLanding: adminLandingRouter,
  landing: landingRouter,
  toLet: toLetRouter,
  adminToLet: adminToLetRouter,
  adminWarehouseAssignment: adminWarehouseAssignmentRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
