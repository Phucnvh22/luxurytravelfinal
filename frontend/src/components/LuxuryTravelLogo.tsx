type LuxuryTravelLogoProps = {
  className?: string
  title?: string
}

export default function LuxuryTravelLogo({
  className,
  title = 'Luxury Travel logo',
}: LuxuryTravelLogoProps) {
  return <img src="/logo.png" alt={title} className={className} />
}
