import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Maitri — Emergency Response Operations",
  description:
    "Government-grade dashboard for the Maitri women safety network. Real-time SOS, station coordination, officer dispatch.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#07090f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="grain min-h-screen antialiased">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(20,28,48,0.85)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e7ecf3",
            },
          }}
        />
      </body>
    </html>
  );
}
