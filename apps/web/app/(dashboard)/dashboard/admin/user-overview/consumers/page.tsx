import { ConsumersListClient } from "./consumers-list-client";

export const metadata = {
  title: "Consumers | Admin",
  description: "Registered consumer accounts and order activity",
};

export default function ConsumersPage() {
  return <ConsumersListClient />;
}
