import { PAGE_METADATA } from "@/lib/seo/metadata";

export const metadata = PAGE_METADATA.faq;

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
