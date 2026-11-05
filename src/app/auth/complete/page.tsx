import { AuthCompletion } from "@/components/AuthCompletion";
import { safeNext } from "@/lib/online/redirect";

export const metadata = { title: "Confirm email · Rookline" };

export default async function CompleteAuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthCompletion next={safeNext(next)} />;
}
