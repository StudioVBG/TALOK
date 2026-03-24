import { PublicFooter } from "@/components/layout/public-footer";

export default function GuidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PublicFooter variant="light" />
    </>
  );
}
