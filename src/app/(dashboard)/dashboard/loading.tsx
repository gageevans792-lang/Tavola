export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border border-[#E2E8F0] bg-[#E2E8F0]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white px-6 py-5">
              <div className="h-2.5 w-20 bg-[#E2E8F0] rounded mb-4" />
              <div className="h-7 w-28 bg-[#E2E8F0] rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] h-64" />
          <div className="bg-white border border-[#E2E8F0] h-64" />
        </div>
        <div className="bg-white border border-[#E2E8F0] h-48" />
      </div>
    </div>
  );
}
