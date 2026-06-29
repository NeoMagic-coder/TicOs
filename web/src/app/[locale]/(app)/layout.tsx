import { UserSync } from "@/components/auth/user-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      {children}
    </>
  );
}
