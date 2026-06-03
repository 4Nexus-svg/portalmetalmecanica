import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { BannerSlot } from "@/components/ui/BannerSlot";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Portal Metalmecânica",
    template: "%s | Portal Metalmecânica",
  },
  description: "O portal de referência para profissionais do setor metalmecânico nos estados do ES e MG.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased flex flex-col min-h-screen">
        <Header />
        <div className="h-[190px] shrink-0" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 w-full">
          <BannerSlot position="top" className="mb-4" />
        </div>
        <div className="flex-1">{children}</div>
        <Footer />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}