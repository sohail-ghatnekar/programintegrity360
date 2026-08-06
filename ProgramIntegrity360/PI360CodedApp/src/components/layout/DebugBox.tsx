import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const ENTITY_UUID = 'bcb8f163-c5cf-f011-8196-00224882fdd3';

export const DebugBox = () => {
  const { sdk } = useAuth();
  const [processesData, setProcessesData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Processes.getAll state
  const [processesGetAllData, setProcessesGetAllData] = useState<any>(null);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
  const [processesError, setProcessesError] = useState<string | null>(null);

  // Delete claims state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  const fetchProcesses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const records = await sdk.entities.getRecordsById(ENTITY_UUID, {
        pageSize: 100,
        $orderby: 'UpdateTime desc',
      });
      setProcessesData(records);
      console.log('Entity Records:', records);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch records';
      setError(errorMessage);
      console.error('Error fetching records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProcessesGetAll = async () => {
    setIsLoadingProcesses(true);
    setProcessesError(null);

    try {
      console.group('🔍 Testing processes.getAll()');
      console.log('SDK instance:', sdk);
      console.log('SDK.processes:', sdk.processes);
      console.log('Is authenticated:', sdk.isAuthenticated());
      console.log('Trying WITHOUT folder ID first...');

      try {
        const processes = await sdk.processes.getAll();

        console.log('✅ Processes Response (no folder):', processes);
        console.log('Type:', typeof processes);
        console.log('Is Array:', Array.isArray(processes));
        if (Array.isArray(processes)) {
          console.log('Count:', processes.length);
        }
        console.groupEnd();

        setProcessesGetAllData(processes);
        return;
      } catch (err1: any) {
        console.log('⚠️ Failed without folder ID, trying WITH folder ID...');
        console.log('Error:', err1?.message);

        // Try with folder ID from env
        const folderId = import.meta.env.VITE_MAESTRO_FOLDER_ID
          ? Number(import.meta.env.VITE_MAESTRO_FOLDER_ID)
          : 2336471;

        console.log('Folder ID:', folderId);
        const processes = await sdk.processes.getAll({ folderId: folderId });

        console.log('✅ Processes Response (with folder):', processes);
        console.log('Type:', typeof processes);
        console.log('Is Array:', Array.isArray(processes));
        if (Array.isArray(processes)) {
          console.log('Count:', processes.length);
        }
        console.groupEnd();

        setProcessesGetAllData(processes);
      }
    } catch (err: any) {
      console.group('❌ Error Details');
      console.error('Full error:', err);
      console.error('Error message:', err?.message);
      console.error('Error name:', err?.name);
      console.error('Error stack:', err?.stack);
      console.error('Error response:', err?.response);
      console.error('Error status:', err?.status);
      console.error('Error url:', err?.url);
      console.groupEnd();

      const errorMessage = err?.message || err?.toString() || 'Failed to fetch processes';
      setProcessesError(`${errorMessage} (Check console for details)`);
    } finally {
      setIsLoadingProcesses(false);
    }
  };

  const deleteOldestClaims = async () => {
    if (!window.confirm('⚠️ WARNING: This will DELETE the 20 oldest claims (by updateTime). This action cannot be undone. Are you sure?')) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteResult(null);

    try {
      console.group('🗑️ Deleting oldest 20 claims');

      // Fetch records WITHOUT sorting to get the first 20 (oldest by updateTime)
      const records = await sdk.entities.getRecordsById(ENTITY_UUID, {
        pageSize: 20,
        // No $orderby - this gets the natural order (oldest first)
      });

      console.log('Fetched records to delete:', records);

      if (!records?.items || records.items.length === 0) {
        setDeleteResult('No claims found to delete.');
        console.log('No items to delete');
        console.groupEnd();
        return;
      }

      const itemsToDelete = records.items;
      const recordIds = itemsToDelete.map((item: any) => item.id);

      console.log(`Attempting to delete ${recordIds.length} claims...`);
      console.log('Record IDs:', recordIds);

      // Delete all records in one call
      const deleteResponse = await sdk.entities.deleteById(ENTITY_UUID, recordIds);

      console.log('Delete response:', deleteResponse);
      console.groupEnd();

      const resultMessage = `Successfully deleted ${recordIds.length} claims.`;
      setDeleteResult(resultMessage);

      console.log('✅ Deletion summary:', {
        attempted: recordIds.length,
        deleted: recordIds.length,
        response: deleteResponse,
      });

    } catch (err: any) {
      console.error('❌ Error during deletion process:', err);
      const errorMessage = err?.message || 'Failed to delete claims';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-100 rounded-full p-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900">Debug Panel - API Testing</h3>
            <p className="text-sm text-gray-600">Test entities.getRecordsById() and processes.getAll()</p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Entity Records Test Section */}
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 rounded-full p-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-lg text-gray-900">Entity Records Test</h4>
              <p className="text-sm text-gray-600">Testing: sdk.entities.getRecordsById()</p>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={fetchProcesses}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Test API Call</span>
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Data Display */}
          {processesData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-green-700">Response Data:</h4>
                <span className="text-xs text-gray-600">
                  {processesData?.items && Array.isArray(processesData.items)
                    ? `${processesData.items.length} record(s)`
                    : 'Object returned'}
                </span>
              </div>
              <div className="bg-white rounded-md p-3 overflow-auto max-h-96 border border-gray-300">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(processesData, null, 2)}
                </pre>
              </div>
              <p className="text-xs text-gray-600 italic">
                * Data is also logged to browser console
              </p>
            </div>
          )}

          {/* Console Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Console Testing</span>
            </h4>
            <p className="text-xs text-gray-700 mb-2">
              To test in the browser console:
            </p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Open Developer Tools (F12 or Ctrl+Shift+I)</li>
              <li>Go to Console tab</li>
              <li>The SDK is exposed globally - type: <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-700 font-mono">window.sdk</code></li>
              <li>Run: <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-700 font-mono text-xs">await window.sdk.entities.getRecordsById('{ENTITY_UUID}', {'{ pageSize: 100, $orderby: "UpdateTime desc" }'})</code></li>
            </ol>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 my-6"></div>

          {/* Processes.getAll() Test Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 rounded-full p-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900">Processes Test</h4>
                <p className="text-sm text-gray-600">Testing: sdk.processes.getAll()</p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={fetchProcessesGetAll}
              disabled={isLoadingProcesses}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
            >
              {isLoadingProcesses ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Fetching Processes...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Test processes.getAll()</span>
                </>
              )}
            </button>

            {/* Error Display */}
            {processesError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-800">Error</p>
                    <p className="text-sm text-red-700">{processesError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Data Display */}
            {processesGetAllData && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-purple-700">Processes Response:</h4>
                  <span className="text-xs text-gray-600">
                    {Array.isArray(processesGetAllData)
                      ? `${processesGetAllData.length} process(es)`
                      : 'Object returned'}
                  </span>
                </div>
                <div className="bg-white rounded-md p-3 overflow-auto max-h-96 border border-gray-300">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(processesGetAllData, null, 2)}
                  </pre>
                </div>
                <p className="text-xs text-gray-600 italic">
                  * Data is also logged to browser console
                </p>
              </div>
            )}

            {/* Console Instructions for Processes */}
            <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
              <h4 className="font-semibold text-purple-800 mb-2 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Console Testing</span>
              </h4>
              <p className="text-xs text-gray-700 mb-2">
                To test in the browser console:
              </p>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>Open Developer Tools (F12 or Ctrl+Shift+I)</li>
                <li>Go to Console tab</li>
                <li>Run: <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700 font-mono text-xs">await sdk.processes.getAll()</code></li>
                <li>Or with folder: <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700 font-mono text-xs">await sdk.processes.getAll(folderId)</code></li>
              </ol>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 my-6"></div>

          {/* Delete Oldest Claims Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 rounded-full p-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg text-gray-900">Delete Oldest Claims</h4>
                <p className="text-sm text-gray-600">⚠️ DANGER: Deletes the 20 oldest claims (by updateTime)</p>
              </div>
            </div>

            <div className="bg-red-50 border-2 border-red-300 rounded-md p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-red-800 mb-2">Warning: Destructive Action</p>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    <li>This will permanently delete the 20 oldest claims</li>
                    <li>Oldest = natural order (earliest updateTime)</li>
                    <li>No sorting is applied before deletion</li>
                    <li>This action cannot be undone</li>
                    <li>Use only in development/testing environments</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={deleteOldestClaims}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium transition-colors flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete 20 Oldest Claims</span>
                </>
              )}
            </button>

            {/* Success Message */}
            {deleteResult && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-semibold text-green-800">Success</p>
                    <p className="text-sm text-green-700">{deleteResult}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-800">Error</p>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap">{deleteError}</pre>
                  </div>
                </div>
              </div>
            )}

            {/* Console Instructions */}
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 className="font-semibold text-red-800 mb-2 flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Console Testing</span>
              </h4>
              <p className="text-xs text-gray-700 mb-2">
                To manually delete records in console:
              </p>
              <code className="block bg-gray-100 px-2 py-1 rounded text-red-700 font-mono text-xs overflow-x-auto">
                await sdk.entities.deleteById('{ENTITY_UUID}', ['record-id-1', 'record-id-2'])
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
