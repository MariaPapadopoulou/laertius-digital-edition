import { useGetEvalOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: overview, isLoading, error } = useGetEvalOverview();

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !overview) {
    const status = (error as { status?: number } | null)?.status;
    const needsAuth = status === 401 || status === 403;
    return (
      <div className="py-10 text-center space-y-2">
        <div className="text-destructive">
          {needsAuth
            ? "Coordinator authentication required."
            : "Failed to load overview data."}
        </div>
        {needsAuth && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The evaluation management API is protected by the coordinator
            password (HTTP Basic). Open the workbench in its own browser tab
            and sign in when prompted — any username, coordinator password.
          </p>
        )}
      </div>
    );
  }

  const stats = [
    { label: "Snapshots", value: overview.snapshots, href: "/snapshots" },
    { label: "Topic Sets", value: overview.topicSets, href: "/topics" },
    { label: "Runs", value: overview.runs, href: "/runs" },
    { label: "Pools", value: overview.pools, href: "/pools" },
    { label: "Batches", value: overview.batches, href: "/pools" },
    { label: "Judgments", value: overview.judgments, href: "/pools" },
    { label: "Annotators", value: overview.annotators, href: null },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif mb-2 text-primary">Overview</h1>
        <p className="text-muted-foreground">
          Aggregate metrics for the evaluation process (IR Evaluation).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const content = (
            <Card key={i} className="hover:border-primary transition-colors h-full">
              <CardContent className="p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-3xl font-mono font-medium text-primary">{stat.value}</div>
                <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );

          return stat.href ? (
            <Link key={i} href={stat.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
