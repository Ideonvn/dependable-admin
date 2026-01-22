import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import AuthInitializer from "@/components/AuthInitializer";
import { auth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dependable Admin",
  description: "Admin interface for Dependable school management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-[#0F1115]`}
      >
        <SessionProvider>
          <AuthInitializer>
            <ThemeProvider 
              attribute="class" 
              defaultTheme="system" 
              enableSystem 
              disableTransitionOnChange
              themes={['light', 'dark']}
            >
              <div className="min-h-screen flex flex-col">
                {session?.user && <AppHeader user={session.user} />}
                {children}
              </div>
            </ThemeProvider>
          </AuthInitializer>
        </SessionProvider>
      </body>
    </html>
  );
}
