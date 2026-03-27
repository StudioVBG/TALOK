import { getSiteConfigMap } from "@/lib/queries/site-config"
import { LandingPageClient } from "@/components/marketing/LandingPageClient"

export const revalidate = 3600

export default async function LandingPage() {
  const images = await getSiteConfigMap()

  return <LandingPageClient images={images} />
}
