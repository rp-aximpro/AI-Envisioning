import { Link } from 'react-router-dom';

import { PortalHeader } from '../PortalHeader.js';

export function HomePage() {
  return <main className="app-shell"><PortalHeader /><section className="portal-intro"><p className="eyebrow">Dell + Microsoft</p><h1>AI Envisioning Workshops</h1><p>Request and manage a tailored AI Envisioning Workshop.</p><Link className="primary-link" to="/request/auth">Request a workshop</Link></section></main>;
}
