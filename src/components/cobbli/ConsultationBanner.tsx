import { Link } from "react-router-dom";
import { Camera } from "lucide-react";

const ConsultationBanner = () => (
  <Link
    to="/start-repair/assessment"
    className="flex items-center gap-3 px-4 py-3 rounded-[10px] border hover:shadow-sm transition-shadow"
    style={{ backgroundColor: "#fff5cc", borderColor: "#fdb600" }}
  >
    <div
      className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
    >
      <Camera size={16} />
    </div>
    <p className="text-sm flex-1" style={{ color: "#3d1700" }}>
      Not sure what your shoes need? Upload a photo and we'll recommend the right services.
    </p>
    <span
      className="text-sm whitespace-nowrap underline font-medium shrink-0"
      style={{ color: "#3d1700" }}
    >
      Get a recommendation →
    </span>
  </Link>
);

export default ConsultationBanner;
