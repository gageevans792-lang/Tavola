export default function ChatLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-pulse">
      <div className="h-14 border-b border-[#E2E8F0] bg-white" />
      <div className="flex-1 bg-white flex flex-col">
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className={`h-16 rounded ${i % 2 === 0 ? 'w-64 bg-[#F8F9FA]' : 'w-48 bg-[#E2E8F0]'}`} />
            </div>
          ))}
        </div>
        <div className="border-t border-[#E2E8F0] p-4">
          <div className="h-12 bg-[#F8F9FA] rounded" />
        </div>
      </div>
    </div>
  );
}
