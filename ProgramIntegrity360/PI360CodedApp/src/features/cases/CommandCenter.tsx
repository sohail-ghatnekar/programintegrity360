import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@uipath/apollo-wind';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CaseSummary } from './types';
import type { CaseType } from './caseIntakeCatalog';
import type { CaseStartOutcome, CaseStartStatus } from './useCaseWorkspace';
import { StartCaseDialog } from './StartCaseDialog';

type CommandCenterProps = {
  cases: readonly CaseSummary[];
  selectedCaseId?: string;
  onSelectCase: (caseId: string) => void;
  identityEmail?: string | null;
  isAuthenticated?: boolean;
  caseStartStatus?: CaseStartStatus;
  caseStartMessage?: string | null;
  onStartCase?: (input: {
    caseType: CaseType;
    requesterEmail: string;
  }) => Promise<CaseStartOutcome>;
};

const PAGE_SIZE = 10;

function priorityVariant(priority: CaseSummary['priority']) {
  if (priority === 'High') return 'error' as const;
  if (priority === 'Medium') return 'warning' as const;
  return 'secondary' as const;
}

export function CommandCenter({
  cases,
  selectedCaseId,
  onSelectCase,
  identityEmail = null,
  isAuthenticated = false,
  caseStartStatus = 'idle',
  caseStartMessage = null,
  onStartCase = async () => {
    throw new Error('Connect UiPath to start a case.');
  },
}: CommandCenterProps) {
  const [page, setPage] = useState(0);
  const orderedCases = useMemo(() => [...cases].sort((left, right) => {
    const updated = Date.parse(right.sourceUpdatedAt) - Date.parse(left.sourceUpdatedAt);
    return updated || right.id.localeCompare(left.id);
  }), [cases]);
  const pageCount = Math.max(1, Math.ceil(orderedCases.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleCases = useMemo(
    () => orderedCases.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [orderedCases, safePage],
  );
  const highPriority = cases.filter((candidate) => candidate.priority === 'High').length;
  const inReview = cases.filter((candidate) => candidate.status.toLowerCase().includes('review')).length;
  const start = cases.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min((safePage + 1) * PAGE_SIZE, cases.length);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    setPage(0);
  }, [selectedCaseId]);

  const headCaseId = orderedCases[0]?.id;
  useEffect(() => {
    if (selectedCaseId && selectedCaseId === headCaseId) {
      setPage(0);
    }
  }, [headCaseId, selectedCaseId]);

  return (
    <section aria-labelledby="command-center-heading" className="min-w-0">
      <div className="mb-4">
        <h1 id="command-center-heading" className="text-xl font-semibold text-slate-950">Command center</h1>
        <p className="mt-1 text-sm text-slate-600">Case workload, ownership, exposure, and SLA posture.</p>
      </div>

      <dl className="grid border-y border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open cases" value={String(cases.length)} />
        <Metric label="High priority" value={String(highPriority)} tone="text-red-700" />
        <Metric label="In review" value={String(inReview)} tone="text-blue-700" />
        <Metric
          label="Selected exposure"
          value={cases.find((candidate) => candidate.id === selectedCaseId)?.periodExposure ?? '-'}
          tone="text-amber-700"
        />
      </dl>

      <section aria-labelledby="case-queue-heading" className="mt-5 overflow-hidden border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id="case-queue-heading" className="text-sm font-semibold text-slate-950">Case queue</h2>
            <p className="mt-0.5 text-xs text-slate-500">Select a case to open its six-stage workspace.</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Badge variant="outline" className="mt-1">{cases.length} total</Badge>
            <StartCaseDialog
              identityEmail={identityEmail}
              isAuthenticated={isAuthenticated}
              startStatus={caseStartStatus}
              startMessage={caseStartMessage}
              onStartCase={onStartCase}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">Case</TableHead>
                <TableHead className="w-32">Priority</TableHead>
                <TableHead className="min-w-[210px]">Stage</TableHead>
                <TableHead className="w-40">SLA due</TableHead>
                <TableHead className="w-36">Exposure</TableHead>
                <TableHead className="w-20"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCases.map((caseSummary) => (
                <TableRow key={caseSummary.id} data-state={caseSummary.id === selectedCaseId ? 'selected' : undefined}>
                  <TableCell>
                    <div className="max-w-[420px] min-w-0">
                      <div className="break-words text-sm font-semibold text-slate-950">{caseSummary.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <code>{caseSummary.id}</code>
                        <span>{caseSummary.investigator}</span>
                        <Badge variant={caseSummary.dataSource === 'live' ? 'success' : 'info'}>
                          {caseSummary.dataSource === 'live' ? 'Live' : 'Demo'}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={priorityVariant(caseSummary.priority)}>{caseSummary.priority}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-700">{caseSummary.stage}</TableCell>
                  <TableCell className="text-sm tabular-nums text-slate-700">{caseSummary.slaDue}</TableCell>
                  <TableCell className="text-sm font-semibold tabular-nums text-slate-900">{caseSummary.periodExposure}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Open case ${caseSummary.id}`}
                      onClick={() => onSelectCase(caseSummary.id)}
                    >
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {visibleCases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">No cases available.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2">
          <span className="text-xs tabular-nums text-slate-500">Showing {start}-{end} of {cases.length}</span>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="icon" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Next page" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value, tone = 'text-slate-950' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 border-b border-slate-200 px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className={`mt-1 truncate text-2xl font-semibold tabular-nums ${tone}`} title={value}>{value}</dd>
    </div>
  );
}
