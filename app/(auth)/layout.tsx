/**
 * @file layout.tsx — app/(auth)
 * Minimal layout for the authentication flow.
 * No sidebar, no header — just centered content.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-base)" }}
    >
      {children}
    </div>
  );
}