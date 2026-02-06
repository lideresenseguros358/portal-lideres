export default function DatabaseSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Toolbar Skeleton */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Tabs skeleton */}
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-200 rounded-lg"></div>
            <div className="h-10 w-32 bg-gray-200 rounded-lg"></div>
            <div className="h-10 w-28 bg-gray-200 rounded-lg"></div>
          </div>
          
          {/* Actions skeleton */}
          <div className="flex gap-2 ml-auto">
            <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
            <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="bg-white rounded-xl shadow-md border-2 border-gray-100 p-4">
        <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
      </div>

      {/* Table skeleton - Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3">
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 bg-gray-300 rounded w-28"></div>
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 bg-gray-300 rounded w-36"></div>
                </th>
                <th className="px-4 py-3">
                  <div className="h-4 bg-gray-300 rounded w-20"></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-4">
                    <div className="h-5 bg-gray-200 rounded w-40"></div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 bg-gray-200 rounded w-32"></div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 bg-gray-200 rounded w-48"></div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-5 bg-gray-200 rounded w-28"></div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      <div className="h-8 w-8 bg-gray-200 rounded"></div>
                      <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards skeleton - Mobile */}
      <div className="md:hidden space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div>
                  <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <div className="h-9 bg-gray-200 rounded flex-1"></div>
                <div className="h-9 bg-gray-200 rounded flex-1"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
