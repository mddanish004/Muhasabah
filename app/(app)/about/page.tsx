import { Card } from "@/components/ui/card";

export default function AboutRoute() {
  return (
    <Card>
      <h1 className="text-xl font-semibold">About</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Muhasabah is a single-user analytics-first task dashboard built on Next.js, Prisma, NeonDB, and Vercel.
      </p>
    </Card>
  );
}
