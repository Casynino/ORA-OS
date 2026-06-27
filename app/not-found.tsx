import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-secondary/40 to-background px-6 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-6xl font-bold tracking-tight">
        404
      </h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        We couldn&apos;t find that page. It may have moved, or never existed.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Back to home
      </Link>
    </div>
  );
}
