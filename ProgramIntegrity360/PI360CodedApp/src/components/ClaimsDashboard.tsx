import { useEffect, useState } from 'react';
import { useClaims, type ProcessedClaim } from '../hooks/useClaims';
import { ClaimsDataGrid } from './ClaimsDataGrid';
import { ClaimDetails } from './ClaimDetails';
import { Header } from './Header';
import { StartApplicationModal } from './modals/StartApplicationModal';
import { useAuth } from '../hooks/useAuth';
import { StartStrategy, JobPriority } from '@uipath/uipath-typescript';
import { DebugBox } from './layout/DebugBox';

const PROCESS_KEY = 'd0d245fb-a685-4784-9320-5de1601d3463'; // Can also use processKey from environment
const FOLDER_ID = 2336471;
const SHOW_DEBUG_BOX = import.meta.env.VITE_SHOW_DEBUG_BOX === 'true';

type UiPathHttpError = Error & {
  status?: number;
  statusCode?: number;
  response?: {
    status?: number;
    data?: unknown;
  };
  cause?: {
    status?: number;
    response?: {
      status?: number;
      data?: unknown;
    };
  };
};

function getHttpStatus(error: unknown): number | undefined {
  const typedError = error as UiPathHttpError;

  return typedError?.status
    ?? typedError?.statusCode
    ?? typedError?.response?.status
    ?? typedError?.cause?.status
    ?? typedError?.cause?.response?.status;
}

function formatStartProcessError(step: string, error: unknown): string {
  const typedError = error as UiPathHttpError;
  const status = getHttpStatus(error);
  const message = typedError?.message?.trim() || 'Unknown error';
  const statusLabel = status ? ` (${status})` : '';

  return `${step} failed${statusLabel}: ${message}`;
}

