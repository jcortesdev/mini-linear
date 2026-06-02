export default function IssuesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
        <p className="text-sm text-zinc-500">
          The read-only issue list lands in the next module. The shell, sidebar, topbar and demo
          workspace are already wired up.
        </p>
      </div>
    </div>
  );
}
