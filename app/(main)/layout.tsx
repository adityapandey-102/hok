import type { Metadata } from "next";
import { Jost, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "../../components/ui/Toast";
import { ConfirmProvider } from "../../components/ui/ConfirmDialog";
import { THEME_INIT_SCRIPT } from "../../lib/theme";
import "../globals.css";

// Jost (headings): a geometric face in the Futura family, like the logo's
// "HOUSE OF KHALAK" lettering. Plus Jakarta Sans (text): open, very legible,
// clear figures at small sizes (tables, forms, every number).
const display = Jost({ variable: "--font-display", subsets: ["latin"] });
const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HOK · House of Khalak",
  description: "House of Khalak agency workspace: clients, shoots, assets and team tasks.",
};

/**
 * Root layout #2 of 2 (see docs/ARCHITECTURE.md §11): the staff app, sign-in
 * pages and client portal, on HOK's design system (app/globals.css). The
 * public portfolio has its own root layout in app/(site) so its template CSS
 * never meets Tailwind. The inline script applies the saved theme before the
 * first paint, so a dark-mode user never sees a white flash.
 */
export default function MainRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans text-[14px] leading-relaxed">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
