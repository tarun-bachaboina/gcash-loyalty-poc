/**
 * Official GCash logo (public/assets/GCash_logo.svg) on a transparent background.
 * tone="brand" for working surfaces: the original in light theme, GCash_logo-dark.svg (white G + wordmark) in dark theme.
 * tone="white" (GCash_logo-white.svg) for blue / navy / slate / space surfaces.
 */
export function GCashLogo({ tone = 'brand', className = 'h-8', alt = 'GCash' }: { tone?: 'brand' | 'white'; className?: string; alt?: string }) {
  if (tone === 'white') return <img src="/assets/GCash_logo-white.svg" alt={alt} className={`w-auto ${className}`} />;
  return (
    <>
      <img src="/assets/GCash_logo.svg" alt={alt} className={`logo-light-theme w-auto ${className}`} />
      <img src="/assets/GCash_logo-dark.svg" alt={alt} className={`logo-dark-theme w-auto ${className}`} />
    </>
  );
}
