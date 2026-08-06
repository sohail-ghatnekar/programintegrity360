import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Theme } from '@uipath/coded-action-app';
import { codedActionAppService } from '../uipath';
import './Form.css';

interface FormData {
  caseId: string;
  providerName: string;
  currentStage: string;
  riskScore: number;
  routeReason: string;
  evidenceSummary: string;
  recommendedAction: string;
  supervisorDecision: string;
  nextStage: string;
  reviewNotes: string;
}

const defaultFormData: FormData = {
  caseId: '',
  providerName: '',
  currentStage: '',
  riskScore: 0,
  routeReason: '',
  evidenceSummary: '',
  recommendedAction: '',
  supervisorDecision: '',
  nextStage: '',
  reviewNotes: '',
};

const isDarkTheme = (theme: Theme): boolean =>
  theme === Theme.Dark || theme === Theme.DarkHighContrast;

interface FormProps {
  onInitTheme: (isDark: boolean) => void;
  darkTheme: boolean;
  onToggleTheme: () => void;
}

function Form({ onInitTheme, darkTheme, onToggleTheme }: FormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    codedActionAppService.getTask().then((task) => {
      const merged = task.data
        ? { ...defaultFormData, ...(task.data as Partial<FormData>) }
        : defaultFormData;
      setFormData(merged);
      setIsReadOnly(task.isReadOnly);
      onInitTheme(isDarkTheme(task.theme));
    });
  }, [onInitTheme]);

  const updateFormData = (updated: FormData) => {
    setFormData(updated);
    codedActionAppService.setTaskData(updated);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (isReadOnly) return;
    const { name, value } = event.target;
    updateFormData({ ...formData, [name]: value });
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const parsed = event.target.value === '' ? 0 : Number(event.target.value);
    updateFormData({
      ...formData,
      [event.target.name]: Number.isNaN(parsed) ? 0 : parsed,
    });
  };

  const isFormValid =
    !isReadOnly &&
    formData.supervisorDecision.trim() !== '' &&
    formData.nextStage.trim() !== '';

  const complete = async (outcome: 'Approve' | 'Return' | 'Escalate') => {
    await codedActionAppService.completeTask(outcome, formData);
  };

  return (
    <main className="review-app">
      <section className="review-header">
        <div className="review-header__icon" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 11.5V7a2 2 0 0 0-2-2h-3.2A3 3 0 0 0 12 3a3 3 0 0 0-2.8 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="review-header__titles">
          <h1 className="review-header__title">Supervisor Escalation</h1>
          <p className="review-header__subtitle">Program Integrity 360 case review</p>
        </div>
        <div className="review-header__actions">
          <span className="review-badge">Action Center</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {darkTheme ? 'L' : 'D'}
          </button>
        </div>
      </section>

      <section className="form-container form-container--enter">
        <section className="form-section">
          <h2 className="form-title">Case Context</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="caseId">Case ID</label>
              <input id="caseId" name="caseId" value={formData.caseId} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="providerName">Provider</label>
              <input id="providerName" name="providerName" value={formData.providerName} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="currentStage">Current Stage</label>
              <input id="currentStage" name="currentStage" value={formData.currentStage} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="riskScore">Risk Score</label>
              <input
                id="riskScore"
                name="riskScore"
                type="number"
                value={formData.riskScore}
                onChange={handleNumberChange}
                readOnly
              />
            </div>
          </div>
          <div className="form-group form-group--spaced">
            <label htmlFor="routeReason">Route Reason</label>
            <textarea id="routeReason" name="routeReason" value={formData.routeReason} rows={3} readOnly />
          </div>
          <div className="form-group">
            <label htmlFor="evidenceSummary">Evidence Summary</label>
            <textarea id="evidenceSummary" name="evidenceSummary" value={formData.evidenceSummary} rows={5} readOnly />
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-title">Reviewer Decision</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="recommendedAction">Recommended Action</label>
              <input
                id="recommendedAction"
                name="recommendedAction"
                value={formData.recommendedAction}
                onChange={handleTextChange}
                readOnly={isReadOnly}
              />
            </div>
            <div className="form-group">
              <label htmlFor="supervisorDecision">Supervisor Decision<span className="req">*</span></label>
              <select
                id="supervisorDecision"
                name="supervisorDecision"
                value={formData.supervisorDecision}
                onChange={handleTextChange}
                disabled={isReadOnly}
              >
                <option value="">Select decision</option>
                <option value="approve">Approve proposed route</option>
                <option value="return">Return to investigator</option>
                <option value="escalate">Escalate to policy owner</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="nextStage">Next Stage<span className="req">*</span></label>
              <select
                id="nextStage"
                name="nextStage"
                value={formData.nextStage}
                onChange={handleTextChange}
                disabled={isReadOnly}
              >
                <option value="">Select next stage</option>
                <option value="Investigation">Investigation</option>
                <option value="ProviderResponse">Provider Response</option>
                <option value="SupervisorEscalation">Supervisor Escalation</option>
                <option value="Closure">Closure</option>
              </select>
            </div>
          </div>
          <div className="form-group form-group--spaced">
            <label htmlFor="reviewNotes">Review Notes</label>
            <textarea
              id="reviewNotes"
              name="reviewNotes"
              value={formData.reviewNotes}
              onChange={handleTextChange}
              readOnly={isReadOnly}
              rows={5}
              placeholder="Add notes for the case record"
            />
          </div>
        </section>

        <footer className="form-buttons">
          <button
            type="button"
            className="outcome-btn outcome-btn--secondary"
            disabled={!isFormValid}
            onClick={() => void complete('Return')}
          >
            Return
          </button>
          <button
            type="button"
            className="outcome-btn outcome-btn--secondary"
            disabled={!isFormValid}
            onClick={() => void complete('Escalate')}
          >
            Escalate
          </button>
          <button
            type="button"
            className="outcome-btn outcome-btn--primary"
            disabled={!isFormValid}
            onClick={() => void complete('Approve')}
          >
            Approve
          </button>
        </footer>
      </section>
    </main>
  );
}

export default Form;
