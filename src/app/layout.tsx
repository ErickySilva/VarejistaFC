import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Uma família só. As formas arredondadas e firmes da Rubik conversam com o
// letreiro do logo, e os pesos altos sustentam os números das estatísticas.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Varejista FC", template: "%s · Varejista FC" },
  description: "Estatísticas do Varejista FC no EA FC Pro Clubs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#131a40",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${rubik.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
