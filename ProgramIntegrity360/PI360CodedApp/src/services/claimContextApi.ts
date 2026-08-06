import type { ClaimConversationContext } from '../lib/claimContext';
import { buildClaimContextPromptFromJson } from '../lib/claimContext';

export async function fetchClaimConversationContext(claimId: string, accessToken: string): Promise<ClaimConversationContext> {
  const response = await fetch(`/api/claims/${encodeURIComponent(claimId)}/context`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to load claim context (${response.status})`);
  }

  return response.json() as Promise<ClaimConversationContext>;
}

export function buildAgentPromptFromClaimContext(context: ClaimConversationContext): string {
  return buildClaimContextPromptFromJson(context);
}
