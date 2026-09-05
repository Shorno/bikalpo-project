import { B2bFooter } from "@/components/features/landing/b2b/b2b-footer";
import { PublicHeader } from "@/components/layout/public-header";

export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <B2bFooter />
    </div>
  );
}
