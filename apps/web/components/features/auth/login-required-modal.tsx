"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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

  const showLoginModal = useCallback(() => setIsOpen(true), []);
  const hideLoginModal = useCallback(() => setIsOpen(false), []);

  return (
    <LoginRequiredContext.Provider value={{ showLoginModal, hideLoginModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={hideLoginModal} />
    </LoginRequiredContext.Provider>
  );
}
