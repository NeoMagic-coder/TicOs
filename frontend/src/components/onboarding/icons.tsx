import type { CSSProperties, ReactElement, ReactNode } from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

export function Icon({ size = 16, stroke = 1.5, style, children }: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="square"
      strokeLinejoin="miter"
      style={{ flex: 'none', ...style }}
    >
      {children}
    </svg>
  );
}

/* nav / system */
export const IcArrowRight = (p: IconProps) => (<Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>);
export const IcArrowLeft  = (p: IconProps) => (<Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Icon>);
export const IcCheck      = (p: IconProps) => (<Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>);
export const IcX          = (p: IconProps) => (<Icon {...p}><path d="M6 6l12 12M6 18L18 6"/></Icon>);
export const IcChevronR   = (p: IconProps) => (<Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>);
export const IcDot        = (p: IconProps) => (<Icon {...p}><circle cx="12" cy="12" r="3" fill="currentColor"/></Icon>);
export const IcPlus       = (p: IconProps) => (<Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>);
export const IcTerminal   = (p: IconProps) => (<Icon {...p}><path d="M3 5h18v14H3zM7 10l3 2-3 2M12 14h5"/></Icon>);
export const IcSpark      = (p: IconProps) => (<Icon {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/></Icon>);

/* product / category */
export const IcKitchen = (p: IconProps) => (<Icon {...p}>
  <path d="M5 4v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V4"/>
  <path d="M12 14v6M8 20h8"/>
</Icon>);
export const IcFashion = (p: IconProps) => (<Icon {...p}>
  <path d="M8 3l-5 4 2 3 3-2v13h8V8l3 2 2-3-5-4z"/>
</Icon>);
export const IcElectronics = (p: IconProps) => (<Icon {...p}>
  <rect x="4" y="5" width="16" height="11" rx="1"/>
  <path d="M2 19h20M8 19v-3M16 19v-3"/>
</Icon>);
export const IcCosmetic = (p: IconProps) => (<Icon {...p}>
  <path d="M9 3h6v4l1 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l1-2z"/>
  <path d="M9 13h6"/>
</Icon>);
export const IcSports = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M12 3v18M3 12h18M5.5 5.5l13 13M5.5 18.5l13-13"/>
</Icon>);
export const IcBaby = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="9" r="5"/>
  <path d="M9 9h.01M15 9h.01M10 12c.5.7 1.2 1 2 1s1.5-.3 2-1"/>
  <path d="M5 22c0-4 3-7 7-7s7 3 7 7"/>
</Icon>);
export const IcHobby = (p: IconProps) => (<Icon {...p}>
  <path d="M12 3l2.4 5.6L20 9l-4 4.2 1 6.8-5-3-5 3 1-6.8L4 9l5.6-.4z"/>
</Icon>);
export const IcAuto = (p: IconProps) => (<Icon {...p}>
  <path d="M3 13l2-6h14l2 6v5h-3v-2H6v2H3z"/>
  <circle cx="7.5" cy="15.5" r="1.5"/>
  <circle cx="16.5" cy="15.5" r="1.5"/>
</Icon>);
export const IcPackage = (p: IconProps) => (<Icon {...p}>
  <path d="M3 7l9-4 9 4v10l-9 4-9-4z"/>
  <path d="M3 7l9 4 9-4M12 11v10"/>
</Icon>);

/* stage */
export const IcBulb = (p: IconProps) => (<Icon {...p}>
  <path d="M9 18h6M10 21h4"/>
  <path d="M12 3a6 6 0 0 0-4 10.5c1 1 1.5 2 1.5 3.5h5c0-1.5.5-2.5 1.5-3.5A6 6 0 0 0 12 3z"/>
</Icon>);
export const IcShop = (p: IconProps) => (<Icon {...p}>
  <path d="M3 8l2-4h14l2 4v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/>
  <path d="M4 10v10h16V10M10 20v-5h4v5"/>
</Icon>);
export const IcRocket = (p: IconProps) => (<Icon {...p}>
  <path d="M12 2c4 3 6 7 6 11l-3 3h-6l-3-3c0-4 2-8 6-11z"/>
  <circle cx="12" cy="9" r="2"/>
  <path d="M9 16l-3 3v3l4-1M15 16l3 3v3l-4-1"/>
</Icon>);
export const IcCrosshair = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="3"/>
  <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
</Icon>);

/* market */
export const IcGlobeTR = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M10 8.5a3.5 3.5 0 1 0 0 7M14 9l1 1.5-1.7-.4-.4 1.5 1.2-1.1.5 1.6.4-1.6 1.6.4-1.4-1z"/>
</Icon>);
export const IcGlobeWorld = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/>
</Icon>);
export const IcGlobeBoth = (p: IconProps) => (<Icon {...p}>
  <circle cx="8" cy="12" r="5"/>
  <circle cx="16" cy="12" r="5"/>
</Icon>);

