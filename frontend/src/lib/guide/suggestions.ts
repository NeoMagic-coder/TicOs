import type { GuideStep } from './guideSteps';

export type GuideSuggestion = {
  id: string;
  label: string;
  speech: string;
  page?: string;
  priority: number;
};

type StoreSlice = {
  approvals?: Array<{ status?: string }>;
  brandIdentity?: { brand_name?: string } | null;
  integrationStatus?: Record<string, any> | null;
  dashboard?: { today_orders?: number; pending_approvals?: number } | null;
  onboardedProduct?: { product_name?: string } | null;
};

/** Mağaza durumuna göre canlı öneriler. */
export function buildContextSuggestions(store: StoreSlice): GuideSuggestion[] {
  const out: GuideSuggestion[] = [];
  const pendingApprovals = (store.approvals || []).filter(
    (a) => a.status === 'pending' || a.status === 'estimating',
  ).length;
  const dashPending = store.dashboard?.pending_approvals ?? 0;
  const approvalCount = Math.max(pendingApprovals, dashPending);
  const inv = store.integrationStatus?.modules?.inventory;
  const inventoryLinked = inv?.link?.synced === true;

  if (approvalCount > 0) {
    out.push({
      id: 'pending-approvals',
      label: `${approvalCount} onay bekliyor`,
      speech: `${approvalCount} iş onay bekliyor. Onaylar sayfasına bakmanı öneririm.`,
      page: 'approvals',
      priority: 85,
    });
  }

  const todayOrders = store.dashboard?.today_orders ?? 0;
  if (todayOrders > 0) {
    out.push({
      id: 'check-orders',
      label: `Bugün ${todayOrders} sipariş — kontrol et`,
      speech: `Bugün ${todayOrders} sipariş var. Siparişler sayfasına bakmanı öneririm.`,
      page: 'tic_orders',
      priority: 80,
    });
  }

  if (!inventoryLinked) {
    out.push({
      id: 'link-inventory',
      label: 'Envanteri bağla',
      speech: 'Envanter henüz bağlı değil. Bağlantılar sayfasından veya ürünlerden bağlayabilirsiniz.',
      page: 'integrations',
      priority: 70,
    });
  }

  if (!store.brandIdentity?.brand_name) {
    out.push({
      id: 'create-brand',
      label: 'Markanı oluştur',
      speech: 'Marka kimliği henüz oluşmadı. Marka sayfasından oluşturabilirsiniz.',
      page: 'brand',
      priority: 60,
    });
  }

  out.push({
    id: 'ask-today',
    label: 'Bugün ne yapmalım?',
    speech: 'Soru Sor sekmesine geçip Bugün ne yapmalım yazabilirsiniz.',
    page: 'supervisor',
    priority: 40,
  });

  out.push({
    id: 'explore-features',
    label: 'Tüm özelliklere bak',
    speech: 'Ana sayfada tüm ekranlar listelenir.',
    page: 'dashboard',
    priority: 30,
  });

  return out.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

export function suggestionForStep(step: GuideStep | undefined): GuideSuggestion | null {
  if (!step?.tip) return null;
  return {
    id: `step-${step.id}`,
    label: step.tip,
    speech: step.tip,
    priority: 50,
  };
}
