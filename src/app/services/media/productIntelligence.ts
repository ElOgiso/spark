// ── Product Promotion Intelligence ────────────────────────────────────
// Handles e-commerce promotion strategies and placement injections.
// Singleton – obtain via ProductIntelligence.getInstance().

import { ProductDetails, ProductUrlIntelligence } from './productUrlIntelligence';

export interface PromotionPlacement {
  shouldAppear: boolean;
  position: 'Beginning' | 'Middle' | 'End' | 'Overlay' | 'Voice' | 'CTA';
  visualAssetUrl?: string;
  mentionScript?: string;
}

export class ProductIntelligence {
  private static instance: ProductIntelligence;

  private constructor() {}

  public static getInstance(): ProductIntelligence {
    if (!ProductIntelligence.instance) {
      ProductIntelligence.instance = new ProductIntelligence();
    }
    return ProductIntelligence.instance;
  }

  /**
   * Plans the contextual integration of e-commerce products in a project.
   */
  public planPromotion(productUrl: string, promptText: string): PromotionPlacement {
    const details = ProductUrlIntelligence.getInstance().extractProduct(productUrl);
    const hasMatch = promptText.toLowerCase().includes('keyboard') || promptText.toLowerCase().includes('product') || promptText.toLowerCase().includes('developer');

    console.log(`[ProductIntelligence] Formulating promo plan for: ${details.title}`);

    if (hasMatch) {
      return {
        shouldAppear: true,
        position: 'Middle',
        visualAssetUrl: details.images[0],
        mentionScript: `Using the ${details.title} from ${details.brand} makes developing this pipeline seamless.`,
      };
    }

    return {
      shouldAppear: false,
      position: 'CTA',
    };
  }
}
