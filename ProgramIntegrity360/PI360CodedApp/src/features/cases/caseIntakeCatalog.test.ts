import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCaseStartPayload,
  createCaseId,
  type CaseType,
} from './caseIntakeCatalog';

const FIXED_NOW = new Date('2026-08-10T12:00:00Z');
const TRIGGER_INPUT_NAMES = [
  'caseInput',
  'claimInput',
  'memberInput',
  'providerInput',
  'serviceEventInput',
  'documentInput',
];

describe('case intake catalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['MedicaidPCS', 'PI-PCS-2026-ABC123'],
    ['StateMedicaidHospice', 'PI-HSP-2026-ABC123'],
  ] satisfies Array<[CaseType, string]>) (
    'creates the current-year %s case ID required by intake',
    (caseType, expectedCaseId) => {
      expect(createCaseId(caseType, FIXED_NOW, 'ABC123')).toBe(expectedCaseId);
    },
  );

  it('uses six crypto-generated uppercase alphanumeric characters by default', () => {
    const randomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        (array as Uint8Array).set([0, 1, 2, 27, 28, 29]);
        return array;
      });

    const request = buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'investigator@example.gov',
      now: FIXED_NOW,
    });

    expect(request.caseId).toBe('PI-PCS-2026-ABC123');
    expect(randomValues).toHaveBeenCalledOnce();
  });

  it('rejects biased tail bytes and refills until six suffix characters are accepted', () => {
    const randomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementationOnce((array) => {
        (array as Uint8Array).set([252, 0, 253, 1, 254, 2]);
        return array;
      })
      .mockImplementationOnce((array) => {
        (array as Uint8Array).set([27, 28, 255]);
        return array;
      })
      .mockImplementationOnce((array) => {
        (array as Uint8Array).set([29]);
        return array;
      });

    const request = buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'investigator@example.gov',
      now: FIXED_NOW,
    });

    expect(request.caseId).toBe('PI-PCS-2026-ABC123');
    expect(randomValues).toHaveBeenCalledTimes(3);
  });

  it('fails after bounded refills when the entropy source only returns rejected bytes', () => {
    const randomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        (array as Uint8Array).fill(255);
        return array;
      });

    expect(() => buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'investigator@example.gov',
      now: FIXED_NOW,
    })).toThrow('Unable to generate an unbiased case ID suffix');
    expect(randomValues.mock.calls.length).toBeGreaterThan(1);
    expect(randomValues.mock.calls.length).toBeLessThanOrEqual(128);
  });

  it.each(['MedicaidPCS', 'StateMedicaidHospice'] satisfies CaseType[]) (
    'emits exactly the six ordered Maestro trigger objects for %s',
    (caseType) => {
      const request = buildCaseStartPayload({
        caseType,
        requesterEmail: 'investigator@example.gov',
        now: FIXED_NOW,
        suffix: 'ABC123',
      });

      expect(Object.keys(request.inputArguments)).toEqual(TRIGGER_INPUT_NAMES);
    },
  );

  it('normalizes the edited requester email inside caseInput', () => {
    const request = buildCaseStartPayload({
      caseType: 'StateMedicaidHospice',
      requesterEmail: '  Investigator@Example.Gov  ',
      now: FIXED_NOW,
      suffix: 'ABC123',
    });

    expect(request.inputArguments.caseInput).toMatchObject({
      caseId: 'PI-HSP-2026-ABC123',
      caseType: 'StateMedicaidHospice',
      requesterEmail: 'investigator@example.gov',
    });
  });

  it('retains the canonical hospice claim, member, service, and document facts', () => {
    const request = buildCaseStartPayload({
      caseType: 'StateMedicaidHospice',
      requesterEmail: 'investigator@example.gov',
      now: FIXED_NOW,
      suffix: 'ABC123',
    });

    expect(request.inputArguments.claimInput).toMatchObject({
      claimId: 'CLM-HSP-2026-0714-001',
      totalUnits: 52,
      totalBilled: 3250,
      claimThreshold: 2500,
    });
    expect(request.inputArguments.memberInput).toMatchObject({
      memberId: 'MBR-071426',
      memberName: 'Jordan Ellis',
    });
    expect(request.inputArguments.providerInput).toEqual({
      providerId: 'PRV-100482',
      providerName: 'Harbor Home Support Services',
      caregiverId: 'ATT-HSP-4401',
      attendantId: 'ATT-HSP-4401',
      caregiverName: 'Taylor Brooks',
    });
    expect(request.inputArguments.serviceEventInput).toMatchObject({
      lineId: 'LINE-0714-01',
      dateOfService: '2026-07-14',
      placeOfServiceCode: '12',
      placeOfServiceDescription: 'Member home',
      claimedServiceStartAt: '2026-07-14T09:00:00-05:00',
      claimedServiceEndAt: '2026-07-14T15:00:00-05:00',
      units: 24,
    });
    expect(request.inputArguments.documentInput).toEqual({
      timesheetBucketPath:
        'Timesheets/hospice/PI-HSP-2026-ABC123/incoming/01_personal_care_timesheet.pdf',
      hospitalRecordBucketPath:
        'Hospital Records/hospice/PI-HSP-2026-ABC123/provider-response/jordan_ellis_synthetic_medical_record_packet.pdf',
      policyBucketPath: 'Policy Docs/reference/policy/03_personal_care_services_policy.pdf',
      hospitalRecordAvailable: false,
      hospitalRecordRequestRequired: true,
      patientClass: 'Observation',
      serviceEvidenceModel: 'PI360 Service Evidence Extractor',
      institutionalEncounterModel: 'PI360 Institutional Encounter Extractor',
      policyReferenceOnly: true,
    });
  });

  it('retains the PCS fallback facts without activating a hospital-record request', () => {
    const request = buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'investigator@example.gov',
      now: FIXED_NOW,
      suffix: 'ABC123',
    });

    expect(request.inputArguments.caseInput).toMatchObject({
      caseId: 'PI-PCS-2026-ABC123',
      caseType: 'MedicaidPCS',
      riskScore: 72,
    });
    expect(request.inputArguments.claimInput).toMatchObject({
      claimCount: 9,
      totalUnits: 176,
      totalBilled: 1267.2,
    });
    expect(request.inputArguments.providerInput).toMatchObject({
      providerId: 'PRV-100482',
      providerName: 'Harbor Home Support Services',
      attendantId: 'ATT-2087',
      attendantName: 'Jordan Ellis',
    });
    expect(request.inputArguments.serviceEventInput).toMatchObject({
      servicePeriodStart: '2026-03-01',
      servicePeriodEnd: '2026-05-31',
      overlapMinutes: 90,
      unsupportedUnits: 24,
    });
    expect(request.inputArguments.documentInput).toMatchObject({
      hospitalRecordRequestRequired: false,
      institutionalEncounterModel: null,
    });
    expect(request.inputArguments.documentInput).not.toHaveProperty('hospitalRecordBucketPath');
  });

  it('returns fresh nested payload objects for independent case starts', () => {
    const first = buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'first@example.gov',
      now: FIXED_NOW,
      suffix: 'ABC123',
    });
    const second = buildCaseStartPayload({
      caseType: 'MedicaidPCS',
      requesterEmail: 'second@example.gov',
      now: FIXED_NOW,
      suffix: 'ABC123',
    });

    expect(first.inputArguments).not.toBe(second.inputArguments);
    for (const name of TRIGGER_INPUT_NAMES) {
      expect(first.inputArguments[name]).not.toBe(second.inputArguments[name]);
    }

    first.inputArguments.caseInput.requesterEmail = 'mutated@example.gov';
    const firstPaths = first.inputArguments.documentInput.timesheetBucketPaths as string[];
    firstPaths.push('Timesheets/pcs/mutated.pdf');

    expect(second.inputArguments.caseInput.requesterEmail).toBe('second@example.gov');
    expect(second.inputArguments.documentInput.timesheetBucketPaths).toEqual([
      'Timesheets/pcs/PI-PCS-2026-ABC123/incoming/timesheet_0416.pdf',
      'Timesheets/pcs/PI-PCS-2026-ABC123/incoming/timesheet_0519.pdf',
    ]);
  });

  it.each([
    {
      name: 'unsupported case type',
      caseType: 'MedicareHospice' as CaseType,
      requesterEmail: 'investigator@example.gov',
      suffix: 'ABC123',
      error: 'Unsupported CaseType',
    },
    {
      name: 'invalid email',
      caseType: 'MedicaidPCS' as CaseType,
      requesterEmail: 'first@example.gov,second@example.gov',
      suffix: 'ABC123',
      error: 'one valid requester email',
    },
    {
      name: 'invalid suffix',
      caseType: 'MedicaidPCS' as CaseType,
      requesterEmail: 'investigator@example.gov',
      suffix: 'abc-12',
      error: 'six uppercase alphanumeric characters',
    },
  ])('rejects $name before a process caller can run', ({
    caseType,
    requesterEmail,
    suffix,
    error,
  }) => {
    const processStart = vi.fn();
    const start = () => {
      const request = buildCaseStartPayload({
        caseType,
        requesterEmail,
        now: FIXED_NOW,
        suffix,
      });
      processStart(request);
    };

    expect(start).toThrow(error);
    expect(processStart).not.toHaveBeenCalled();
  });
});
