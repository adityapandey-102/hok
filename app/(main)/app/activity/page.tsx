import { redirect } from "next/navigation";

/** The activity log lives in Reports → Daily activity; old links land there. */
export default function ActivityPage() {
  redirect("/app/reports?view=activity");
}
