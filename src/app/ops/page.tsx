import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OpsDashboardPage from "@/components/ops/ops-dashboard-page";
import { OPS_AUTH_COOKIE, verifyOpsAuthToken, verifyOpsEntryToken } from "@/lib/ops-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OpsPageSearchParams =
  | {
      entry?: string | string[];
    }
  | undefined;

export default async function OpsPage({
  searchParams,
}: {
  searchParams?: OpsPageSearchParams | Promise<OpsPageSearchParams>;
}) {
  const isPasswordProtected = Boolean(process.env.OPS_DASHBOARD_PASSWORD);
  if (isPasswordProtected) {
    const resolvedSearchParams = await Promise.resolve(searchParams);
    const entryTokenRaw = resolvedSearchParams?.entry;
    const entryToken = Array.isArray(entryTokenRaw) ? entryTokenRaw[0] : entryTokenRaw;

    const cookieStore = await cookies();
    const token = cookieStore.get(OPS_AUTH_COOKIE)?.value;

    if (!verifyOpsAuthToken(token) || !verifyOpsEntryToken(entryToken)) {
      redirect("/ops/login");
    }
  }

  return <OpsDashboardPage />;
}
