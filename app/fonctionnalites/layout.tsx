import { PublicFooter } from "@/components/layout/public-footer";

export default function FonctionnalitesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PublicFooter variant="dark" />
    </>
  );
}
