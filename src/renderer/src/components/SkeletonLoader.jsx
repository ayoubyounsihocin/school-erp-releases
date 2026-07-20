import React from 'react';

/**
 * SkeletonLoader component for modern, shimmering loading state representation.
 */
export default function SkeletonLoader({ type = 'table', rows = 5, cols = 5 }) {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6 animate-pulse w-full">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-7 w-7 bg-slate-800 rounded-lg"></div>
              </div>
              <div className="h-6 w-32 bg-slate-800 rounded mt-2"></div>
              <div className="h-2 w-16 bg-slate-800 rounded mt-1"></div>
            </div>
          ))}
        </div>

        {/* Charts and Alerts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl h-80 flex flex-col justify-between">
            <div className="h-4 w-40 bg-slate-800 rounded"></div>
            <div className="flex items-end justify-between gap-4 h-56 px-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex gap-2 items-end h-full">
                  <div className="w-5 bg-slate-800 rounded-t-md" style={{ height: `${20 + i * 10}%` }}></div>
                  <div className="w-5 bg-slate-850 rounded-t-md" style={{ height: `${10 + i * 8}%` }}></div>
                </div>
              ))}
            </div>
            <div className="h-3 w-full bg-slate-800 rounded mt-3"></div>
          </div>
          <div className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl h-80 space-y-4">
            <div className="h-4 w-32 bg-slate-800 rounded"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-800/60 border border-slate-800/30 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse w-full">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-6 bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-800 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-3.5 w-28 bg-slate-800 rounded"></div>
                <div className="h-2 w-20 bg-slate-800 rounded"></div>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-2 w-full bg-slate-800 rounded"></div>
              <div className="h-2 w-5/6 bg-slate-800 rounded"></div>
            </div>
            <div className="h-8 w-24 bg-slate-800 rounded-xl mt-4"></div>
          </div>
        ))}
      </div>
    );
  }

  // Default: Table skeleton
  return (
    <div className="overflow-x-auto w-full animate-pulse border border-slate-800/60 rounded-2xl bg-slate-900/20">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-800/60 bg-slate-950/40">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <div className="h-3 w-16 bg-slate-800 rounded"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/30">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx}>
              {Array.from({ length: cols }).map((_, cIdx) => (
                <td key={cIdx} className="px-6 py-4">
                  <div className={`h-3 bg-slate-800 rounded ${cIdx === 0 ? 'w-28 font-semibold' : 'w-20'}`}></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
