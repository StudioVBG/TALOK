import { FeatureCard, FEATURE_CARDS } from './FeatureCard'

interface ArgumentsSectionProps {
  images: Record<string, string>
}

export function ArgumentsSection({ images }: ArgumentsSectionProps) {
  return (
    <section
      style={{ background: '#1D4ED8', paddingTop: '24px', paddingBottom: '24px' }}
    >
      {FEATURE_CARDS.map((feature) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          imageSrc={
            images[feature.configKey] ||
            'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
          }
        />
      ))}
    </section>
  )
}
