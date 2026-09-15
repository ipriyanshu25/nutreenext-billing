import ItemsClient from "./ItemsClient";
import { getMenuItems } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ItemsPage() {
  const items = await getMenuItems(true);
  return <ItemsClient initialItems={items} />;
}
