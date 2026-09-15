import ItemsClient from "./ItemsClient";
import { getMenuItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function ItemsPage() {
  return <ItemsClient initialItems={getMenuItems(true)} />;
}
