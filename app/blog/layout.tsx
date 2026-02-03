import { PAGE_METADATA } from "@/lib/seo/metadata";

export const metadata = PAGE_METADATA.blog;

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
