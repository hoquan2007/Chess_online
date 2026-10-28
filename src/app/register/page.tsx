import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Create account · Rookline" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="register" next={next} />;
}