export const ClaimsDashboard = () => {
  const { claims, isLoading, error, refetch } = useClaims();
  const { sdk, currentUserEmail } = useAuth();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applicationFilePath, setApplicationFilePath] = useState('');
  const [caseWorkerEmail, setCaseWorkerEmail] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isStartingProcess, setIsStartingProcess] = useState(false);
  const [startProcessError, setStartProcessError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const processFolderId = String(FOLDER_ID);
  const processKey = PROCESS_KEY;
  const runAsMe = true;
  const startStrategy = StartStrategy.ModernJobsCount;

  useEffect(() => {
    if (currentUserEmail && !caseWorkerEmail) {
      setCaseWorkerEmail(currentUserEmail);
    }
  }, [currentUserEmail, caseWorkerEmail]);

  // Selected claim state
  const [selectedClaim, setSelectedClaim] = useState<ProcessedClaim | null>(null);
  const [showDetailView, setShowDetailView] = useState(false);

  // Handle claim selection - navigate to detail view
  const handleClaimSelect = (claim: ProcessedClaim | null) => {
    setSelectedClaim(claim);
    if (claim) {
      setShowDetailView(true);
    }
  };

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    setShowDetailView(false);
    setSelectedClaim(null);
  };

  // Handle starting a new application process
  const handleStartProcess = async () => {
    try {
      setIsStartingProcess(true);
      setStartProcessError(null);
      const resolvedProcessFolderId = Number(processFolderId) || FOLDER_ID;

      // Upload the file to the bucket if one was selected
      const finalFilePath = applicationFilePath;
      if (uploadedFile) {
        const uploadPath = `/${applicationFilePath}`;
        try {
          const uploadResponse = await sdk.buckets.uploadFile({
            bucketId: 56094,
            folderId: resolvedProcessFolderId,
            path: uploadPath,
            content: uploadedFile,
          } as any);
          console.log('Bucket upload succeeded', {
            bucketId: 56094,
            folderId: resolvedProcessFolderId,
            path: uploadPath,
            response: uploadResponse,
          });
        } catch (err) {
          console.error('Bucket upload failed', {
            bucketId: 56094,
            folderId: resolvedProcessFolderId,
            path: uploadPath,
            status: getHttpStatus(err),
            error: err,
          });
          throw new Error(formatStartProcessError('Bucket upload', err));
        }
      }

      // Start the process with the parameters
      const requestPayload = {
        processKey,
        strategy: startStrategy,
        runAsMe,
        jobPriority: JobPriority.Normal,
        inputArguments: JSON.stringify({
          In_ExampleApplication: finalFilePath,
          caseWorkerEmail: caseWorkerEmail,
        }),
        requiresUserInteraction: false,
      };

      let processResponse;
      try {
        processResponse = await sdk.processes.start(requestPayload, resolvedProcessFolderId);
      } catch (err) {
        console.error('Process start failed', {
          processKey,
          folderId: resolvedProcessFolderId,
          runAsMe: requestPayload.runAsMe,
          strategy: requestPayload.strategy,
          jobPriority: requestPayload.jobPriority,
          requiresUserInteraction: requestPayload.requiresUserInteraction,
          status: getHttpStatus(err),
          error: err,
        });
        throw new Error(formatStartProcessError('Process start', err));
      }

      console.log('Process started successfully', {
        processKey,
        folderId: resolvedProcessFolderId,
        response: processResponse,
      });

      // Show success message
      setSuccessMessage('Application process started successfully! Refreshing claims list in 30 seconds...');

      // Close modal
      setIsModalOpen(false);

      // Reset form
      setApplicationFilePath('');
      setCaseWorkerEmail('');
      setUploadedFile(null);

      // Refresh claims list after 30 seconds
      setTimeout(() => {
        refetch();
        setSuccessMessage(null);
      }, 30000);

    } catch (err) {
      console.error('Start application flow failed', err);
      setStartProcessError(err instanceof Error ? err.message : 'Failed to start process');
    } finally {
      setIsStartingProcess(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 font-medium">Loading claims data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error Loading Claims</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const totalApplications = claims.length;
  const pendingApplications = claims.filter(c => c.eligibilityStatus === 'Pending').length;
  const approvedApplications = claims.filter(c => c.eligibilityStatus === 'Approved').length;
  const deniedApplications = claims.filter(c => c.eligibilityStatus === 'Denied').length;
  const underReviewApplications = claims.filter(c => c.eligibilityStatus === 'Under Review').length;
  const addressVerifiedCount = claims.filter(c => c.addressVerificationState === 'verified').length;
  const incomeVerifiedCount = claims.filter(c => c.incomeVerificationState === 'verified').length;

  // Calculate average processing time (dummy data for now)
  const avgProcessingTime = '3.2 days';
  const approvalRate = totalApplications > 0 ? ((approvedApplications / totalApplications) * 100).toFixed(1) : '0';

  // If detail view is active, show full-page details
  if (showDetailView && selectedClaim) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <ClaimDetails
          selectedClaim={selectedClaim}
          sdk={sdk}
          onBack={handleBackToDashboard}
          onRefresh={refetch}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Total Applications */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Applications</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{totalApplications}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Applications */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{pendingApplications}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Approved Applications */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{approvedApplications}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Rate */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Approval Rate</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{approvalRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Metrics & Charts */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 mb-8">
          {/* Status Breakdown */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Application Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Pending</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{pendingApplications}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Approved</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{approvedApplications}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Denied</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{deniedApplications}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Under Review</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{underReviewApplications}</span>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex h-4 rounded-full overflow-hidden">
                  {approvedApplications > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(approvedApplications / totalApplications) * 100}%` }}
                      title={`Approved: ${approvedApplications}`}
                    ></div>
                  )}
                  {pendingApplications > 0 && (
                    <div
                      className="bg-yellow-500"
                      style={{ width: `${(pendingApplications / totalApplications) * 100}%` }}
                      title={`Pending: ${pendingApplications}`}
                    ></div>
                  )}
                  {underReviewApplications > 0 && (
                    <div
                      className="bg-blue-500"
                      style={{ width: `${(underReviewApplications / totalApplications) * 100}%` }}
                      title={`Under Review: ${underReviewApplications}`}
                    ></div>
                  )}
                  {deniedApplications > 0 && (
                    <div
                      className="bg-red-500"
                      style={{ width: `${(deniedApplications / totalApplications) * 100}%` }}
                      title={`Denied: ${deniedApplications}`}
                    ></div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verification Metrics */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Verification Status</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Address Verified</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {addressVerifiedCount} / {totalApplications}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${totalApplications > 0 ? (addressVerifiedCount / totalApplications) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Income Verified</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {incomeVerifiedCount} / {totalApplications}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${totalApplications > 0 ? (incomeVerifiedCount / totalApplications) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg. Processing Time</span>
                  <span className="text-sm font-semibold text-gray-900">{avgProcessingTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-200">
            <div className="p-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Today's Applications</span>
                  <span className="text-lg font-bold text-blue-600">12</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="text-lg font-bold text-blue-600">87</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-lg font-bold text-blue-600">342</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg. Response Time</span>
                  <span className="text-lg font-bold text-green-600">24hrs</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Debug Box - Only shown when VITE_SHOW_DEBUG_BOX=true */}
        {SHOW_DEBUG_BOX && <DebugBox />}

        {/* Data Grid */}
        <div className="bg-white shadow rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Applications</h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Start New Application
            </button>
          </div>
          <ClaimsDataGrid
            claims={claims}
            onClaimSelect={handleClaimSelect}
            selectedClaim={null}
            onRefresh={refetch}
            isRefreshing={isLoading}
            sdk={sdk}
          />
        </div>
      </main>

      {/* Start Application Modal */}
      <StartApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        applicationFilePath={applicationFilePath}
        setApplicationFilePath={setApplicationFilePath}
        caseWorkerEmail={caseWorkerEmail}
        setCaseWorkerEmail={setCaseWorkerEmail}
        onSubmit={handleStartProcess}
        isLoading={isStartingProcess}
        error={startProcessError}
        sdk={sdk}
        uploadedFile={uploadedFile}
        setUploadedFile={setUploadedFile}
      />
    </div>
  );
};
