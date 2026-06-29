import { AppShell } from "@/components/layout/app-shell";
import { BillingView } from "@/components/billing/billing-view";
import { GoalsView } from "@/components/goals/goals-view";

export default function GoalsPage() {
  return (
    <AppShell>
      <BillingView />
      <GoalsView />
    </AppShell>
  );
}
