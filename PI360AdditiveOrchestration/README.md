# PI360 Additive Orchestration

Add these process tasks to the existing Case manually:

- Evidence stage `Stage_Evcol2`: bind a process task to `PI360EvidenceRoutingFlow`. Map inputs `caseInput`, `claimInput`, `memberInput`, `providerInput`, `serviceEventInput`, and `documentInput`. Map outputs `caseId`, `caseType`, `claimCount`, `lineCount`, `totalUnits`, `totalBilled`, `claimThreshold`, `thresholdExceeded`, `recommendedStageId`, and `routeReason`.
- Provider stage `Stage_Prreq6`: bind a process task to `PI360HospiceProviderRecordBpmn`. Map inputs `CaseId`, `CaseType`, `ProviderId`, `HospitalRecordAvailable`, and `InvestigatorProceed`. Map outputs `ProviderRequestStatus`, `HospitalRecordAvailable`, `NextStageId`, and `AuditMessage`.
- Provider response: send the message `PI360ProviderRecordReceived` with `Reference = CaseId`. The BPMN correlates this against the active case while racing the `P3D` timeout.
- Investigation stage `Stage_Corr4a`: accept `recommendedStageId` from the Flow or `NextStageId` from the BPMN when the value equals `Stage_Corr4a`.

No Case Plan files are included; existing Case edits remain manual.
