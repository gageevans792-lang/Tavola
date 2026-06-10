export default function MarketsLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] p-5">
              <div className="h-2 w-24 bg-[#E2E8F0] rounded mb-3" />
              <div className="h-5 w-32 bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-[#E2E8F0] h-96" />
      </div>
    </div>
  );
}
