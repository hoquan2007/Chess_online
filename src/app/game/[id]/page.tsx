import { notFound } from "next/navigation";
import { GameRoom } from "@/components/GameRoom";
import { validUuid } from "@/lib/online/games";

export const metadata = { title: "Online game · Rookline" };
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validUuid(id)) notFound();
  return <GameRoom id={id} />;
}
