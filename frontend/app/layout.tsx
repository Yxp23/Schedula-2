import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StudentProvider } from "@/components/StudentProvider";
import GlobalChat from "@/components/GlobalChat";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Schedula | AI Course Planning for Penn State",
  description: "Replace the broken registration system with intelligent, student-first course planning. Search every Penn State course, see professor ratings, build conflict-free schedules, and export to Google Calendar.",
  keywords: ["Penn State", "course planning", "schedule builder", "LionPATH", "professor ratings", "PSU"],
  authors: [{ name: "Schedula Team" }],
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-black/10 dark:selection:bg-white/20`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StudentProvider>
            {children}
            <GlobalChat />
          </StudentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
