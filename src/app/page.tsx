import { redirect } from "next/navigation";

// Root page - redirect to admin or liff based on context
export default function Home() {
  // In production, this would check session and redirect accordingly
  // For now, redirect to admin login
  redirect("/auth/login");
}
