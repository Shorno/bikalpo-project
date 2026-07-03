"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AuthModal } from "./auth-modal";

/* ─────────────────── Context ─────────────────── */

interface LoginRequiredContextType {
  showLoginModal: () => void;
  hideLoginModal: () => void;
}

const LoginRequiredContext = createContext<
  LoginRequiredContextType | undefined
>(undefined);

export function useLoginRequired() {
  const context = useContext(LoginRequiredContext);
  if (context === undefined) {
    throw new Error(
      "useLoginRequired must be used within a LoginRequiredProvider",
    );
  }
  return context;
}

/* ─────────────────── Provider ─────────────────── */

export function LoginRequiredProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isLoginPage = pathname === "/login" || pathname === "/b2b/login";

  const showLoginModal = useCallback(() => {
    if (isLoginPage) {
      return;
    }

    setIsOpen(true);
  }, [isLoginPage]);
  const hideLoginModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (isLoginPage) {
      setIsOpen(false);
    }
  }, [isLoginPage]);

  return (
    <LoginRequiredContext.Provider value={{ showLoginModal, hideLoginModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={hideLoginModal} />
    </LoginRequiredContext.Provider>
  );
}
