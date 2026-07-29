import type { Metadata } from "next";
import SiteFrame from "@/components/SiteFrame";
import SubmissionForm from "@/components/public/SubmissionForm";

export const metadata: Metadata = {
  title: "Submit evidence",
  description:
    "Send a sourced statement and its original evidence to the private Committee moderation queue.",
};

export default function SubmitPage() {
  return (
    <SiteFrame>
      <div className="document">
        <h1 className="page-title">Submit evidence</h1>
        <p style={{ color: "var(--ink-70)" }}>
          No team can watch two hundred channels in twelve languages. Readers
          can. Send the original evidence and the Committee will investigate it.
        </p>

        <div className="erratum" style={{ marginTop: 24 }}>
          <span className="lbl">Before you submit</span>
          <p>
            Prefer an official channel, assembly feed, press bureau, recognised
            news network, or the original public post. YouTube, Facebook and
            Instagram links are accepted. A social post is a lead—not proof by
            itself—and the surrounding context is always reviewed.
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
          Your email and submission remain inside the moderation room. An
          acknowledgement confirms receipt only; it does not mean the claim was
          accepted or published.
        </p>
      </div>
    </SiteFrame>
  );
}
