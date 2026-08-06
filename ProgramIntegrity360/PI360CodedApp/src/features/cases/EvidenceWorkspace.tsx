import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@uipath/apollo-wind';
import { FileCheck2, MessageSquareText } from 'lucide-react';
import type { CaseWorkspaceSnapshot } from './types';

type EvidenceWorkspaceProps = {
  workspace: CaseWorkspaceSnapshot;
};

export function EvidenceWorkspace({ workspace }: EvidenceWorkspaceProps) {
  const providerResponse = workspace.evidenceDocuments.find((document) => document.type === 'Correspondence');
  const flaggedClaims = workspace.claims.filter((claim) => claim.status === 'Flagged');

  return (
    <div className="min-w-0 space-y-5">
      <Alert>
        <MessageSquareText aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Provider response</AlertTitle>
        <AlertDescription>
          {providerResponse
            ? `${providerResponse.id}: ${providerResponse.note}`
            : 'No provider response is available for this case.'}
        </AlertDescription>
      </Alert>

      <section aria-labelledby="evidence-heading">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="evidence-heading" className="text-base font-semibold text-slate-950">Evidence validation</h2>
            <p className="mt-1 text-sm text-slate-600">Source, confidence, and human-validation state remain visible together.</p>
          </div>
          <Badge variant="outline">{workspace.evidenceDocuments.length} documents</Badge>
        </div>
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Document</TableHead>
                <TableHead className="w-40">Type</TableHead>
                <TableHead className="min-w-[190px]">Source</TableHead>
                <TableHead className="w-44">Confidence</TableHead>
                <TableHead className="w-40">Validation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.evidenceDocuments.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-mono text-xs">{document.id}</TableCell>
                  <TableCell className="text-sm font-medium">{document.type}</TableCell>
                  <TableCell className="text-sm text-slate-600">{document.source}</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <Progress
                        value={Math.round(document.confidence * 100)}
                        aria-label={`${document.id} confidence`}
                        aria-valuenow={Math.round(document.confidence * 100)}
                        aria-valuetext={`${Math.round(document.confidence * 100)} percent confidence`}
                      />
                      <div className="mt-1 text-xs tabular-nums text-slate-500">{Math.round(document.confidence * 100)}%</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={document.status === 'Needs review' ? 'warning' : 'success'}>
                      <FileCheck2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                      {document.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="reconciliation-heading">
        <div className="mb-3">
          <h2 id="reconciliation-heading" className="text-base font-semibold text-slate-950">Reconciliation exceptions</h2>
          <p className="mt-1 text-sm text-slate-600">Flagged claims requiring investigator resolution.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {flaggedClaims.map((claim) => (
            <article key={claim.id} className="border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <code className="text-xs font-semibold text-slate-700">{claim.id}</code>
                <Badge variant="error">{claim.improper} unsupported units</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-700">{claim.note}</p>
              <div className="mt-3 text-xs text-slate-500">Source: {claim.source}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
