import type { Plan } from "@/types/database";

export const PLAN_LIMITS: Record<
  Plan,
  { brands: number; imagesPerDay: number; aiRequestsPerDay: number; features: string[] }
> = {
  trial: {
    brands: 1,
    imagesPerDay: 3,
    aiRequestsPerDay: 50,
    features: ["all"],
  },
  starter: {
    brands: 1,
    imagesPerDay: 10,
    aiRequestsPerDay: 200,
    features: ["basic_automations"],
  },
  pro: {
    brands: 3,
    imagesPerDay: 50,
    aiRequestsPerDay: 1000,
    features: ["all_automations", "priority_support"],
  },
  agency: {
    brands: 999,
    imagesPerDay: 200,
    aiRequestsPerDay: 5000,
    features: ["white_label", "api_access"],
  },
};

export const PLAN_PRICES: Record<Plan, { monthly: number; label: string }> = {
  trial: { monthly: 0, label: "Ücretsiz Deneme" },
  starter: { monthly: 29, label: "Starter" },
  pro: { monthly: 79, label: "Pro" },
  agency: { monthly: 199, label: "Agency" },
};

export function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