/* budget tiers */
export const IcTierMicro = (p: IconProps) => (<Icon {...p}>
  <rect x="4" y="16" width="3" height="4"/>
  <rect x="10.5" y="16" width="3" height="4" opacity=".25"/>
  <rect x="17" y="16" width="3" height="4" opacity=".25"/>
</Icon>);
export const IcTierSmall = (p: IconProps) => (<Icon {...p}>
  <rect x="4" y="14" width="3" height="6"/>
  <rect x="10.5" y="16" width="3" height="4"/>
  <rect x="17" y="16" width="3" height="4" opacity=".25"/>
</Icon>);
export const IcTierGrowth = (p: IconProps) => (<Icon {...p}>
  <rect x="4" y="12" width="3" height="8"/>
  <rect x="10.5" y="14" width="3" height="6"/>
  <rect x="17" y="16" width="3" height="4"/>
</Icon>);
export const IcTierScale = (p: IconProps) => (<Icon {...p}>
  <rect x="4" y="10" width="3" height="10"/>
  <rect x="10.5" y="12" width="3" height="8"/>
  <rect x="17" y="14" width="3" height="6"/>
</Icon>);

/* priorities */
export const IcBolt = (p: IconProps) => (<Icon {...p}>
  <path d="M13 2L4 14h6l-1 8 9-12h-6z"/>
</Icon>);
export const IcSparkle = (p: IconProps) => (<Icon {...p}>
  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>
</Icon>);
export const IcCoin = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M14 9.5c0-1-1-2-2.5-2S9 8.5 9 9.5s1 1.5 2.5 1.5S14 12 14 13s-1 2-2.5 2S9 14 9 13M12 6v2M12 16v2"/>
</Icon>);
export const IcGrowth = (p: IconProps) => (<Icon {...p}>
  <path d="M3 17l6-6 4 4 8-9"/>
  <path d="M14 6h7v7"/>
</Icon>);

/* channels */
export const IcShopify = (p: IconProps) => (<Icon {...p}>
  <path d="M7 7c0-2 1.5-4 4-4s3 2 3 4M10 5c0-1 .5-2 1.5-2M7 7l-2 1 1 11 9 1 1-11-3-2"/>
  <path d="M11 11c-1 0-1.5.5-1.5 1.5 0 1.5 2 1 2 2.5 0 1-1 1.5-2 1.5"/>
</Icon>);
export const IcWoo = (p: IconProps) => (<Icon {...p}>
  <path d="M3 8h18l-2 8H5z"/>
  <path d="M8 12v2M12 12v2M16 12v2"/>
</Icon>);
export const IcTrendyol = (p: IconProps) => (<Icon {...p}>
  <circle cx="12" cy="12" r="9"/>
  <path d="M9 11l3-3 3 3M12 8v8"/>
</Icon>);
export const IcHepsi = (p: IconProps) => (<Icon {...p}>
  <rect x="3" y="6" width="18" height="12" rx="1"/>
  <path d="M7 10v4M11 10v4M7 12h4M14 10h3v4h-3z"/>
</Icon>);
export const IcAmazon = (p: IconProps) => (<Icon {...p}>
  <path d="M5 8h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/>
  <path d="M5 19c2 1.5 4 2 7 2s5-.5 7-2"/>
</Icon>);
export const IcEtsy = (p: IconProps) => (<Icon {...p}>
  <path d="M7 4h10v3h-7v4h6v3h-6v4h7v3H7z"/>
</Icon>);
export const IcTikTok = (p: IconProps) => (<Icon {...p}>
  <path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2.5 4 5 4"/>
</Icon>);
export const IcSahibinden = (p: IconProps) => (<Icon {...p}>
  <circle cx="11" cy="11" r="6"/>
  <path d="M15 15l5 5"/>
</Icon>);
export const IcDolap = (p: IconProps) => (<Icon {...p}>
  <path d="M5 4h14v16H5z"/>
  <path d="M5 12h14M11 7v1M11 15v1"/>
</Icon>);

export const CATEGORY_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  'Ev & Mutfak': IcKitchen,
  'Moda & Aksesuar': IcFashion,
  'Elektronik': IcElectronics,
  'Kozmetik & Bakım': IcCosmetic,
  'Spor & Outdoor': IcSports,
  'Bebek & Anne': IcBaby,
  'Hobi': IcHobby,
  'Otomotiv': IcAuto,
};

export const CHANNEL_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  'Shopify': IcShopify,
  'WooCommerce': IcWoo,
  'Trendyol': IcTrendyol,
  'Hepsiburada': IcHepsi,
  'Amazon TR': IcAmazon,
  'Amazon Global': IcAmazon,
  'Etsy': IcEtsy,
  'TikTok Shop': IcTikTok,
  'Sahibinden': IcSahibinden,
  'Dolap': IcDolap,
};

export const NAMED_ICONS: Record<string, (p: IconProps) => ReactElement> = {
  IcBulb, IcPackage, IcRocket, IcCrosshair,
  IcGlobeTR, IcGlobeWorld, IcGlobeBoth,
  IcTierMicro, IcTierSmall, IcTierGrowth, IcTierScale,
  IcBolt, IcSparkle, IcCoin, IcGrowth,
};
