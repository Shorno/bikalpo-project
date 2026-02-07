import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { announcementRouter } from "./announcement";
import { authRouter } from "./auth";
import { brandRouter } from "./brand";
import { categoryRouter } from "./category";
import { customerRouter } from "./customer";
import { dashboardRouter } from "./dashboard";
import { deliverymanRouter } from "./deliveryman";
import { employeeRouter } from "./employee";
import { salesmanRouter } from "./salesman";
import { userRouter } from "./user";

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
  auth: authRouter,
  brand: brandRouter,
  category: categoryRouter,
  customer: customerRouter,
  announcement: announcementRouter,
  employee: employeeRouter,
  salesman: salesmanRouter,
  deliveryman: deliverymanRouter,
  dashboard: dashboardRouter,
  user: userRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

