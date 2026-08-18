import { usePageTitle } from "@/lib/use-page-title";
import { Link } from "wouter";

export default function AccessibilityPage() {
  usePageTitle("Accessibility Statement");

  return (
    <article className="max-w-3xl mx-auto space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Accessibility Statement
        </h1>
        <p className="text-muted-foreground font-serif">
          <em>Humanistica Digitalia</em> is committed to making the Laertius digital
          scholarly edition accessible to all readers, in accordance with the
          principles of Directive (EU) 2016/2102 on the accessibility of
          websites and following the EU model accessibility statement.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">Scope</h2>
        <p className="font-serif text-foreground/90">
          This statement applies to the website published at{" "}
          <a
            href="https://laertius.humanisticadigitalia.eu"
            className="underline text-primary"
          >
            laertius.humanisticadigitalia.eu
          </a>
          , a digital scholarly edition of Diogenes Laertius&apos;{" "}
          <em>Lives of Eminent Philosophers</em>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          Compliance status
        </h2>
        <p className="font-serif text-foreground/90">
          This website is <strong>compliant</strong> with the Web Content
          Accessibility Guidelines (WCAG) 2.1 level AA, to the best of our
          knowledge. Previously reported limitations have been addressed: the
          knowledge graph and the timeline offer equivalent list views, the map
          provides a textual list of places and journey stops, and the parallel
          Greek and English text offers a stacked single-column alternative. A
          site-wide accessibility review continues, and any issue found is
          corrected as part of ongoing maintenance. Accessibility is implemented
          directly in the site&apos;s own semantic HTML and styling. No
          third-party accessibility overlay is used, in line with the European
          Commission&apos;s position that overlay tools do not establish
          compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          What we provide
        </h2>
        <ul className="list-disc pl-6 space-y-2 font-serif text-foreground/90">
          <li>Native semantic HTML structure (header, nav, main, article, section, footer), with ARIA used only where HTML cannot express the behaviour.</li>
          <li>Complete keyboard navigation with a visible focus indicator.</li>
          <li>A &ldquo;Skip to main content&rdquo; link on every page.</li>
          <li>Accessible labels for search fields and filters, and screen-reader announcements for dynamic search results.</li>
          <li>Light and dark themes designed for adequate colour contrast.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          Feedback and contact information
        </h2>
        <p className="font-serif text-foreground/90">
          If you notice an accessibility barrier on this site, or need content
          in an alternative form, please write to{" "}
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
          See also{" "}
          <Link href="/about" className="underline text-primary">
            About this edition
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
