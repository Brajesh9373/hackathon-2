'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, setStoredUser, setToken } from './lib/api';

const roles = [
  { id: 'citizen', name: 'Citizen', desc: 'Raise an issue and follow every update.', icon: '✦', phone: '+918282909044', tint: 'coral' },
  { id: 'admin', name: 'Admin', desc: 'Route demand across the civic network.', icon: '◈', phone: '+919999000023', tint: 'blue' },
  { id: 'supervisor', name: 'Supervisor', desc: 'Prioritise work and keep crews moving.', icon: '⌁', phone: '+919999000004', tint: 'amber' },
  { id: 'worker', name: 'Worker', desc: 'See your queue, evidence and completed work.', icon: '↗', phone: '+919999000005', tint: 'teal' },
];

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('citizen');
  const [phone, setPhone] = useState('+91 8282909044');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('role');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const role = roles.find(item => item.id === selected) || roles[0];

  const chooseRole = item => { setSelected(item.id); setPhone(`+91 ${item.phone.slice(3)}`); setError(''); };
  const finishLogin = result => {
    if (!result?.success) return false;
    setToken(result.accessToken);
    if (typeof window !== 'undefined') localStorage.setItem('nagarsetu_refresh', result.refreshToken || '');
    setStoredUser({ ...result.user, portalRole: selected, portalName: role.name });
    router.push(`/${selected}`);
    return true;
  };
  const sendOtp = async event => {
    event.preventDefault();
    if (phone.replace(/\D/g, '').length < 12) return setError('Enter a 10-digit mobile number.');
    setBusy(true); setError('');
    const result = await auth.sendOtp(phone.replace(/\s/g, ''));
    setBusy(false);
    if (result?.success) setStep('otp'); else setError(result?.error || 'Could not send the code. Try again.');
  };
  const verifyOtp = async event => {
    event.preventDefault(); setBusy(true); setError('');
    const result = await auth.verifyOtp(phone.replace(/\s/g, ''), otp || '123456');
    setBusy(false);
    if (!finishLogin(result)) setError(result?.error || 'That code did not work.');
  };
  const demoLogin = async () => {
    setBusy(true); setError('');
    await auth.sendOtp(role.phone);
    const result = await auth.verifyOtp(role.phone, '123456');
    setBusy(false);
    if (!finishLogin(result)) setError(result?.error || 'Demo workspace is unavailable.');
  };

  return <main className="v-login">
    <div className="v-login-grid" />
    <section className="v-login-brand"><span className="v-brand-mark v-brand-mark-large">N</span><div><strong>NAGARSETU</strong><span>civic operations, clearly connected</span></div><p>One shared register for the people who raise, route, supervise and complete public work.</p><div className="v-login-quote"><span>“</span><strong>Every complaint gets a clear owner<br />and a visible next step.</strong></div></section>
    <section className="v-login-panel"><div className="v-login-kicker">KOPARGAON MUNICIPAL COUNCIL <span>•</span> SECURE DEMO</div><h1>Choose your<br /><em>workspace.</em></h1><p className="v-login-lede">Start where you belong. You can move through the entire service journey with one simple sign-in.</p>
      {step === 'role' ? <>
        <div className="v-role-grid">{roles.map(item => <button type="button" key={item.id} className={`v-role-card ${selected === item.id ? 'is-selected' : ''}`} onClick={() => chooseRole(item)}><span className={`v-role-icon v-role-${item.tint}`}>{item.icon}</span><span><strong>{item.name}</strong><small>{item.desc}</small></span><b>↗</b></button>)}</div>
        <form className="v-login-form" onSubmit={sendOtp}><label>Mobile number<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></label><button className="v-button v-button-primary v-button-wide" disabled={busy}>{busy ? 'Sending…' : 'Continue with mobile'}</button></form>
        <button className="v-demo-link" type="button" onClick={demoLogin} disabled={busy}>Use the demo workspace</button>
      </> : <form className="v-login-form" onSubmit={verifyOtp}><div className="v-otp-note"><span className="v-role-icon v-role-teal">✓</span><div><strong>Code sent to {phone}</strong><small>Use 123456 in the demo environment.</small></div></div><label>One-time code<input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" autoFocus /></label><button className="v-button v-button-primary v-button-wide" disabled={busy}>{busy ? 'Opening…' : 'Open workspace'}</button><button type="button" className="v-demo-link" onClick={() => setStep('role')}>← Change workspace</button></form>}
      {error && <p className="v-form-error">{error}</p>}<small className="v-login-foot">By continuing, you agree to use this civic workspace responsibly.</small>
    </section>
  </main>;
}
