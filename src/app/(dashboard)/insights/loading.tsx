export default function InsightsLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8">
        <div className="bg-white border border-[#E2E8F0]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-[#E2E8F0] px-6 py-5">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-3 w-10 bg-[#E2E8F0] rounded" />
                <div className="h-3 w-16 bg-[#E2E8F0] rounded" />
              </div>
              <div className="h-3 w-full max-w-lg bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
