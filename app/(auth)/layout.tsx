import SiteFrame from "@/components/SiteFrame";

export const dynamic = "force-dynamic";

export default function AuthenticationLayout({ children }: { children: React.ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>;
}
