import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { announcementRouter } from "./announcement";
import { auditRouter } from "./audit";
import { brandRouter } from "./brand";
import { categoryRouter } from "./category";
import { customerManagementRouter } from "./customer-management";
import { dashboardRouter } from "./dashboard";
import { deliverymanRouter } from "./deliveryman";
import { employeeRouter } from "./employee";
import { productRouter } from "./product";
import { customerRouter } from "./customer";
import { returnsRouter } from "./returns";
import { salesmanRouter } from "./salesman";
import { userRouter } from "./user";
import { verifiedUserRouter } from "./verified-user";

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
  brand: brandRouter,
  category: categoryRouter,
  customerManagement: customerManagementRouter,
  announcement: announcementRouter,
  employee: employeeRouter,
  product: productRouter,
  customer: customerRouter,
  salesman: salesmanRouter,
  deliveryman: deliverymanRouter,
  returns: returnsRouter,
  dashboard: dashboardRouter,
  user: userRouter,
  verifiedUser: verifiedUserRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
