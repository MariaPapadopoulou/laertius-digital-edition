import { usePageTitle } from "@/lib/use-page-title";
import { Link } from "wouter";

export default function PrivacyPage() {
  usePageTitle("Privacy Notice");

  return (
    <article className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Privacy Notice
        </h1>
        <p className="text-muted-foreground font-serif">
          This notice explains what the Laertius digital scholarly edition
          processes when you read it, in line with the General Data
          Protection Regulation (GDPR).
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          What we do not do
        </h2>
        <ul className="list-disc pl-6 space-y-2 font-serif text-foreground/90">
          <li>No advertising and no user profiling.</li>
          <li>No analytics or tracking cookies. The site sets no cookies at all.</li>
          <li>
            No third-party fonts or scripts: fonts and application assets are
            served from this site itself, so reading the edition sends no
            request to Google or any other external provider. The one
            exception is the Map page, which loads its background map tiles
            from the OpenStreetMap Foundation (tile.openstreetmap.org); its
            privacy policy applies to those tile requests.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          What is processed
        </h2>
        <ul className="list-disc pl-6 space-y-2 font-serif text-foreground/90">
          <li>
            <strong>Server logs.</strong> Like every website, the server
            records standard technical logs (IP address, requested page,
            time) to keep the service running and secure. They are kept only
            for a short period and are not used for any other purpose.
          </li>
          <li>
            <strong>Ask Laertius queries.</strong> Questions typed into Ask
            are processed on this server to retrieve relevant passages. When
            a generative answer is requested, your question and the selected
            textual passages are transmitted securely to the OpenAI API to
            produce the response. No name, email address, or user account is
            included in this transmission, and your IP address is not
            forwarded: the request is made by this server, not by your
            browser. OpenAI does not use API inputs or outputs to train its
            models by default, although API data may be retained in its
            abuse-monitoring logs for up to 30 days.
          </li>
          <li>
            <strong>Reading preferences.</strong> Your theme choice (light or
            dark) is stored only in your own browser (localStorage), never on
            the server. This is strictly necessary storage and requires no
            consent banner.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          Contact
        </h2>
        <p className="font-serif text-foreground/90">
          For any question about this notice or your data, write to{" "}
          <a
            href="mailto:maria.papadopoulou@uoc.gr"
            className="underline text-primary"
          >
            maria.papadopoulou@uoc.gr
          </a>
          .
        </p>
      </section>

      <footer className="pt-4 border-t border-border">
        <p className="font-serif text-sm text-muted-foreground">
          See also the{" "}
          <Link href="/accessibility" className="underline text-primary">
            Accessibility Statement
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
