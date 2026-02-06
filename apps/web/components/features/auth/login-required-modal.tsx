"use client";

import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoginRequiredContextType {
  showLoginModal: () => void;
  hideLoginModal: () => void;
}

const LoginRequiredContext = createContext<
  LoginRequiredContextType | undefined
>(undefined);

export function LoginRequiredProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const showLoginModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const hideLoginModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <LoginRequiredContext.Provider value={{ showLoginModal, hideLoginModal }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl font-semibold text-center">
              Login Required
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600">
              Please login or create an account to add items to your cart and
              place orders.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-6">
            <Button asChild size="lg" className="w-full">
              <Link href="/login" onClick={() => setIsOpen(false)}>
                <LogIn className="mr-2 h-4 w-4" />
                Login to Your Account
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/sign-up" onClick={() => setIsOpen(false)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create New Account
              </Link>
            </Button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            Join our B2B platform to access exclusive wholesale pricing and
            features.
          </p>
        </DialogContent>
      </Dialog>
    </LoginRequiredContext.Provider>
  );
}

export function useLoginRequired() {
  const context = useContext(LoginRequiredContext);
  if (context === undefined) {
    throw new Error(
      "useLoginRequired must be used within a LoginRequiredProvider",
    );
  }
  return context;
}
