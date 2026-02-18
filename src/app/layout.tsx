import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import { Header } from "@/components/ui/header-3";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SoundMaxx | Audio Tool Studio",
  description:
    "Command-deck audio workflows for stem isolation, mastering, key/BPM detection, loudness analysis, and MIDI extraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${chakraPetch.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased`}>
        <Header />
        <main id="main-content" className="pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
