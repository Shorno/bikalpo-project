import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export default async function ApplyBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
