export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-2xl font-serif mb-2">Not Found (404)</h2>
      <p className="text-muted-foreground max-w-md">
        The page you requested does not exist or has been moved.
      </p>
    </div>
  );
}