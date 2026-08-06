import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

// Raw record shape as returned by the Data Fabric entity.
// The API uses ProperCase keys (e.g. AddressLine1, ApplicantFullName, CreateTime).
// Keep these names exactly as they come from the API so TypeScript matches reality.
export interface ClaimData {
  maestroProcessInstanceKey?: string;

  FolderId?: string;

  AddressLine1?: string;
  AddressVerifiedFlag?: boolean;
  IncomeVerifiedFlag?: boolean;

  ApplicationSubmittedAt?: string;
  EligibilityStatus?: string;
  EligibilityReason?: string;
  BenefitAmountMonthly?: string | number;
  BenefitStartDate?: string;
  BenefitEndDate?: string;

  ApplicantFullName?: string;
  ApplicantHouseholdSize?: number;
  ApplicantIncomeText?: string;

  caseWorkerEmail?: string;

  UpdatedBy?: string;
  UpdateTime?: string;
  Id?: string;
  RecordOwner?: string;
  CreatedBy?: string;
  CreateTime?: string;

  // Allow additional dynamic fields without breaking type checking
  [key: string]: unknown;
}

export interface ProcessedClaim {
  id: string;
  applicantName: string;
  eligibilityStatus: 'Pending' | 'Approved' | 'Denied' | 'Under Review';
  addressVerifiedFlag: boolean;
  incomeVerifiedFlag: boolean;
  addressVerificationState: 'verified' | 'manual-review' | 'not-verified' | 'loading';
  incomeVerificationState: 'verified' | 'manual-review' | 'not-verified' | 'loading';
  caseWorkerName: string;
  applicationCreationTime: string;
  rawData: ClaimData;
}

const ENTITY_ID = 'bcb8f163-c5cf-f011-8196-00224882fdd3';

function isProceedOutcome(value?: string): boolean {
  return value?.trim().toLowerCase() === 'proceed';
}

function isValidIncomeOutcome(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'valid' || normalized === 'proceed';
}

function normalizeTaskStatus(value: unknown): 'Unassigned' | 'Pending' | 'Completed' {
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

function getVerificationState(params: {
  actualVerified: boolean;
  agentVerified: boolean;
  reviewCompleted: boolean;
  agentDeterminationAvailable: boolean;
}): 'verified' | 'manual-review' | 'not-verified' | 'loading' {
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

async function deriveVerificationStates(sdk: any, claim: ClaimData) {
  const fallback = {
    addressVerificationState: getVerificationState({
      actualVerified: claim.AddressVerifiedFlag ?? false,
      agentVerified: false,
      reviewCompleted: false,
      agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId),
    }),
    incomeVerificationState: getVerificationState({
      actualVerified: claim.IncomeVerifiedFlag ?? false,
      agentVerified: false,
      reviewCompleted: false,
      agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId),
    }),
  };

  if (!claim.maestroProcessInstanceKey || !claim.FolderId) {
    return fallback;
  }

  try {
    const [caseTasksResponse, variables] = await Promise.all([
      sdk.maestro.cases.instances.getActionTasks(claim.maestroProcessInstanceKey).catch(() => null),
      sdk.maestro.processes.instances.getVariables(
        claim.maestroProcessInstanceKey,
        claim.FolderId
      ).catch(() => null),
    ]);

    const caseTasks = Array.isArray(caseTasksResponse)
      ? caseTasksResponse
      : caseTasksResponse?.items || [];

    const hasCompletedReview = caseTasks.some((task: any) => normalizeTaskStatus(task?.status) === 'Completed');

    const hitlElement = Array.isArray(variables?.elements)
      ? variables.elements.find((element: any) =>
          element.elementId === 'Activity_PeUITb' && element.inputs?.HitlTaskArguments
        )
      : null;

    const hitlData = hitlElement?.inputs?.HitlTaskArguments;
    const addressVerifiedByAgent = isProceedOutcome(hitlData?.Fraud_Residency_Risk);
    const incomeVerifiedByAgent = isValidIncomeOutcome(hitlData?.Fraud_Income_Risk);
    const addressDeterminationAvailable = typeof hitlData?.Fraud_Residency_Risk === 'string';
    const incomeDeterminationAvailable = typeof hitlData?.Fraud_Income_Risk === 'string';

    return {
      addressVerificationState: getVerificationState({
        actualVerified: claim.AddressVerifiedFlag ?? false,
        agentVerified: addressVerifiedByAgent,
        reviewCompleted: hasCompletedReview,
        agentDeterminationAvailable: addressDeterminationAvailable,
      }),
      incomeVerificationState: getVerificationState({
        actualVerified: claim.IncomeVerifiedFlag ?? false,
        agentVerified: incomeVerifiedByAgent,
        reviewCompleted: hasCompletedReview,
        agentDeterminationAvailable: incomeDeterminationAvailable,
      }),
    };
  } catch {
    return fallback;
  }
}

