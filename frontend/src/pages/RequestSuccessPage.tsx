import { Check, CheckCircle2, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { PortalHeader } from '../PortalHeader.js';
import { type CreatedWorkshop } from '../types.js';

export function RequestSuccessPage() {
  const workshop = useLocation().state as CreatedWorkshop | null;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copyTrackingUrl = async () => {
    if (!workshop) return;
    try {
      await navigator.clipboard.writeText(workshop.trackingUrl);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <main className="app-shell">
      <PortalHeader />
      <section className="form-page success-page" aria-labelledby="success-title">
        <CheckCircle2 size={42} aria-hidden="true" />
        <p className="eyebrow">Request submitted</p>
        <h1 id="success-title">Your workshop is ready for review</h1>
        {workshop ? (
          <>
            <p className="workshop-code">{workshop.workshopCode}</p>
            <p className="status-line"><span>Status</span><strong>Pending review</strong></p>
            <div className="confirmation-message" role="status">
              {workshop.emailDeliveryMode === 'sent'
                ? `Confirmation email sent to ${workshop.confirmationEmail}.`
                : workshop.emailDeliveryMode === 'logged'
                  ? `Confirmation email HTML and text logged locally for ${workshop.confirmationEmail}.`
                  : `The request was saved, but the confirmation email could not be sent. Your tracking link is available below.`}
            </div>
            <div className="tracking-result">
              <div className="tracking-result-copy">
                <h2>Workshop tracking link</h2>
                <p>This link identifies the workshop. Email OTP verification is still required to view it.</p>
                <div className="tracking-url-row">
                  <a href={workshop.trackingUrl} target="_blank" rel="noreferrer">{workshop.trackingUrl}</a>
                  <button type="button" className="icon-button" onClick={() => void copyTrackingUrl()} aria-label="Copy tracking link" title="Copy tracking link">
                    {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  </button>
                </div>
                {copied ? <span className="copy-feedback" role="status">Link copied</span> : null}
                {copyError ? <span className="copy-feedback" role="status">Could not copy link</span> : null}
              </div>
              <img className="tracking-qr" src={workshop.qrCodeDataUrl} alt="QR code for the workshop tracking link" />
            </div>
          </>
        ) : (
          <p>Open this page after submitting a request to view its tracking link and QR code.</p>
        )}
        <Link className="primary-link" to="/">Return home</Link>
      </section>
    </main>
  );
}
