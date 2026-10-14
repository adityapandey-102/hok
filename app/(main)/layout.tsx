import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "../../components/ui/Toast";
import { ConfirmProvider } from "../../components/ui/ConfirmDialog";
import "../globals.css";

// Plus Jakarta Sans: the working face -- open, high-legibility letterforms and
// clear figures at small sizes (labels, tables, forms, all numbers).
const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Playfair Display: the couture display face for titles and names -- sturdier
// strokes than a Didone, so headings stay crisp on every screen.
const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HOK · House of Khalak",
  description: "House of Khalak agency workspace: clients, shoots, assets and team tasks.",
};

/**
 * Root layout #2 of 2 (see docs/ARCHITECTURE.md §11): the staff app, sign-in
 * pages and client portal, on needleye's design system. The public portfolio
 * has its own root layout in app/(site) so its template CSS never meets
 * Tailwind.
 */
export default function MainRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[14px] leading-relaxed">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
