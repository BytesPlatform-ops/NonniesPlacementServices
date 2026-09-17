import { Suspense } from "react";
import { ListsView } from "@/features/communications/ListsView";

export default function ListsPage() {
  // Suspense because the view reads search params (?open / ?returnTo) to come
  // back from the campaign wizard.
  return (
    <Suspense fallback={null}>
      <ListsView />
    </Suspense>
  );
}
