import { Inter, Playfair_Display } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TRPCProvider } from "@/lib/trpc/provider";
import { isClerkEnabled } from "@/lib/auth/config";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "tr" | "en")) {
    notFound();
  }

  const messages = await getMessages();

  const content = (
    <NextIntlClientProvider messages={messages}>
      <TRPCProvider>{children}</TRPCProvider>
    </NextIntlClientProvider>
  );

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        {isClerkEnabled() ? (
          <ClerkProvider
            signInFallbackRedirectUrl="/tr/dashboard"
            signUpFallbackRedirectUrl="/tr/onboarding"
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
