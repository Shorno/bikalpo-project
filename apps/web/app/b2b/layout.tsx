import { B2bNavbar } from "@/components/features/landing/b2b/b2b-navbar";
import { B2bFooter } from "@/components/features/landing/b2b/b2b-footer";

export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <B2bNavbar />
      <main className="flex-1">{children}</main>
      <B2bFooter />
    </div>
  );
}
