import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@uipath/apollo-wind';
import type { CaseWorkspaceSnapshot, DemoRole } from './types';

type CaseOverviewProps = {
  workspace: CaseWorkspaceSnapshot;
  role: DemoRole;
};

export function CaseOverview({ workspace, role }: CaseOverviewProps) {
  const { case: caseSummary, provider, attendant, claims } = workspace;
  const isHospice = caseSummary.caseType === 'StateMedicaidHospice';

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="claims-heading" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="claims-heading" className="text-base font-semibold text-slate-950">Claims under review</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isHospice
                ? 'Stored claim lines, service record, and institutional evidence comparisons.'
                : 'Stored claim, EVV, timesheet, and plan-of-care comparisons.'}
            </p>
          </div>
          <Badge variant="outline">{claims.length} sampled</Badge>
        </div>
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Claim</TableHead>
                <TableHead className="w-28">Service date</TableHead>
                <TableHead className="w-20 text-right">Billed</TableHead>
                <TableHead className="w-20 text-right">{isHospice ? 'Service record' : 'EVV'}</TableHead>
                <TableHead className="w-24 text-right">Unsupported</TableHead>
                <TableHead className="min-w-[150px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div role="status" aria-label="No claims available" className="text-sm text-slate-500">
                      No claims available for this case.
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-mono text-xs">{claim.id}</TableCell>
                  <TableCell className="text-xs tabular-nums">{claim.dos}</TableCell>
                  <TableCell className="text-right tabular-nums">{claim.billed}</TableCell>
                  <TableCell className="text-right tabular-nums">{claim.evv}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{claim.improper}</TableCell>
                  <TableCell>
                    <Badge variant={claim.status === 'Flagged' ? 'error' : claim.status === 'Cleared' ? 'success' : 'warning'}>
                      {claim.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <aside aria-label="Case context" className="min-w-0 border-l-0 border-slate-200 xl:border-l xl:pl-5">
        <h2 className="text-base font-semibold text-slate-950">Case context</h2>
        <ContextGroup title="Provider" rows={[
          ['Name', provider.name],
          ['Medicaid ID', provider.medicaidId],
          ['NPI', provider.npi],
          ['Enrollment', provider.enrollment],
        ]} />
        {isHospice && (
          <ContextGroup title="Member" rows={[
            ['Name', caseSummary.memberName || 'Not available'],
            ['ID', caseSummary.memberId || 'Not available'],
          ]} />
        )}
        <ContextGroup title={isHospice ? 'Caregiver' : 'Attendant'} rows={[
          ['Name', attendant.name],
          ['ID', attendant.id],
          ['Certification', attendant.certStatus],
        ]} />
        <ContextGroup title="Ownership" rows={[
          ['Investigator', caseSummary.investigator],
          ['Supervisor', caseSummary.supervisor],
          ['View', role === 'supervisor' ? 'Supervisor' : 'Investigator'],
        ]} />
      </aside>
    </div>
  );
}

function ContextGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="mt-4 border-t border-slate-200 pt-3">
      <h3 className="text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <dl className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
