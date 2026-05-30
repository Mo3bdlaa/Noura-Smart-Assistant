"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { LocaleProvider, type Locale } from "@/components/i18n";

/** App-wide client providers (locale + toasts + confirm dialogs). */
export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <LocaleProvider locale={locale}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
