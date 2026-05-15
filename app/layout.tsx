import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Navbar from "./components/Navbar";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Lacar Sports",
  description: "Revive tu partido en el Lago Lacar — busca, etiqueta y descarga tus mejores jugadas",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-lake-950">

        <Navbar />

        <div className="flex-1 pt-[72px]">{children}</div>

      </body>
    </html>
  );
}
