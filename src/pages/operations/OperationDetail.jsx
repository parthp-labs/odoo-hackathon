import React, { useState } from 'react';
import OperationForm from '../../components/operations/OperationForm';
import OperationLines from '../../components/operations/OperationLines';
import StatusStepper from '../../components/operations/StatusStepper';
import StatusActions from '../../components/operations/StatusActions';
import { mockOperations } from '../../mocks/operations.mock';

export default function OperationDetail() {
  // Using the second mock item (Delivery Order) for testing
  const [operation, setOperation] = useState(mockOperations[1]); 
  
  const handleMarkReady = () => setOperation({ ...operation, status: 'ready' });
  const handleValidate = () => setOperation({ ...operation, status: 'done' });
  const handleCancel = () => setOperation({ ...operation, status: 'canceled' });

  const isDone = operation.status === 'done' || operation.status === 'canceled';

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      
      {/* Header & Stepper */}
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            {operation.reference}
          </h2>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <StatusStepper currentStatus={operation.status} />
        </div>
      </div>

      {/* Main Forms */}
      <OperationForm operation={operation} isReadOnly={isDone} />
      <OperationLines lines={operation.lines} status={operation.status} isReadOnly={isDone} />
      
      {/* Workflow Buttons */}
      <StatusActions 
        status={operation.status} 
        onMarkReady={handleMarkReady} 
        onValidate={handleValidate} 
        onCancel={handleCancel} 
      />

    </div>
  );
}