import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";
import SubmissionForm from "@/components/public/SubmissionForm";

export const metadata: Metadata = {
  title: "Send a clip",
  description:
    "Send a public speech clip that belongs on The Bhashan Board.",
};

export default function SubmitPage() {
  return (
    <SiteFrame>
      <div className="document">
        <h1 className="page-title">Send a clip</h1>
        <p style={{ color: "var(--ink-70)" }}>
          Heard something magnificent? Drop the original link, tell us who said
          it, and point us to the right moment.
        </p>

        <div className="erratum" style={{ marginTop: 24 }}>
          <span className="lbl">Links we can use</span>
          <p>
            YouTube, Facebook and Instagram links are welcome. An official
            channel, assembly feed or the original public post is easiest to
            turn into a playable clip.
          </p>
        </div>

        <SubmissionForm />

        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-45)",
            marginTop: 20,
          }}
        >
          Your email stays private. A receipt means the clip reached us; an
          admin still decides what goes live.
        </p>
      </div>
    </SiteFrame>
  );
}
