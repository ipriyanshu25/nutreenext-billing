import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && rawNext !== "/login"
    ? rawNext
    : "/dashboard";

  return <LoginClient nextPath={nextPath} />;
}
