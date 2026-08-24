import { createFileRoute } from "@tanstack/react-router";
import { ShareExplorer } from "@/components/share-explorer";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ShareExplorer />
    </main>
  );
}
