import { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@uipath/apollo-wind';
import { Plus, TriangleAlert } from 'lucide-react';
import type { CaseType } from './caseIntakeCatalog';
import type { CaseStartOutcome, CaseStartStatus } from './useCaseWorkspace';

export type StartCaseDialogProps = {
  identityEmail: string | null;
  isAuthenticated: boolean;
  startStatus: CaseStartStatus;
  startMessage: string | null;
  onStartCase: (input: {
    caseType: CaseType;
    requesterEmail: string;
  }) => Promise<CaseStartOutcome>;
};

const SINGLE_EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function StartCaseDialog({
  identityEmail,
  isAuthenticated,
  startStatus,
  startMessage,
  onStartCase,
}: StartCaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [caseType, setCaseType] = useState<CaseType>('MedicaidPCS');
  const [requesterEmail, setRequesterEmail] = useState(identityEmail ?? '');
  const [emailDirty, setEmailDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const isStarting = submitting || startStatus === 'starting' || startStatus === 'polling';
  const formLocked = isStarting || registrationPending;

  useEffect(() => {
    if (open && !emailDirty) {
      setRequesterEmail(identityEmail ?? '');
    }
  }, [emailDirty, identityEmail, open]);

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && isStarting) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setCaseType('MedicaidPCS');
      setRequesterEmail(identityEmail ?? '');
      setEmailDirty(false);
      setValidationError(null);
      setLocalError(null);
      setRegistrationPending(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formLocked) return;

    const normalizedEmail = requesterEmail.trim();
    if (!SINGLE_EMAIL_PATTERN.test(normalizedEmail)) {
      setValidationError('Enter one valid requester email address.');
      return;
    }

    setValidationError(null);
    setLocalError(null);
    setSubmitting(true);
    try {
      const outcome = await onStartCase({ caseType, requesterEmail });
      if (outcome.status === 'registered') {
        setOpen(false);
      } else {
        setRegistrationPending(true);
      }
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : 'Unable to start the case.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = localError ?? (startStatus === 'error' ? startMessage : null);
  const displayedPending = registrationPending && startMessage;

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            disabled={!isAuthenticated}
            aria-describedby={!isAuthenticated ? 'start-case-auth-help' : undefined}
            className="bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-600"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Start new case
          </Button>
        </DialogTrigger>
        <DialogContent
          className="bg-white sm:max-w-lg"
          onEscapeKeyDown={(event) => {
            if (isStarting) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isStarting) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Start new case</DialogTitle>
            <DialogDescription>
              Choose a Medicaid case path. Maestro will register the case in Program Integrity Fabric.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="start-case-type">Case type</Label>
              <Select
                value={caseType}
                onValueChange={(value) => setCaseType(value as CaseType)}
                disabled={formLocked}
              >
                <SelectTrigger id="start-case-type" aria-label="Case type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MedicaidPCS">Medicaid PCS</SelectItem>
                  <SelectItem value="StateMedicaidHospice">State Medicaid Hospice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-case-email">Requester email</Label>
              <Input
                id="start-case-email"
                type="email"
                value={requesterEmail}
                disabled={formLocked}
                aria-invalid={validationError ? true : undefined}
                aria-describedby={validationError ? 'start-case-email-error' : undefined}
                onChange={(event) => {
                  setRequesterEmail(event.target.value);
                  setEmailDirty(true);
                  if (validationError) setValidationError(null);
                }}
              />
              {validationError && (
                <p id="start-case-email-error" role="alert" className="text-sm text-red-700">
                  {validationError}
                </p>
              )}
            </div>

            {displayedError && (
              <Alert role="alert" variant="destructive">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Case start failed</AlertTitle>
                <AlertDescription>{displayedError}</AlertDescription>
              </Alert>
            )}

            {displayedPending && (
              <Alert role="status">
                <AlertTitle>Registration pending</AlertTitle>
                <AlertDescription>{displayedPending}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={isStarting} onClick={() => changeOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formLocked}
                className="bg-orange-600 text-white hover:bg-orange-700 focus-visible:ring-orange-600"
              >
                {isStarting ? 'Starting case…' : registrationPending ? 'Case started' : 'Start case'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {!isAuthenticated && (
        <span id="start-case-auth-help" className="max-w-52 text-right text-xs text-slate-500">
          Connect UiPath to start a case.
        </span>
      )}
    </div>
  );
}
