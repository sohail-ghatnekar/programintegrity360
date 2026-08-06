import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Theme } from '@uipath/coded-action-app';
import { codedActionAppService } from '../uipath';
import './Form.css';

interface FormData {
  caseId: string;
  providerName: string;
  unsupportedUnits: number;
  unitRate: number;
  sampleExposure: number;
  projectedExposureLow: number;
  projectedExposureHigh: number;
  decisionBrief: string;
  policyCitation: string;
  authorizedAmount: number;
  noticeLanguage: string;
  authorizationDecision: string;
  recoveryRoute: string;
  authorizationNotes: string;
}

const defaultFormData: FormData = {
  caseId: '', providerName: '', unsupportedUnits: 0, unitRate: 0,
  sampleExposure: 0, projectedExposureLow: 0, projectedExposureHigh: 0,
  decisionBrief: '', policyCitation: '', authorizedAmount: 0, noticeLanguage: '',
  authorizationDecision: '', recoveryRoute: '', authorizationNotes: '',
};

const isDarkTheme = (theme: Theme): boolean =>
  theme === Theme.Dark || theme === Theme.DarkHighContrast;

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);

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
      const merged = task.data ? { ...defaultFormData, ...(task.data as Partial<FormData>) } : defaultFormData;
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
    updateFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const parsed = event.target.value === '' ? 0 : Number(event.target.value);
    updateFormData({ ...formData, authorizedAmount: Number.isNaN(parsed) ? 0 : parsed });
  };

  const isFormValid = !isReadOnly &&
    formData.authorizationDecision.trim() !== '' &&
    formData.recoveryRoute.trim() !== '' &&
    formData.authorizationNotes.trim() !== '';

  const complete = async (outcome: 'Authorize' | 'Return' | 'Hold') => {
    await codedActionAppService.completeTask(outcome, formData);
  };

  return (
    <main className="review-app recovery-app">
      <section className="review-header recovery-header">
        <div className="review-header__titles">
          <p className="recovery-kicker">PROGRAM INTEGRITY 360</p>
          <h1 className="review-header__title">Recovery Authorization</h1>
          <p className="review-header__subtitle">Human approval before financial action</p>
        </div>
        <div className="review-header__actions">
          <span className="review-badge">Action Center</span>
          <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">{darkTheme ? 'L' : 'D'}</button>
        </div>
      </section>

      <section className="recovery-metrics" aria-label="Recovery metrics">
        <article className="recovery-metric">
          <span>Reviewed sample</span><strong>{money(formData.sampleExposure)}</strong>
          <small>{formData.unsupportedUnits} unsupported units at {money(formData.unitRate)}</small>
        </article>
        <article className="recovery-metric">
          <span>Indicative range</span><strong>{money(formData.projectedExposureLow)} - {money(formData.projectedExposureHigh)}</strong>
          <small>Subject to human validation</small>
        </article>
        <article className="recovery-metric recovery-metric--status">
          <span>Control status</span><strong>Approval required</strong><small>No recovery has been initiated</small>
        </article>
      </section>

      <section className="form-container form-container--enter">
        <section className="form-section">
          <div className="section-heading">
            <div><h2 className="form-title">Decision Brief</h2><p className="section-caption">Prepared by a deterministic portable workflow</p></div>
            <span className="case-pill">{formData.caseId || 'Case pending'}</span>
          </div>
          <div className="form-grid">
            <div className="form-group"><label htmlFor="providerName">Provider</label><input id="providerName" name="providerName" value={formData.providerName} readOnly /></div>
            <div className="form-group"><label htmlFor="policyCitation">Policy citation</label><input id="policyCitation" name="policyCitation" value={formData.policyCitation} readOnly /></div>
          </div>
          <div className="form-group form-group--spaced"><label htmlFor="decisionBrief">Grounded summary</label><textarea id="decisionBrief" name="decisionBrief" value={formData.decisionBrief} rows={6} readOnly /></div>
        </section>

        <section className="form-section">
          <h2 className="form-title">Authorization</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="authorizationDecision">Decision<span className="req">*</span></label>
              <select id="authorizationDecision" name="authorizationDecision" value={formData.authorizationDecision} onChange={handleTextChange} disabled={isReadOnly}>
                <option value="">Select decision</option><option value="authorize-sample">Authorize reviewed sample only</option>
                <option value="authorize-expanded">Authorize expanded review</option><option value="return">Return for evidence correction</option><option value="hold">Place on policy hold</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="recoveryRoute">Recovery route<span className="req">*</span></label>
              <select id="recoveryRoute" name="recoveryRoute" value={formData.recoveryRoute} onChange={handleTextChange} disabled={isReadOnly}>
                <option value="">Select route</option><option value="recoupment">Claims recoupment</option><option value="payment-plan">Provider payment plan</option>
                <option value="expanded-audit">Expanded audit before recovery</option><option value="no-action">No financial action</option>
              </select>
            </div>
            <div className="form-group"><label htmlFor="authorizedAmount">Authorized amount</label><input id="authorizedAmount" name="authorizedAmount" type="number" min="0" step="0.01" value={formData.authorizedAmount} onChange={handleAmountChange} readOnly={isReadOnly} /></div>
          </div>
          <div className="form-group form-group--spaced"><label htmlFor="noticeLanguage">Provider notice language</label><textarea id="noticeLanguage" name="noticeLanguage" value={formData.noticeLanguage} onChange={handleTextChange} readOnly={isReadOnly} rows={4} placeholder="Enter the approved factual notice language" /></div>
          <div className="form-group"><label htmlFor="authorizationNotes">Authorization rationale<span className="req">*</span></label><textarea id="authorizationNotes" name="authorizationNotes" value={formData.authorizationNotes} onChange={handleTextChange} readOnly={isReadOnly} rows={5} placeholder="Document policy basis, scope, and any limitations" /></div>
        </section>

        <footer className="form-buttons">
          <button type="button" className="outcome-btn outcome-btn--secondary" disabled={!isFormValid} onClick={() => void complete('Return')}>Return</button>
          <button type="button" className="outcome-btn outcome-btn--secondary" disabled={!isFormValid} onClick={() => void complete('Hold')}>Place on hold</button>
          <button type="button" className="outcome-btn outcome-btn--primary" disabled={!isFormValid} onClick={() => void complete('Authorize')}>Authorize recovery</button>
        </footer>
      </section>
    </main>
  );
}

export default Form;
