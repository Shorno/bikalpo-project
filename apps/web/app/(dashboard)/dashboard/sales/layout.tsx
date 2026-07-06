import { notFound } from "next/navigation";

export default async function SalesDashboardLayout({
  children: _children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  notFound();
}
