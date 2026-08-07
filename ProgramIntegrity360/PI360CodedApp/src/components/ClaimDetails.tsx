import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProcessedClaim } from '../hooks/useClaims';
import { DocumentViewer } from './ui/DocumentViewer';
import { ClaimsChatPanel } from './ClaimsChatPanel';
import { useAuth } from '../hooks/useAuth';
import { createClaimComment, fetchClaimComments, type ClaimComment } from '../services/commentsEntity';
import { buildMaestroProcessUrl, portalOriginFromApiBase } from '../services/uipath/cloudLinks';

type UiPathTaskStatus = 'Unassigned' | 'Pending' | 'Completed';

interface EmbeddedTaskInfo {
  id: number;
  folderId?: number;
  title: string;
  status: UiPathTaskStatus;
  type?: string;
}

interface ClaimDetailsProps {
  selectedClaim: ProcessedClaim | null;
  sdk: any; // UiPath SDK instance
  onBack: () => void;
  onRefresh?: () => void;
}

interface HitlTaskArguments {
  Summary?: string;
  EligibilityStatus?: boolean;
  Calculation?: string;
  Fraud_Residency_Risk?: string;
  Fraud_Residency_Explanation?: string;
  Fraud_Income_Risk?: string;
  Fraud_Income_Explanation?: string;
  filename?: string;
  Fraud_Income_Percent?: number;
}

type VerificationBadgeState = 'verified' | 'manual-review' | 'not-verified' | 'loading';

function parseTaskIdFromLink(taskUrl: string): number | null {
  try {
    const url = new URL(taskUrl);
    const match = url.pathname.match(/\/tasks\/(\d+)(?:\/)?$/);

    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function parseFolderId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function findTaskLinkFromCaseExecutionHistory(executionHistory: any): string | null {
  const elementExecutions = Array.isArray(executionHistory?.elementExecutions)
    ? executionHistory.elementExecutions
    : [];

  const matchingExecution = elementExecutions.find((item: any) =>
    item.elementName === 'Case Worker Review' && item.externalLink
  ) || elementExecutions.find((item: any) => item.externalLink);

  return typeof matchingExecution?.externalLink === 'string'
    ? matchingExecution.externalLink
    : null;
}

function findTaskLinkFromProcessExecutionHistory(executionHistory: any): string | null {
  const historyItems = Array.isArray(executionHistory)
    ? executionHistory
    : executionHistory?.items || [];

  const matchingHistoryItem = historyItems.find((item: any) =>
    item.name === 'Case Worker Review' && item.attributes?.actionCenterTaskLink
  ) || historyItems.find((item: any) => item.attributes?.actionCenterTaskLink);

  return typeof matchingHistoryItem?.attributes?.actionCenterTaskLink === 'string'
    ? matchingHistoryItem.attributes.actionCenterTaskLink
    : null;
}

function getPortalOrigin(): string {
  return portalOriginFromApiBase(import.meta.env.VITE_UIPATH_BASE_URL);
}

function buildTaskLink(taskId: number, organizationId: string, tenantName: string): string {
  return `${getPortalOrigin()}/${organizationId}/${tenantName}/actions_/tasks/${taskId}`;
}

function normalizeTaskStatus(value: unknown): UiPathTaskStatus {
  if (typeof value !== 'string') {
    return 'Pending';
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'completed') {
    return 'Completed';
  }

  if (normalized === 'unassigned') {
    return 'Unassigned';
  }

  return 'Pending';
}

function isProceedOutcome(value?: string): boolean {
  return value?.trim().toLowerCase() === 'proceed';
}

function isValidIncomeOutcome(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'valid' || normalized === 'proceed';
}

function getVerificationBadgeState(params: {
  actualVerified: boolean;
  agentVerified: boolean;
  reviewCompleted: boolean;
  agentDeterminationAvailable: boolean;
}): VerificationBadgeState {
  const { actualVerified, agentVerified, reviewCompleted, agentDeterminationAvailable } = params;

  if (actualVerified || agentVerified) {
    return 'verified';
  }

  if (reviewCompleted) {
    return 'manual-review';
  }

  if (!agentDeterminationAvailable) {
    return 'loading';
  }

  return 'not-verified';
}

function renderVerificationBadge(state: VerificationBadgeState) {
  if (state === 'loading') {
    return (
      <>
        <svg className="w-5 h-5 text-gray-400 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span className="text-sm text-gray-500 font-medium">Pending Verification</span>
      </>
    );
  }

  if (state === 'verified') {
    return (
      <>
        <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm text-green-700 font-medium">Verified</span>
      </>
    );
  }

  if (state === 'manual-review') {
    return (
      <>
        <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.487 0l6.518 11.596c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-6a1 1 0 00-1 1v3a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm text-yellow-700 font-medium">Manually Reviewed</span>
      </>
    );
  }

  return (
    <>
      <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-sm text-red-700 font-medium">Not Verified</span>
    </>
  );
}

function extractFinalBenefitAmount(calculation?: string): string | null {
  if (!calculation) {
    return null;
  }

  const finalAmountMatch = calculation.match(/Final benefit amount\s*=\s*.*?=\s*(\$[\d,]+(?:\.\d{1,2})?)/i);
  return finalAmountMatch ? finalAmountMatch[1] : null;
}

function getVerificationDisplayLabel(value?: string): string {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'needs_review') {
    return 'Requires Review';
  }

  return value || '';
}

function getVerificationDisplayClasses(value?: string): string {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'proceed' || normalized === 'valid') {
    return 'bg-green-100 text-green-800';
  }

  if (normalized === 'needs_review') {
    return 'bg-yellow-100 text-yellow-800';
  }

  return 'bg-red-100 text-red-800';
}