export const useClaims = () => {
  const { sdk } = useAuth();
  const [claims, setClaims] = useState<ProcessedClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClaims = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the SDK to fetch data from the entity
      const response = await sdk.entities.getRecordsById(ENTITY_ID, {
        pageSize: 100,
        $orderby: 'UpdateTime desc',
      } as any);

      // Process the response data
      const processedClaims: ProcessedClaim[] = response.items.map((claim: ClaimData) => {
        // Extract caseworker name from email (caseWorkerEmail / CreatedBy field)
        const caseWorkerEmail = (claim.caseWorkerEmail || claim.CreatedBy || '') as string;
        const caseWorkerName = extractNameFromEmail(caseWorkerEmail);
        const addressVerificationState = getVerificationState({
          actualVerified: claim.AddressVerifiedFlag ?? false,
          agentVerified: false,
          reviewCompleted: false,
          agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId),
        });
        const incomeVerificationState = getVerificationState({
          actualVerified: claim.IncomeVerifiedFlag ?? false,
          agentVerified: false,
          reviewCompleted: false,
          agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId),
        });

        return {
          id: (claim.Id as string) || 'unknown',
          applicantName: claim.ApplicantFullName || 'Unknown Applicant',
          eligibilityStatus: claim.EligibilityStatus as 'Pending' | 'Approved' | 'Denied' | 'Under Review' || 'Pending',
          addressVerifiedFlag: claim.AddressVerifiedFlag ?? false,
          incomeVerifiedFlag: claim.IncomeVerifiedFlag ?? false,
          addressVerificationState,
          incomeVerificationState,
          caseWorkerName,
          applicationCreationTime: claim.CreateTime || new Date().toISOString(),
          rawData: claim,
        };
      });

      setClaims(processedClaims);
      setIsLoading(false);

      void (async () => {
        const enrichedClaims = [...processedClaims];
        const batchSize = 5;

        for (let i = 0; i < enrichedClaims.length; i += batchSize) {
          const batch = enrichedClaims.slice(i, i + batchSize);
          const derivedBatch = await Promise.all(batch.map(async (processedClaim) => {
            const derivedVerificationStates = await deriveVerificationStates(sdk, processedClaim.rawData);

            return {
              ...processedClaim,
              addressVerificationState: derivedVerificationStates.addressVerificationState,
              incomeVerificationState: derivedVerificationStates.incomeVerificationState,
            };
          }));

          enrichedClaims.splice(i, derivedBatch.length, ...derivedBatch);
          setClaims([...enrichedClaims]);
        }
      })();
    } catch (err) {
      console.error('Failed to fetch claims:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch claims data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [sdk]);

  return { claims, isLoading, error, refetch: fetchClaims };
};

// Helper function to extract name from email
function extractNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return 'Unknown';
  }

  const localPart = email.split('@')[0];
  const parts = localPart.split(/[._-]/);

  return parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
