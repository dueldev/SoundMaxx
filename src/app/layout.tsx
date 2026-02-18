import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono } from "next/font/google";
import { Header } from "@/components/ui/header-3";
import { env } from "@/lib/config";
import {
  BRAND_NAME,
  DEFAULT_SITE_DESCRIPTION,
  absoluteUrl,
  getRobotsPolicy,
  getSameAs,
  getSiteUrl,
} from "@/lib/seo";
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
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "SoundMaxx | Audio Tool Studio",
    template: `%s | ${BRAND_NAME}`,
  },
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  robots: getRobotsPolicy(),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getSiteUrl(),
    siteName: BRAND_NAME,
    title: "SoundMaxx | Audio Tool Studio",
    description: DEFAULT_SITE_DESCRIPTION,
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "SoundMaxx Audio Tool Studio",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "SoundMaxx | Audio Tool Studio",
    description: DEFAULT_SITE_DESCRIPTION,
    images: [absoluteUrl("/twitter-image")],
  },
  verification: env.GOOGLE_SITE_VERIFICATION
    ? {
        google: env.GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sameAs = getSameAs();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl("/favicon.ico"),
    description: DEFAULT_SITE_DESCRIPTION,
    ...(env.SEO_CONTACT_EMAIL
      ? {
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: env.SEO_CONTACT_EMAIL,
            },
          ],
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: getSiteUrl(),
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${chakraPetch.variable} ${ibmPlexMono.variable} bg-background text-foreground antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <Header />
        <main id="main-content" className="pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
