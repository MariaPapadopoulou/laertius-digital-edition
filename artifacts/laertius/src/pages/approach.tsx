import { usePageTitle } from "@/lib/use-page-title";
import { MethodPillars } from "@/components/method-pillars";

export default function ApproachPage() {
  usePageTitle("Why this approach");

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-16">
      <MethodPillars />
    </div>
  );
}
