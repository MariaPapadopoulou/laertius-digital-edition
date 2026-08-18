import { usePageTitle } from "@/lib/use-page-title";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  usePageTitle("Page Not Found");
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">404 Page Not Found</h1>
          <p className="text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