export const ClaimDetails = ({ selectedClaim, sdk, onBack, onRefresh }: ClaimDetailsProps) => {
  const { currentUserEmail, currentUserName } = useAuth();
  const [variablesData, setVariablesData] = useState<any>(null);
  const [variablesError, setVariablesError] = useState<string | null>(null);
  const [executionHistoryNotice, setExecutionHistoryNotice] = useState<string | null>(null);
  const [hitlData, setHitlData] = useState<HitlTaskArguments | null>(null);
  const [taskLink, setTaskLink] = useState<string | null>(null);
  const [taskInfo, setTaskInfo] = useState<EmbeddedTaskInfo | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskCompletionNotice, setTaskCompletionNotice] = useState<string | null>(null);
  const [isTaskPopupOpen, setIsTaskPopupOpen] = useState(false);
  const [isLoadingExecution, setIsLoadingExecution] = useState(false);
  const [activeDocumentTab, setActiveDocumentTab] = useState<'application' | 'id' | 'paystub'>('application');
  const [comments, setComments] = useState<ClaimComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<{
    application?: string;
    id?: string;
    paystub?: string;
  }>({});
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [multiViewMode, setMultiViewMode] = useState(false);
  const [selectedDocumentTabs, setSelectedDocumentTabs] = useState<('application' | 'id' | 'paystub')[]>(['application']);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const showDebugBox = import.meta.env.VITE_SHOW_DEBUG_BOX === 'true';

  // Use the live Maestro process key and folder key for deeplinks.
  const PROCESS_KEY = import.meta.env.VITE_MAESTRO_PROCESS_KEY || 'd0d245fb-a685-4784-9320-5de1601d3463';
  const DEFAULT_FOLDER_KEY = import.meta.env.VITE_MAESTRO_FOLDER_KEY || '5db31dd1-1073-4f9e-b44b-76f5484e03c4';

  // Open Maestro process in new tab
  const openMaestroProcess = () => {
    if (!selectedClaim) return;

    const maestroKey = selectedClaim.rawData.maestroProcessInstanceKey;
    const folderId = selectedClaim.rawData.FolderId;
    const folderKey = typeof folderId === 'string' && folderId.includes('-')
      ? folderId
      : DEFAULT_FOLDER_KEY;

    if (!maestroKey || !folderKey) {
      console.error('Missing maestroProcessInstanceKey or FolderId');
      return;
    }

    const url = buildMaestroProcessUrl({
      folderKey,
      instanceKey: maestroKey,
      organizationName: 'uipathlabs',
      portalOrigin: getPortalOrigin(),
      processKey: PROCESS_KEY,
      tenantName: 'Playground',
    });
    window.open(url, '_blank');
  };

  // Document bucket and folder configuration
  const APPLICATION_BUCKET_ID = 56094;
  const APPLICATION_FOLDER_ID = 2336471;
  const APPLICATION_FILE_NAME = 'Adrian-MO.pdf';

  const PAYSTUB_BUCKET_ID = 82886;
  const PAYSTUB_FOLDER_ID = 2336471;
  const PAYSTUB_FILE_NAME = 'Paystub_Adrian.jpg';

  const ID_BUCKET_ID = 82528;
  const ID_FOLDER_ID = 2336471;
  const ID_FILE_NAME = 'DL_Adrian.jpg';

  const handleTaskCompleted = () => {
    setTaskInfo((currentTask) => currentTask
      ? { ...currentTask, status: 'Completed' }
      : currentTask
    );
    setIsTaskPopupOpen(false);
    setTaskCompletionNotice('Review completed. Refreshing claim data in 5 seconds...');

    window.setTimeout(() => {
      onRefresh?.();
      setTaskCompletionNotice(null);
    }, 5000);
  };

  // Fetch execution history automatically when a claim is selected
  useEffect(() => {
    if (!selectedClaim?.rawData?.maestroProcessInstanceKey || !selectedClaim?.rawData?.FolderId) {
      // Clear previous data
      setHitlData(null);
      setTaskLink(null);
      setTaskInfo(null);
      setTaskError(null);
      setTaskCompletionNotice(null);
      setVariablesData(null);
      setVariablesError(null);
      setExecutionHistoryNotice(null);
      return;
    }

    const fetchExecutionHistory = async () => {
      try {
        setIsLoadingExecution(true);
        setVariablesError(null);
        setExecutionHistoryNotice(null);
        setHitlData(null);
        setTaskLink(null);
        setTaskInfo(null);
        setTaskError(null);

        let resolvedTaskLink: string | null = null;
        let resolvedTaskInfo: EmbeddedTaskInfo | null = null;

        let organizationId: string | null = null;

        try {
          const caseExecutionHistory = await sdk.maestro.cases.instances.getExecutionHistory(
            selectedClaim.rawData.maestroProcessInstanceKey,
            selectedClaim.rawData.FolderId
          );

          console.log('Case execution history:', caseExecutionHistory);
          organizationId = typeof caseExecutionHistory?.organizationId === 'string'
            ? caseExecutionHistory.organizationId
            : null;
          resolvedTaskLink = findTaskLinkFromCaseExecutionHistory(caseExecutionHistory);
        } catch (caseHistoryError) {
          console.warn('Case execution history unavailable for selected claim:', caseHistoryError);
        }

        if (!resolvedTaskLink) {
          try {
            const caseTasksResponse = await sdk.maestro.cases.instances.getActionTasks(
              selectedClaim.rawData.maestroProcessInstanceKey
            );

            console.log('Case action tasks:', caseTasksResponse);

            const caseTasks = Array.isArray(caseTasksResponse)
              ? caseTasksResponse
              : caseTasksResponse?.items || [];

            const pendingTask = caseTasks.find((task: any) => task.status !== 'Completed') || caseTasks[0];

            if (pendingTask?.id && organizationId) {
              resolvedTaskInfo = {
                id: pendingTask.id,
                folderId: typeof pendingTask.folderId === 'number' ? pendingTask.folderId : undefined,
                title: pendingTask.title || 'Review task',
                status: normalizeTaskStatus(pendingTask.status),
                type: pendingTask.type,
              };
              resolvedTaskLink = buildTaskLink(
                pendingTask.id,
                organizationId,
                import.meta.env.VITE_UIPATH_TENANT_NAME || 'Playground'
              );
            }
          } catch (caseTasksError) {
            console.warn('Case action tasks unavailable for selected claim:', caseTasksError);
          }
        }

        if (!resolvedTaskLink) {
          try {
            const processExecutionHistory = await sdk.maestro.processes.instances.getExecutionHistory(
              selectedClaim.rawData.maestroProcessInstanceKey,
              selectedClaim.rawData.FolderId
            );

            console.log('Process execution history:', processExecutionHistory);
            resolvedTaskLink = findTaskLinkFromProcessExecutionHistory(processExecutionHistory);
          } catch (processHistoryError) {
            console.warn('Process execution history unavailable for selected claim:', processHistoryError);
          }
        }

        if (resolvedTaskLink) {
          console.log('Found task link:', resolvedTaskLink);
          setTaskLink(resolvedTaskLink);

          if (resolvedTaskInfo) {
            setTaskInfo(resolvedTaskInfo);
          }

          const taskId = parseTaskIdFromLink(resolvedTaskLink);
          const folderId = parseFolderId(selectedClaim.rawData.FolderId);

          if (!taskId || !folderId) {
            if (!resolvedTaskInfo) {
              setTaskError('Unable to resolve task details for this review.');
            }
          } else {
            try {
              const task = await sdk.tasks.getById(taskId, undefined, folderId);
              setTaskInfo({
                id: task.id,
                folderId: task.folderId,
                title: task.title,
                status: normalizeTaskStatus(task.status),
                type: task.type,
              });
            } catch (taskFetchError) {
              console.warn('Failed to fetch task metadata:', taskFetchError);
              if (!resolvedTaskInfo) {
                setTaskError(taskFetchError instanceof Error ? taskFetchError.message : 'Failed to load review task metadata');
              }
            }
          }
        } else {
          setExecutionHistoryNotice('No Action Center task link was returned for this case instance, but AI review data may still be shown.');
        }

        // Fetch variables to get HITL data
        const variables = await sdk.maestro.processes.instances.getVariables(
          selectedClaim.rawData.maestroProcessInstanceKey,
          selectedClaim.rawData.FolderId
        );
        console.log('Maestro variables response:', variables);

        // Extract HITL task arguments from variables
        // The response has an 'elements' array where we need to find the Activity_PeUITb element
        if (variables?.elements && Array.isArray(variables.elements)) {
          const hitlElement = variables.elements.find((element: any) =>
            element.elementId === 'Activity_PeUITb' && element.inputs?.HitlTaskArguments
          );

          if (hitlElement && hitlElement.inputs?.HitlTaskArguments) {
            console.log('Found HITL data in variables:', hitlElement.inputs.HitlTaskArguments);
            setHitlData(hitlElement.inputs.HitlTaskArguments);
          } else {
            console.log('No HitlTaskArguments found in variables elements');
          }
        } else {
          console.log('No elements array found in variables response');
        }

        // Store variables for debug panel if enabled
        if (showDebugBox) {
          setVariablesData(variables);
        }
      } catch (err) {
        console.error('Error fetching process data:', err);
        setVariablesError(err instanceof Error ? err.message : 'Failed to fetch process data');
      } finally {
        setIsLoadingExecution(false);
      }
    };

    fetchExecutionHistory();
  }, [selectedClaim, sdk, showDebugBox]);

  // Fetch document URLs
  const fetchDocumentUrls = async () => {
    if (!selectedClaim) return;

    try {
      setLoadingDocuments(true);
      setDocumentError(null);

      // Fetch all three document URLs
      const [applicationUrl, paystubUrl, idUrl] = await Promise.all([
        sdk.buckets.getReadUri({
          bucketId: APPLICATION_BUCKET_ID,
          folderId: APPLICATION_FOLDER_ID,
          path: `/${APPLICATION_FILE_NAME}`,
        }),
        sdk.buckets.getReadUri({
          bucketId: PAYSTUB_BUCKET_ID,
          folderId: PAYSTUB_FOLDER_ID,
          path: `/${PAYSTUB_FILE_NAME}`,
        }),
        sdk.buckets.getReadUri({
          bucketId: ID_BUCKET_ID,
          folderId: ID_FOLDER_ID,
          path: `/${ID_FILE_NAME}`,
        }),
      ]);

      console.log('Document fetch responses:');
      console.log('applicationUrl response:', applicationUrl);
      console.log('paystubUrl response:', paystubUrl);
      console.log('idUrl response:', idUrl);

      // Handle both uppercase Uri and lowercase uri for backwards compatibility
      const getUri = (response: any) => response.Uri || response.uri;

      const applicationUri = getUri(applicationUrl);
      const paystubUri = getUri(paystubUrl);
      const idUri = getUri(idUrl);

      console.log('Extracted URIs:');
      console.log('application URI:', applicationUri);
      console.log('paystub URI:', paystubUri);
      console.log('id URI:', idUri);

      setDocumentUrls({
        application: applicationUri,
        paystub: paystubUri,
        id: idUri,
      });

      console.log('Document URLs set successfully:', {
        application: applicationUri,
        paystub: paystubUri,
        id: idUri,
      });
    } catch (err) {
      console.error('Error fetching document URLs:', err);
      setDocumentError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Fetch documents when a claim is selected (not when tabs are clicked)
  useEffect(() => {
    if (selectedClaim) {
      fetchDocumentUrls();
    }
  }, [selectedClaim]);

  // Helper function to convert taskLink to embed format
  const convertToEmbedUrl = (taskLink: string): string => {
    const url = new URL(taskLink);
    const pathParts = url.pathname.split('/').filter(part => part.length > 0);

    const orgId = pathParts[0];
    const tenantId = pathParts[1];

    const actionsIndex = pathParts.findIndex(part => part === 'actions_');
    const remainingPath = actionsIndex !== -1 ? pathParts.slice(actionsIndex).join('/') : pathParts.slice(2).join('/');

    const pathWithCurrentTask = remainingPath.replace('actions_/tasks', 'actions_/current-task/tasks');

    const embedPath = `/embed_/${orgId}/${tenantId}/${pathWithCurrentTask}`;

    return `${url.origin}${embedPath}`;
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTaskPopupOpen) {
        setIsTaskPopupOpen(false);
      }
    };

    if (isTaskPopupOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isTaskPopupOpen]);

  useEffect(() => {
    if (!isTaskPopupOpen || !taskInfo || taskInfo.status === 'Completed' || !taskInfo.folderId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const latestTask = await sdk.tasks.getById(taskInfo.id, undefined, taskInfo.folderId);

        setTaskInfo({
          id: latestTask.id,
          folderId: latestTask.folderId,
          title: latestTask.title,
          status: latestTask.status,
          type: latestTask.type,
        });

        if (latestTask.status === 'Completed') {
          handleTaskCompleted();
        }
      } catch (pollError) {
        console.warn('Failed to poll review task status:', pollError);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isTaskPopupOpen, sdk, taskInfo]);

  useEffect(() => {
    if (!selectedClaim) {
      setComments([]);
      setCommentsError(null);
      return;
    }

    const loadComments = async () => {
      try {
        setIsLoadingComments(true);
        setCommentsError(null);
        const loadedComments = await fetchClaimComments(sdk, selectedClaim.id);
        setComments(loadedComments);
      } catch (error) {
        console.error('Failed to load comments:', error);
        setComments([]);
        setCommentsError(error instanceof Error ? error.message : 'Failed to load comments');
      } finally {
        setIsLoadingComments(false);
      }
    };

    void loadComments();
  }, [sdk, selectedClaim]);

  const handleAddComment = async () => {
    if (!selectedClaim || !newComment.trim()) {
      return;
    }

    try {
      setIsSavingComment(true);
      setCommentsError(null);
      const createdComment = await createClaimComment({
        sdk,
        claimId: selectedClaim.id,
        text: newComment.trim(),
        currentUserEmail,
        currentUserName,
      });
      setComments((currentComments) => [createdComment, ...currentComments]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to save comment:', error);
      setCommentsError(error instanceof Error ? error.message : 'Failed to save comment');
    } finally {
      setIsSavingComment(false);
    }
  };

  // Empty state - no claim selected
  if (!selectedClaim) {
    return (
      <div className="bg-white shadow rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center h-full text-center">
          <div className="max-w-md mx-auto">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6">
              <svg className="w-16 h-16 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Claim Details</h3>
            <p className="text-gray-500 leading-relaxed">Select a claim from the grid to view detailed information and process data.</p>
          </div>
        </div>
      </div>
    );
  }

  const hasProcessInstance = selectedClaim.rawData?.maestroProcessInstanceKey && selectedClaim.rawData?.FolderId;
  const canCompleteReview = Boolean(taskLink);
  const isReviewCompleted = taskInfo?.status === 'Completed';
  const isResidencyVerifiedByAgent = isProceedOutcome(hitlData?.Fraud_Residency_Risk);
  const isIncomeVerifiedByAgent = isValidIncomeOutcome(hitlData?.Fraud_Income_Risk);
  const hasResidencyDetermination = typeof hitlData?.Fraud_Residency_Risk === 'string';
  const hasIncomeDetermination = typeof hitlData?.Fraud_Income_Risk === 'string';
  const addressVerificationState = getVerificationBadgeState({
    actualVerified: selectedClaim.addressVerifiedFlag,
    agentVerified: isResidencyVerifiedByAgent,
    reviewCompleted: isReviewCompleted,
    agentDeterminationAvailable: !hasProcessInstance ? true : isLoadingExecution ? false : hasResidencyDetermination,
  });
  const incomeVerificationState = getVerificationBadgeState({
    actualVerified: selectedClaim.incomeVerifiedFlag,
    agentVerified: isIncomeVerifiedByAgent,
    reviewCompleted: isReviewCompleted,
    agentDeterminationAvailable: !hasProcessInstance ? true : isLoadingExecution ? false : hasIncomeDetermination,
  });
  const finalBenefitAmount = extractFinalBenefitAmount(hitlData?.Calculation);

  return (
    <>
      <div className="h-full overflow-y-auto bg-gray-50">
        {/* Breadcrumb Navigation */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <span>Claims Dashboard</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">{selectedClaim.applicantName}</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedClaim.applicantName}</h1>
              <p className="text-sm text-gray-500 mt-1">Claim ID: {selectedClaim.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${
                  selectedClaim.eligibilityStatus === 'Approved'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : selectedClaim.eligibilityStatus === 'Denied'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : selectedClaim.eligibilityStatus === 'Pending'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                }`}
              >
                {selectedClaim.eligibilityStatus}
              </span>
              {canCompleteReview && !isReviewCompleted && (
                <button
                  onClick={() => setIsTaskPopupOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                  title={taskInfo?.title || 'Open review task'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Complete Review
                </button>
              )}
              {selectedClaim.rawData.maestroProcessInstanceKey && selectedClaim.rawData.FolderId && (
                <button
                  onClick={openMaestroProcess}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                  title="Open in Maestro"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Maestro
                </button>
              )}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 hover:text-orange-900 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                  title="Refresh Data"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
              <button
                onClick={() => setIsChatOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                title="Open Claims Assistant"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Ask AI
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Top Row: Key Details Card (Left) + AI Summary Card (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Details Card */}
            {/* Key Details Card */}
            <div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Applicant Details</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                    <p className="text-sm text-gray-900">
                      {selectedClaim.applicantName.toLowerCase().replace(/\s+/g, '.') + '@gmail.com'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Phone Number</h4>
                    <p className="text-sm text-gray-900">
                      {(() => {
                        const hash = selectedClaim.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const areaCode = 200 + (hash % 800);
                        const exchange = 200 + ((hash * 7) % 800);
                        const line = 1000 + ((hash * 13) % 9000);
                        return `(${areaCode}) ${exchange}-${line}`;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Address */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Address</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-900">
                      {selectedClaim.rawData?.AddressLine1 || 'No address provided'}
                    </p>
                    <p className="text-sm text-gray-900">
                      {(() => {
                        const hash = selectedClaim.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const cities = ['Springfield', 'Riverside', 'Oakland', 'Madison', 'Georgetown', 'Salem', 'Franklin', 'Clinton', 'Arlington', 'Fairview'];
                        const states = ['CA', 'NY', 'TX', 'FL', 'MO', 'IL', 'PA', 'OH', 'GA', 'NC'];
                        const city = cities[hash % cities.length];
                        const state = states[hash % states.length];
                        const zip = 10000 + (hash % 90000);
                        return `${city}, ${state} ${zip}`;
                      })()}
                    </p>
                  </div>
                </div>


                {/* Financial Information */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {selectedClaim.rawData?.ApplicantIncomeText && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Reported Income (Monthly)</h4>
                      <p className="text-sm text-gray-900 font-semibold">
                        ${parseFloat(selectedClaim.rawData.ApplicantIncomeText).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedClaim.rawData?.BenefitAmountMonthly && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Benefit Amount (Monthly)</h4>
                      <p className="text-sm text-green-700 font-semibold">
                        ${parseFloat(selectedClaim.rawData.BenefitAmountMonthly.toString()).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedClaim.rawData?.ApplicantHouseholdSize && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Household Size</h4>
                      <p className="text-sm text-gray-900">{selectedClaim.rawData.ApplicantHouseholdSize}</p>
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Application Created</h4>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedClaim.applicationCreationTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {selectedClaim.rawData?.UpdateTime && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Last Updated</h4>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedClaim.rawData.UpdateTime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}
                  {selectedClaim.rawData?.BenefitStartDate && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Benefits Start Date</h4>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedClaim.rawData.BenefitStartDate.replace(/"/g, '')).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                  {selectedClaim.rawData?.BenefitEndDate && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Benefits End Date</h4>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedClaim.rawData.BenefitEndDate.replace(/"/g, '')).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                  </div>
                  
                {/* Status and Verification */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Eligibility Status</h4>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        selectedClaim.eligibilityStatus === 'Approved'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : selectedClaim.eligibilityStatus === 'Denied'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : selectedClaim.eligibilityStatus === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}
                    >
                      {selectedClaim.eligibilityStatus}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Caseworker</h4>
                    <p className="text-sm text-gray-900">{selectedClaim.caseWorkerName}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Address Verified</h4>
                    <div className="flex items-center">
                      {renderVerificationBadge(addressVerificationState)}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Income Verified</h4>
                    <div className="flex items-center">
                      {renderVerificationBadge(incomeVerificationState)}
                    </div>
                  </div>
                </div>

                {/* Eligibility Reason */}
                {selectedClaim.rawData?.EligibilityReason && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Eligibility Reason</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedClaim.rawData.EligibilityReason}</p>
                  </div>
                )}
              </div>
              </div>
                 {/* Documents Card - Normal Mode (Left Column) */}
            {!multiViewMode && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                <button
                  onClick={() => {
                    setMultiViewMode(true);
                    setSelectedDocumentTabs(['application', 'id', 'paystub']);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
                  title="Enable Multi-View Mode"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Multi-View
                </button>
              </div>

              {/* Document Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveDocumentTab('application')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeDocumentTab === 'application'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Application
                  </button>
                  <button
                    onClick={() => setActiveDocumentTab('id')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeDocumentTab === 'id'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    ID Document
                  </button>
                  <button
                    onClick={() => setActiveDocumentTab('paystub')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeDocumentTab === 'paystub'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Paystub
                  </button>
                </div>
              </div>

              {/* Document Viewer */}
              <div className="p-6">
                {loadingDocuments && (
                  <div className="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm text-gray-600">Loading document...</p>
                    </div>
                  </div>
                )}

                {documentError && !loadingDocuments && (
                  <div className="bg-red-50 rounded-lg border-2 border-red-200 p-8 text-center">
                    <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h4 className="text-lg font-semibold text-red-700 mb-2">Error Loading Document</h4>
                    <p className="text-sm text-red-600">{documentError}</p>
                  </div>
                )}

                {!loadingDocuments && !documentError && documentUrls[activeDocumentTab] && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {activeDocumentTab === 'application' && documentUrls.application && (
                      <DocumentViewer
                        documentUrl={documentUrls.application}
                        loading={loadingDocuments}
                        error={documentError}
                        title="Application Document"
                        subtitle="View Application PDF"
                      />
                    )}
                    {activeDocumentTab === 'id' && documentUrls.id && (
                      <img
                        src={documentUrls.id}
                        alt="ID Document"
                        className="w-full h-auto"
                      />
                    )}
                    {activeDocumentTab === 'paystub' && documentUrls.paystub && (
                      <img
                        src={documentUrls.paystub}
                        alt="Paystub Document"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                )}

                {!loadingDocuments && !documentError && !documentUrls[activeDocumentTab] && (
                  <div className="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">
                      {activeDocumentTab === 'application' && 'Application Form'}
                      {activeDocumentTab === 'id' && 'ID Document'}
                      {activeDocumentTab === 'paystub' && 'Income Paystub'}
                    </h4>
                    <p className="text-sm text-gray-500">No document available</p>
                  </div>
                )}
              </div>
            </div>
            )}
            </div>
            {/* AI Summary Card */}
            <div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <button
                onClick={() => setMultiViewMode(false)}
                className={`w-full px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 flex justify-between items-center ${multiViewMode ? 'hover:bg-purple-100 cursor-pointer' : ''}`}
              >
                <h2 className="text-lg font-semibold text-gray-900">AI Agent Review</h2>
                {multiViewMode && (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

            
              <div className="p-6 bg-gradient-to-br from-purple-50/30 to-indigo-50/30">
                {isLoadingExecution ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
                      <p className="text-gray-600 text-sm">Loading AI review...</p>
                    </div>
                  </div>
                ) : variablesError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="font-semibold text-red-800 text-sm">Error Loading AI Review</p>
                    <p className="text-sm text-red-700 mt-1">{variablesError}</p>
                  </div>
                ) : hitlData ? (
                  <div className="space-y-4">
                    {executionHistoryNotice && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="font-semibold text-amber-800 text-sm">Execution History Unavailable</p>
                        <p className="text-sm text-amber-700 mt-1">{executionHistoryNotice}</p>
                      </div>
                    )}
                    {/* Summary */}
                    {hitlData.Summary && (
                      <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Summary</h4>
                        <p className="text-sm text-gray-900 leading-relaxed">{hitlData.Summary}</p>
                      </div>
                    )}

                    {/* Eligibility and Calculation */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Eligibility</h4>
                        <div className="flex items-center">
                          {hitlData.EligibilityStatus ? (
                            <>
                              <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-medium text-green-700">Eligible</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-medium text-red-700">Not Eligible</span>
                            </>
                          )}
                        </div>
                      </div>
                      {hitlData.Calculation && (
                        <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Benefit Amount</h4>
                          {finalBenefitAmount && (
                            <p className="text-lg font-bold text-blue-700 mb-2">{finalBenefitAmount}</p>
                          )}
                          <p className="text-sm text-gray-900 leading-relaxed">{hitlData.Calculation}</p>
                        </div>
                      )}
                    </div>

                    {/* Fraud Assessment */}
                    {(hitlData.Fraud_Residency_Risk || hitlData.Fraud_Income_Risk) && (
                      <div className="space-y-3">
                        {hitlData.Fraud_Residency_Risk && (
                          <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-gray-700">Residency Verification</h4>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getVerificationDisplayClasses(hitlData.Fraud_Residency_Risk)}`}>
                                {getVerificationDisplayLabel(hitlData.Fraud_Residency_Risk)}
                              </span>
                            </div>
                            {hitlData.Fraud_Residency_Explanation && (
                              <p className="text-sm text-gray-700 leading-relaxed">{hitlData.Fraud_Residency_Explanation}</p>
                            )}
                          </div>
                        )}

                        {hitlData.Fraud_Income_Risk && (
                          <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-gray-700">Income Verification</h4>
                              <div className="flex items-center gap-2">
                                {hitlData.Fraud_Income_Percent !== undefined && hitlData.Fraud_Income_Percent !== 0 && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    {hitlData.Fraud_Income_Percent}% variance
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getVerificationDisplayClasses(hitlData.Fraud_Income_Risk)}`}>
                                  {getVerificationDisplayLabel(hitlData.Fraud_Income_Risk)}
                                </span>
                              </div>
                            </div>
                            {hitlData.Fraud_Income_Explanation && (
                              <p className="text-sm text-gray-700 leading-relaxed">{hitlData.Fraud_Income_Explanation}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Source Document */}
                    {hitlData.filename && (
                      <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Source: {hitlData.filename}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-blue-900 text-sm">No AI Review Available</h4>
                      <p className="text-blue-700 text-xs">AI review data not yet generated</p>
                    </div>
                  </div>
                )}
              </div>
              
              </div>
               {/* Comments Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
              <button
                onClick={() => setMultiViewMode(false)}
                className={`w-full px-6 py-4 border-b border-gray-200 flex justify-between items-center ${multiViewMode ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
              >
                <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
                {multiViewMode && (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {!multiViewMode && (
              <div className="p-6">
                {/* Comments List */}
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {isLoadingComments && (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin mr-3"></div>
                      Loading comments...
                    </div>
                  )}
                  {commentsError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                      {commentsError}
                    </div>
                  )}
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">{comment.author}</span>
                        <span className="text-xs text-gray-500">{comment.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                    </div>
                  ))}
                  {!isLoadingComments && comments.length === 0 && !commentsError && (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-500">No comments yet</p>
                    </div>
                  )}
                </div>

                {/* Add Comment Form */}
                <div className="border-t pt-4">
                  <label htmlFor="new-comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Add Comment
                  </label>
                  <textarea
                    id="new-comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                    placeholder="Enter your comment..."
                    disabled={isSavingComment}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isSavingComment}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingComment ? 'Saving...' : 'Add Comment'}
                    </button>
                  </div>
                </div>
              </div>
              )}
            </div>
</div>

          </div>

          {/* Multi-View Documents Card - Full Width Below Grid */}
          {multiViewMode && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                <button
                  onClick={() => {
                    setMultiViewMode(false);
                    setActiveDocumentTab(selectedDocumentTabs[0] || 'application');
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-orange-100 text-orange-800 hover:bg-orange-200"
                  title="Disable Multi-View Mode"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Multi-View Active
                </button>
              </div>

              {/* Document Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => {
                      if (selectedDocumentTabs.includes('application')) {
                        if (selectedDocumentTabs.length > 1) {
                          setSelectedDocumentTabs(selectedDocumentTabs.filter(t => t !== 'application'));
                        }
                      } else {
                        if (selectedDocumentTabs.length < 3) {
                          setSelectedDocumentTabs([...selectedDocumentTabs, 'application']);
                        }
                      }
                    }}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      selectedDocumentTabs.includes('application')
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Application
                  </button>
                  <button
                    onClick={() => {
                      if (selectedDocumentTabs.includes('id')) {
                        if (selectedDocumentTabs.length > 1) {
                          setSelectedDocumentTabs(selectedDocumentTabs.filter(t => t !== 'id'));
                        }
                      } else {
                        if (selectedDocumentTabs.length < 3) {
                          setSelectedDocumentTabs([...selectedDocumentTabs, 'id']);
                        }
                      }
                    }}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      selectedDocumentTabs.includes('id')
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    ID Document
                  </button>
                  <button
                    onClick={() => {
                      if (selectedDocumentTabs.includes('paystub')) {
                        if (selectedDocumentTabs.length > 1) {
                          setSelectedDocumentTabs(selectedDocumentTabs.filter(t => t !== 'paystub'));
                        }
                      } else {
                        if (selectedDocumentTabs.length < 3) {
                          setSelectedDocumentTabs([...selectedDocumentTabs, 'paystub']);
                        }
                      }
                    }}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      selectedDocumentTabs.includes('paystub')
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Paystub
                  </button>
                </div>
              </div>

              {/* Document Viewer - Multi-Column Layout */}
              <div className="p-6 flex gap-4">
                {selectedDocumentTabs.map((tabId) => (
                  <div
                    key={tabId}
                    className="flex-1 min-w-0"
                  >
                    {loadingDocuments && (
                      <div className="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                          <p className="text-sm text-gray-600">Loading document...</p>
                        </div>
                      </div>
                    )}

                    {documentError && !loadingDocuments && (
                      <div className="bg-red-50 rounded-lg border-2 border-red-200 p-8 text-center">
                        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h4 className="text-lg font-semibold text-red-700 mb-2">Error Loading Document</h4>
                        <p className="text-sm text-red-600">{documentError}</p>
                      </div>
                    )}

                    {!loadingDocuments && !documentError && documentUrls[tabId] && (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {tabId === 'application' && documentUrls.application && (
                          <DocumentViewer
                            documentUrl={documentUrls.application}
                            loading={loadingDocuments}
                            error={documentError}
                            title="Application Document"
                            subtitle="View Application PDF"
                          />
                        )}
                        {tabId === 'id' && documentUrls.id && (
                          <img
                            src={documentUrls.id}
                            alt="ID Document"
                            className="w-full h-auto"
                          />
                        )}
                        {tabId === 'paystub' && documentUrls.paystub && (
                          <img
                            src={documentUrls.paystub}
                            alt="Paystub Document"
                            className="w-full h-auto"
                          />
                        )}
                      </div>
                    )}

                    {!loadingDocuments && !documentError && !documentUrls[tabId] && (
                      <div className="bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h4 className="text-lg font-semibold text-gray-700 mb-2">
                          {tabId === 'application' && 'Application Form'}
                          {tabId === 'id' && 'ID Document'}
                          {tabId === 'paystub' && 'Income Paystub'}
                        </h4>
                        <p className="text-sm text-gray-500">No document available</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Box */}
          {showDebugBox && variablesData && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug: Maestro Process Data</h3>
                  <div className="text-xs font-mono space-y-1 mb-3">
                    <div className="flex gap-2">
                      <span className="text-yellow-700 font-semibold">Process Key:</span>
                      <span className="text-yellow-900">{selectedClaim.rawData?.maestroProcessInstanceKey || 'Not set'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-yellow-700 font-semibold">Folder ID:</span>
                      <span className="text-yellow-900">{selectedClaim.rawData?.FolderId || 'Not set'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-yellow-800 font-semibold">Maestro Process Variables</p>
                    <button
                      onClick={() => setVariablesData(null)}
                      className="text-yellow-600 hover:text-yellow-800 text-xs font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="bg-yellow-100 border border-yellow-300 rounded p-3 max-h-96 overflow-auto">
                    <pre className="text-xs text-yellow-900 whitespace-pre-wrap break-words">
                      {JSON.stringify(variablesData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Process Instance Message */}
          {!hasProcessInstance && (
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900">No Process Instance</h4>
                <p className="text-blue-700 text-sm">This claim does not have an associated Maestro process instance</p>
              </div>
            </div>
          )}

          {taskError && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="p-2 bg-amber-100 rounded-lg">
                <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M10.29 3.86l-7.58 13.14A1 1 0 003.58 18h16.84a1 1 0 00.87-1.5L13.71 3.86a1 1 0 00-1.74 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-amber-900">Review Task Unavailable</h4>
                <p className="text-amber-800 text-sm">{taskError}</p>
              </div>
            </div>
          )}

          {taskCompletionNotice && (
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-green-900">Review Completed</h4>
                <p className="text-green-800 text-sm">{taskCompletionNotice}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Popup */}
      {isTaskPopupOpen && taskLink &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={() => setIsTaskPopupOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-2xl w-[90vw] h-[95vh] flex flex-col animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Complete Review</h3>
                  {taskInfo && (
                    <p className="text-sm text-gray-500 mt-1">
                      Task #{taskInfo.id} · {taskInfo.status}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsTaskPopupOpen(false);
                    onRefresh?.();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200"
                  aria-label="Close modal (ESC)"
                  title="Close (ESC)"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 p-4 rounded-b-lg">
                <iframe
                  src={convertToEmbedUrl(taskLink)}
                  className="w-full h-full rounded border-0"
                  title="Task Details"
                />
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Claims Assistant Chat Drawer */}
      <ClaimsChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        claim={selectedClaim}
      />
    </>
  );
};
