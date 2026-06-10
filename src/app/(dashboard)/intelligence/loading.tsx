export default function IntelligenceLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-6 h-1 w-32 bg-[#E2E8F0] overflow-hidden">
            <div className="h-full bg-[#B8960C] w-1/2" />
          </div>
          <div className="h-3 w-40 bg-[#E2E8F0] rounded mx-auto mb-2" />
          <div className="h-3 w-64 bg-[#E2E8F0] rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
