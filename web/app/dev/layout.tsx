import { notFound } from "next/navigation";

// Localhost only: the /dev routes do not exist in production.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
