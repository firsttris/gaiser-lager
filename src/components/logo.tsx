import { resolvePublicAssetUrl } from '../utils/public-asset-url'

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <img
      src={resolvePublicAssetUrl('/assets/Logo.jpeg')}
      alt="Gaiser Logo"
      className={`w-auto ${className ?? ''}`}
    />
  )
}
