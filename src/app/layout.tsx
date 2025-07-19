import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { AppClientWrapper } from "../components/AppClientWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tacto - Tactical Tic Tac Toe",
  description: "Every square is a battle. Play tactical Tic Tac Toe with Attack, Defend, and Conquer mechanics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Handle Cloudflare cookie errors gracefully
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('__cf_bm')) {
                  console.warn('Cloudflare bot management cookie error detected - this is usually harmless in development');
                  e.preventDefault();
                }
              });
              
              // Override console.error for cookie-related errors
              const originalError = console.error;
              console.error = function(...args) {
                if (args[0] && typeof args[0] === 'string' && args[0].includes('__cf_bm')) {
                  console.warn('Cloudflare cookie warning:', ...args);
                  return;
                }
                originalError.apply(console, args);
              };
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AppClientWrapper>{children}</AppClientWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
