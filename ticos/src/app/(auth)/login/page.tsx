"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema, type LoginInput } from "@/lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data: LoginInput = {
      email: form.get("email") as string,
      password: form.get("password") as string,
    };

    const result = loginSchema.safeParse(data);
    if (!result.success) {
      setError(result.error.errors[0].message);
      setLoading(false);
      return;
    }

    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (res?.error) {
      setError("E-posta veya şifre hatalı");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">TicOS</h1>
          <p className="text-sm text-muted-foreground">
            Hesabınıza giriş yapın
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Hesabınız yok mu?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Kayıt Ol
          </Link>
        </p>
      </div>
    </div>
  );
}
