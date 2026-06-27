import { Droplets, Sparkles, Package, Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/utils";

const categoryIcon: Record<string, typeof Droplets> = {
  PADS: Droplets,
  HYGIENE: Sparkles,
  ACCESSORY: Package,
  OTHER: Boxes,
};

/** Public-style catalogue — deliberately shows NO pricing. */
export function ProductCatalogue({
  products,
}: {
  products: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
    category: string;
    unitLabel: string;
  }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const Icon = categoryIcon[p.category] ?? Boxes;
        return (
          <Card key={p.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku} · {p.unitLabel}
                  </p>
                </div>
              </div>
              {p.description && (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {p.description}
                </p>
              )}
              <Badge variant="secondary" className="mt-3">
                {humanize(p.category)}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
