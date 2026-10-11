import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pawprint Lab — Made to belong",
  description: "Create a visual pet twin, calibrate fit, save designs, and customize products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
