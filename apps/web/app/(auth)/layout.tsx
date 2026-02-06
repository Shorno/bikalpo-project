import { Navbar } from "@/components/layout/navbar";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <div className="flex pt-20 items-center justify-center bg-[#FAF6F6] p-4 md:p-12">
        {children}
      </div>
    </>
  );
}
