import { getSiteConfig } from "@/lib/queries/site-config"
import { LandingPageClient } from "@/components/marketing/LandingPageClient"

export const revalidate = 3600

export default async function LandingPage() {
  const config = await getSiteConfig([
    "landing_arg_time_img",
    "landing_arg_money_img",
    "landing_arg_contract_img",
    "landing_arg_sleep_img",
    "landing_profile_owner_img",
    "landing_profile_investor_img",
    "landing_profile_agency_img",
    "landing_beforeafter_img",
  ])

  return <LandingPageClient images={config} />
}
