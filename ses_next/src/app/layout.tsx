import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "SES業務管理",
  description: "SES業務管理アプリ（日報・案件・給与・勤怠）",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SES業務管理",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;var f=localStorage.getItem('font');if(f)document.documentElement.dataset.font=f;}catch(e){}})()",
          }}
        />
      </head>
      <body className="antialiased">
        <main className="mx-auto min-h-screen w-full max-w-xl safe-bottom">
          {children}
        </main>
        <BottomNav />
        <PWARegister />
      </body>
    </html>
  );
}
