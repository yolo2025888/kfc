import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import NextTopLoader from 'nextjs-toploader';
import RealtimeProvider from "@/components/RealtimeProvider";
import { GlobalProvider } from "@/lib/context/GlobalContext";
import { GoogleAnalytics } from '@next/third-parties/google'


export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_PRODUCTNAME || "肯德基素人分发",
  description: "肯德基素人分发管理系统",
  icons: {
    icon: '/icon.svg',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let theme = process.env.NEXT_PUBLIC_THEME
  if(!theme) {
    theme = "theme-sass3"
  }
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  return (
    <html lang="en">
    <body className={theme}>
      <NextTopLoader 
        color="#e11d48"
        initialPosition={0.08}
        crawlSpeed={200}
        height={3}
        crawl={true}
        showSpinner={false}
        easing="ease"
        speed={200}
        shadow="0 0 10px #e11d48,0 0 5px #e11d48"
        zIndex={1600}
      />
      <GlobalProvider>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </GlobalProvider>
      <Toaster />
      { gaID && (
          <GoogleAnalytics gaId={gaID}/>
      )}
    </body>
    </html>
  );
}
