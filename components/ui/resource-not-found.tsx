import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface ResourceNotFoundProps {
  icon: LucideIcon;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}

export function ResourceNotFound({
  icon: Icon,
  title,
  description,
  backHref,
  backLabel,
}: ResourceNotFoundProps) {
  return (
    <div className="flex items-center justify-center p-4 min-h-[60vh]">
      <Card className="w-full max-w-lg border-border/50 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Icon className="h-10 w-10 text-muted-foreground" />
          </div>
          <span className="text-6xl font-bold text-muted-foreground/30">404</span>
          <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
