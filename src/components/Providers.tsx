"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";

/** App-wide client providers (toasts + confirm dialogs). */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
