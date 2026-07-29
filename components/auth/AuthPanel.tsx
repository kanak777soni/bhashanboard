import Link from "next/link";

export default function AuthPanel({
  eyebrow,
  title,
  introduction,
  children,
  alternate,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  children: React.ReactNode;
  alternate?: { href: string; label: string; prompt: string };
}) {
  return (
    <section className="admin-section" style={{ maxWidth: 620, margin: "34px auto 60px" }}>
      <span className="lbl" style={{ color: "var(--seal)" }}>
        {eyebrow}
      </span>
      <h1 className="auth-title" style={{ margin: "8px 0 12px" }}>{title}</h1>
      <p className="prose" style={{ margin: "0 0 22px" }}>
        {introduction}
      </p>
      {children}
      {alternate && (
        <p className="rail-note" style={{ marginTop: 18 }}>
          {alternate.prompt} <Link href={alternate.href}>{alternate.label}</Link>
        </p>
      )}
    </section>
  );
}
