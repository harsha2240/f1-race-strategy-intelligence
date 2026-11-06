import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Race Intelligence | F1 Strategy Lab",
  description: "Race performance and strategy analytics dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
