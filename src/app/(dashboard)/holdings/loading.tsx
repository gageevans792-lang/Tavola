export default function HoldingsLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8">
        <div className="bg-white border border-[#E2E8F0]">
          <div className="border-b border-[#E2E8F0] px-6 py-4">
            <div className="h-4 w-32 bg-[#E2E8F0] rounded" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-b border-[#E2E8F0] px-6 py-4 flex items-center gap-6">
              <div className="h-3 w-12 bg-[#E2E8F0] rounded" />
              <div className="h-3 w-24 bg-[#E2E8F0] rounded flex-1" />
              <div className="h-3 w-16 bg-[#E2E8F0] rounded" />
              <div className="h-3 w-16 bg-[#E2E8F0] rounded" />
              <div className="h-3 w-16 bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
