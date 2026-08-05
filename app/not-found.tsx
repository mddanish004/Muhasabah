import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6">
      <EmptyState
        title="Nothing here"
        description="The page you tried to open does not exist."
        action={
          <Link href="/">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </main>
  );
}
