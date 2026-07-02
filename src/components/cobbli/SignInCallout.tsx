import { Info } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const SignInCallout = () => {
  const location = useLocation();
  const from = `${location.pathname}${location.search}${location.hash}`;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-primary"
      style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
    >
      <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        <Link to="/signin" state={{ from }} className="underline font-medium">
          Sign in
        </Link>{" "}
        to see your saved pairs.
      </p>
    </div>
  );
};

export default SignInCallout;
