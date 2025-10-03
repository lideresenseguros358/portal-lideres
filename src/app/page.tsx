import { redirect } from "next/navigation";

export default function Home() {
  // Always redirect to dashboard
  // The app layout will handle auth checks
  redirect("/dashboard");
}
