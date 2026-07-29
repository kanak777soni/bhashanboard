import Link from "next/link";
import SiteFrame from "@/components/SiteFrame";

export default function NotFound() {
  return (
    <SiteFrame>
      <div className="document" style={{ padding: "40px 0 0" }}>
        <h1 className="page-title">Not on record</h1>
        <p>
          This page does not exist. Unlike the statements on this website, which are unfortunately real.
        </p>
        <p style={{ marginTop: 22 }}>
          <Link className="btn" href="/">
            Return to the front page
          </Link>
        </p>
      </div>
    </SiteFrame>
  );
}
