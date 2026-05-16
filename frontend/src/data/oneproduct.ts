import type { OnboardedProduct, ProductReview, Influencer, GrowthExperiment, EmailFlow } from '@/types';

// Cleared: no product is onboarded by default. Users go through onboarding
// and persist via the backend DB.
export const seedOnboardedProduct: OnboardedProduct | null = null;

// Brand identity is now generated on-demand by the Brand Identity Agent and
// stored in useStore.brandIdentity — no static seed.

// All per-product data starts empty. Real entries arrive after the user
// onboards a product and the agents/integrations populate them.
export const seedReviews: ProductReview[] = [];
export const seedInfluencers: Influencer[] = [];
export const seedExperiments: GrowthExperiment[] = [];
export const seedEmailFlows: EmailFlow[] = [];
