import { Link } from "wouter";

/**
 * Discreet cross-reference from a page to the matching section of the
 * About this edition page (which scrolls to the anchor on mount).
 */
export function AboutLink({
  anchor,
  label,
}: {
  anchor: string;
  label: string;
}) {
  return (
    <p className="text-sm mt-2">
      <Link
        href={`/about#${anchor}`}
        className="inline-block py-1.5 text-primary hover:underline"
      >
        {label}
      </Link>
    </p>
  );
}
