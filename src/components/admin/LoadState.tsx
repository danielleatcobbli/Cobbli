import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type LoadStateProps = {
  isLoading: boolean;
  /** Anything thrown by the loader. Truthy means the load failed. */
  error: unknown;
  onRetry: () => void;
  /** What is being loaded, e.g. "requests" — used in the error title. */
  what: string;
  /**
   * Rendered ONLY after a successful load. On loading or error these are not
   * rendered at all, so a failed load can never look like an empty list or
   * show a count of zero. Error wins over any previously loaded data.
   */
  children: ReactNode;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : "Something went wrong.";

const LoadState = ({ isLoading, error, onRetry, what, children }: LoadStateProps) => {
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load {what}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{errorMessage(error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={`Loading ${what}`}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return <>{children}</>;
};

export default LoadState;
