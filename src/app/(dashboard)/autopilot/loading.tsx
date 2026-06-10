export default function AutopilotLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8 space-y-6">
        <div className="bg-white border border-[#E2E8F0] p-6">
          <div className="h-4 w-48 bg-[#E2E8F0] rounded mb-4" />
          <div className="h-3 w-full max-w-md bg-[#E2E8F0] rounded mb-6" />
          <div className="h-10 w-32 bg-[#E2E8F0] rounded" />
        </div>
        <div className="bg-white border border-[#E2E8F0] h-64" />
      </div>
    </div>
  );
}
