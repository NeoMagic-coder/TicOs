import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface p-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Ticosclaw</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Ücretsiz hesabınızı oluşturun
        </p>
      </div>
      <SignUp
        routing="path"
        path={`/${locale}/sign-up`}
        signInUrl={`/${locale}/sign-in`}
        forceRedirectUrl={`/${locale}/onboarding`}
      />
    </div>
  );
}
