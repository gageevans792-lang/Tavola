export default function PerformanceLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-[#E2E8F0] bg-[#E2E8F0]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white px-5 py-5">
              <div className="h-2 w-16 bg-[#E2E8F0] rounded mb-3" />
              <div className="h-6 w-24 bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-[#E2E8F0] h-72" />
        <div className="bg-white border border-[#E2E8F0] h-48" />
      </div>
    </div>
  );
}
