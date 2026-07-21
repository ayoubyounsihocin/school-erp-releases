import React, { useState } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender 
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { useLanguage } from '../i18n';
export default function AdvancedTable({ 
  data, 
  columns, 
  globalSearch, 
  onRowReorder, // callback(sourceIndex, targetIndex)
  enablePagination = true,
  defaultPageSize = 10,
  rowClassName = () => '',
  rowSelection = {},
  onRowSelectionChange,
  onRowClick,
  renderRowDetails
}) {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  const [sorting, setSorting] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnPinning, setColumnPinning] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: globalSearch,
      columnVisibility,
      columnPinning,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize: defaultPageSize
      }
    }
  });

  // HTML5 Drag and Drop Row Reordering state helpers
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);

  const handleDragStart = (e, index) => {
    if (!onRowReorder) return;
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    if (!onRowReorder || draggedRowIndex === null) return;
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    if (!onRowReorder || draggedRowIndex === null) return;
    e.preventDefault();
    if (draggedRowIndex !== targetIndex) {
      onRowReorder(draggedRowIndex, targetIndex);
    }
    setDraggedRowIndex(null);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Table Element */}
      <div className="overflow-x-auto w-full relative">
        <table className="w-full border-collapse text-left rtl:text-right" style={{ minWidth: '100%', width: table.getCenterTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr 
                key={headerGroup.id} 
                className="border-b border-slate-800/80 bg-slate-950/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider select-none"
              >
                {/* Reorder column placeholder header if row reordering is enabled */}
                {onRowReorder && <th className="px-4 py-3.5 w-8"></th>}
                
                {headerGroup.headers.map((header) => {
                  return (
                    <th 
                      key={header.id}
                      className="px-6 py-3.5 font-bold relative group border-r border-slate-200 dark:border-slate-700/60 last:border-none rtl:border-l rtl:border-r-0 rtl:last:border-none"
                      style={{ 
                        width: header.getSize(),
                        position: 'relative'
                      }}
                    >
                      <div 
                        className={`flex items-center gap-2 cursor-pointer ${
                          header.column.getCanSort() ? 'select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        
                        {/* Sort Indicator Icons */}
                        {header.column.getCanSort() && (
                          <span className="text-slate-550 group-hover:text-slate-350 transition-colors">
                            {{
                              asc: <ChevronUp className="h-3 w-3 text-blue-500" />,
                              desc: <ChevronDown className="h-3 w-3 text-blue-500" />,
                            }[header.column.getIsSorted()] || (
                              <ChevronsUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Resize Handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute top-0 bottom-0 ${
                            isAr ? 'left-0' : 'right-0'
                          } w-1 bg-transparent cursor-col-resize select-none hover:bg-blue-500/45 transition-colors`}
                          style={{
                            userSelect: 'none',
                            touchAction: 'none'
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800/35 text-xs text-slate-300">
            {table.getRowModel().rows.map((row, rIdx) => {
              const detailsContent = renderRowDetails ? renderRowDetails(row) : null;
              return (
                <React.Fragment key={row.id}>
                  <tr 
                    draggable={!!onRowReorder}
                    onDragStart={(e) => handleDragStart(e, rIdx)}
                    onDragOver={(e) => handleDragOver(e, rIdx)}
                    onDrop={(e) => handleDrop(e, rIdx)}
                    onClick={(e) => {
                      if (
                        e.target.closest('button, a, input, select, textarea') || 
                        e.target.getAttribute('role') === 'button' ||
                        e.target.closest('.no-row-click')
                      ) {
                        return;
                      }
                      if (onRowClick) onRowClick(row, e);
                    }}
                    className={`border-b border-slate-850/30 last:border-b-0 transition-colors duration-150 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      row.getIsSelected() 
                        ? 'bg-blue-600/10 dark:bg-blue-600/15 border-blue-500/25 text-blue-200 dark:text-blue-100 hover:bg-blue-600/15 dark:hover:bg-blue-600/20 shadow-sm' 
                        : 'hover:bg-slate-900/35'
                    } ${
                      draggedRowIndex === rIdx ? 'opacity-40 bg-slate-800/40' : ''
                    } ${rowClassName(row.original)}`}
                  >
                    {/* Drag handle column if row reordering is enabled */}
                    {onRowReorder && (
                      <td className="px-4 py-3 text-slate-500 hover:text-slate-350 transition-colors cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5" />
                      </td>
                    )}
                    
                    {row.getVisibleCells().map((cell) => (
                      <td 
                        key={cell.id} 
                        className="px-6 py-3 font-medium align-middle"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                  {detailsContent && (
                    <tr className="no-row-click border-none bg-slate-950/10">
                      <td colSpan={row.getVisibleCells().length + (onRowReorder ? 1 : 0)} className="p-0 border-none">
                        {detailsContent}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {enablePagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-slate-850/60 pt-4 text-xs select-none" dir="ltr">
          <div className="text-slate-500 font-medium">
            {isAr ? (
              <span>
                الصفحة {table.getState().pagination.pageIndex + 1} من {table.getPageCount()}
              </span>
            ) : (
              <span>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 disabled:opacity-40 text-slate-450 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 disabled:opacity-40 text-slate-450 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
