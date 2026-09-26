import React from 'react';

export default function OperationLines({ lines = [], isReadOnly = false, status }) {
  const isDraft = status?.toLowerCase() === 'draft';
  const isReady = status?.toLowerCase() === 'ready';

  return (
    <div className="bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Products</h3>
        {isDraft && !isReadOnly && (
          <button className="text-sm font-medium text-blue-600 hover:text-blue-500">
            + Add Product
          </button>
        )}
      </div>
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Demand</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Done</th>
            {!isReadOnly && isDraft && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {lines.length === 0 ? (
            <tr>
              <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                No products added yet.
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {line.product?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                  {isDraft && !isReadOnly ? (
                    <input 
                      type="number" 
                      defaultValue={line.quantity_demanded}
                      className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  ) : (
                    <span>{line.quantity_demanded} {line.product?.uom}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 font-semibold">
                  {isReady && !isReadOnly ? (
                    <input 
                      type="number" 
                      defaultValue={line.quantity_done || 0}
                      className="w-20 text-right rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  ) : (
                    <span>{line.quantity_done || 0} {line.product?.uom}</span>
                  )}
                </td>
                {!isReadOnly && isDraft && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-red-600 hover:text-red-900">Remove</button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}