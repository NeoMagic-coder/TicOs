import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <span className="text-xl font-bold text-primary">TicOS</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              Giriş Yap
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Ücretsiz Dene
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            E-Ticaretiniz İçin Tek{" "}
            <span className="text-primary">İşletim Sistemi</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Trendyol, Hepsiburada ve kendi mağazanızdaki tüm siparişleri,
            stokları ve müşterileri tek panelden yönetin.
          </p>
        </section>
      </main>
    </div>
  );
}
