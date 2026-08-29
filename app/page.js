'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, setToken, setStoredUser } from './lib/api';

const roles = [
  { id: 'admin', label: 'Admin', labelHi: 'प्रशासक', icon: '🏛️', desc: 'Municipal Officer', phone: '+919999000001' },
  { id: 'supervisor', label: 'Supervisor', labelHi: 'पर्यवेक्षक', icon: '👨‍💼', desc: 'Field Supervisor', phone: '+919999000002' },
  { id: 'worker', label: 'Worker', labelHi: 'कार्यकर्ता', icon: '👷', desc: 'Field Worker', phone: '+919999000010' },
  { id: 'citizen', label: 'Citizen', labelHi: 'नागरिक', icon: '👤', desc: 'File & Track', phone: '+919800000001' },
];

export default function LoginPage() {
  const [step, setStep] = useState('role');
  const [selectedRole, setSelectedRole] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const subdomain = urlParams.get('subdomain');
      
      if (subdomain === 'citizen') {
        setSelectedRole('citizen');
        setPhone('+91 9800000001');
      } else if (subdomain === 'supervisor') {
        setSelectedRole('supervisor');
        setPhone('+91 9999000002');
      } else if (subdomain === 'admin') {
        setSelectedRole('admin');
        setPhone('+91 9999000001');
      } else if (subdomain === 'worker') {
        setSelectedRole('worker');
        setPhone('+91 9999000010');
      }
    }
  }, []);

  const handlePhoneChange = (e) => {
    let input = e.target.value;
    if (!input.startsWith('+91')) {
      let digits = input.replace(/\D/g, '');
      if (digits.startsWith('91')) digits = digits.slice(2);
      input = '+91' + digits;
    }
    let suffix = input.substring(3);
    let digits = suffix.replace(/\D/g, '').slice(0, 10);
    setPhone('+91 ' + digits);
  };

  const isPhoneValid = phone.replace(/\D/g, '').length === 12;

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!isPhoneValid) return;
    setIsLoading(true);
    setError('');
    const cleanPhone = phone.replace(/\s+/g, '');
    const result = await auth.sendOtp(cleanPhone);
    setIsLoading(false);
    if (result.success) {
      setOtpSent(true);
      setStep('otp');
    } else {
      setError(result.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) return;
    setIsLoading(true);
    setError('');
    const cleanPhone = phone.replace(/\s+/g, '');
    const result = await auth.verifyOtp(cleanPhone, otp);
    setIsLoading(false);
    if (result.success) {
      setToken(result.accessToken);
      localStorage.setItem('vaani_refresh', result.refreshToken);
      setStoredUser(result.user);
      redirectByRole(result.user.role);
    } else {
      setError(result.error || 'Invalid OTP');
    }
  };

  const redirectByRole = (role) => {
    switch (role) {
      case 'citizen': router.push('/citizen'); break;
      case 'admin': router.push('/dashboard'); break;
      case 'supervisor': router.push('/supervisor'); break;
      case 'worker': router.push('/worker'); break;
      default: router.push('/dashboard');
    }
  };

  const handleQuickDemo = async (role) => {
    setSelectedRole(role.id);
    setIsLoading(true);
    setError('');
    setPhone(role.phone);
    const cleanPhone = role.phone.replace(/\s+/g, '');
    await auth.sendOtp(cleanPhone);
    const result = await auth.verifyOtp(cleanPhone, '123456');
    setIsLoading(false);
    if (result.success) {
      setToken(result.accessToken);
      localStorage.setItem('vaani_refresh', result.refreshToken);
      setStoredUser(result.user);
      redirectByRole(result.user.role);
    } else {
      redirectByRole(role.id);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-emblem">🏛️</div>
          <h1 className="login-title">KOPARGAON</h1>
          <p style={{ fontSize: '12px', color: 'var(--t2)', fontWeight: 600, marginTop: '4px' }}>
            Civic Platform
          </p>
          <p className="login-subtitle">कोपरगांव नागरिक मंच</p>
          <p style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '4px' }}>
            Kopargaon Municipal Council, Nashik, Maharashtra
          </p>
          <div className="login-tricolor" />
        </div>

        {error && (
          <div style={{
            background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)', color: '#C62828', fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-4)', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {step === 'role' && (
          <>
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
                Select Role / भूमिका चुनें
              </p>
              <div className="login-role-grid">
                {roles.map(role => (
                  <button
                    key={role.id}
                    className={`login-role-btn ${selectedRole === role.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedRole(role.id);
                      setPhone(role.phone);
                    }}
                  >
                    <span className="login-role-icon">{role.icon}</span>
                    <div className="login-role-text-container">
                      <span className="login-role-label">{role.label}</span>
                      <span className="login-role-label-hi">{role.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSendOTP}>
              <div className="form-group">
                <label className="form-label">Mobile Number / मोबाइल नंबर</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 XXXXXXXXXX"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!isPhoneValid || isLoading}
                style={{ width: '100%', marginTop: 'var(--space-4)' }}
              >
                {isLoading ? 'Sending OTP...' : '📱 Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP}>
            <div style={{
              background: 'var(--color-green-surface)', padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)',
              textAlign: 'center', fontSize: 'var(--text-sm)',
            }}>
              OTP sent to <strong>{phone}</strong>
              <div style={{ marginTop: 4, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                Demo OTP: <strong>123456</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Enter OTP / OTP दर्ज करें</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                style={{ fontSize: 'var(--text-2xl)', textAlign: 'center', letterSpacing: '8px', fontFamily: 'var(--font-mono)' }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={otp.length < 6 || isLoading}
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
            >
              {isLoading ? 'Verifying...' : '🔐 Verify & Login'}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setStep('role'); setOtp(''); setError(''); }}
              style={{ width: '100%', marginTop: 'var(--space-3)' }}
            >
              ← Change Number
            </button>
          </form>
        )}

        <div className="login-quick-demo">
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Quick Demo Access
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {roles.map(role => (
              <button key={role.id} className="btn btn-outline btn-sm" onClick={() => handleQuickDemo(role)}>
                {role.icon} {role.label}
              </button>
            ))}
          </div>
        </div>

        <div className="login-footer">
          <p>Kopargaon Municipal Council</p>
          <p style={{ marginTop: '4px' }}>कोपरगांव नगर परिषद</p>
        </div>
      </div>
    </div>
  );
}
