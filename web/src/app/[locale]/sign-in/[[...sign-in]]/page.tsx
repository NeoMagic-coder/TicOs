import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
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
          AI pazarlama ekibinize giriş yapın
        </p>
      </div>
      <SignIn
        routing="path"
        path={`/${locale}/sign-in`}
        signUpUrl={`/${locale}/sign-up`}
        forceRedirectUrl={`/${locale}/dashboard`}
      />
    </div>
  );
}
