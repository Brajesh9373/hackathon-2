export const metadata = {
  title: 'Kopargaon Civic Platform',
  description: 'Municipal Council Citizen Grievance Management System for Kopargaon',
};

const globalStyles = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --c1: #1a237e; --c2: #0d1259; --c3: #FF6F00; --c4: #2E7D32;
  --bg: #f5f5f5; --s: #fff; --t: #212121; --t2: #616161;
  --bd: #e0e0e0; --r: 8px; --sh: 0 2px 8px rgba(0,0,0,0.1);
}
body { font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.5; color: var(--t); background: var(--bg); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 16px; border-radius: var(--r); border: none; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; }
.btn-primary { background: var(--c1); color: white; }
.btn-primary:hover { background: var(--c2); }
.btn-outline { background: transparent; border: 1.5px solid var(--bd); color: var(--t); }
.btn-outline:hover { background: #e8eaf6; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--c1) 0%, var(--c2) 100%); padding: 16px; }
.login-card { background: var(--s); padding: 32px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); width: 100%; max-width: 440px; }
.login-header { text-align: center; margin-bottom: 24px; }
.login-emblem { font-size: 3.5rem; margin-bottom: 12px; }
.login-title { font-size: 1.875rem; font-weight: 800; letter-spacing: 4px; color: var(--c1); margin: 0; }
.login-subtitle { color: var(--t2); margin-top: 4px; font-size: 0.875rem; }
.login-tricolor { height: 4px; background: linear-gradient(to right, #FF9933 33%, white 33% 66%, #138808 66%); margin-top: 20px; border-radius: 9999px; }
.login-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.login-role-btn { display: flex; flex-direction: column; align-items: center; padding: 16px; border: 2px solid var(--bd); border-radius: var(--r); background: var(--s); cursor: pointer; transition: all 0.2s; }
.login-role-btn:hover, .login-role-btn.active { border-color: var(--c1); background: #e8eaf6; }
.login-role-icon { font-size: 1.75rem; margin-bottom: 8px; }
.login-role-label { font-weight: 600; color: var(--t); font-size: 0.875rem; }
.login-role-label-hi { font-size: 0.75rem; color: var(--t2); margin-top: 2px; }
.login-quick-demo { margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; }
.login-footer { text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee; color: var(--t2); font-size: 0.875rem; }
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-weight: 600; margin-bottom: 8px; color: var(--t2); font-size: 0.875rem; }
.form-input { width: 100%; padding: 12px 16px; border: 1.5px solid var(--bd); border-radius: var(--r); font-size: 1rem; font-family: inherit; transition: border-color 0.2s; }
.form-input:focus { outline: none; border-color: var(--c1); box-shadow: 0 0 0 3px rgba(26,35,126,0.1); }
.card { background: var(--s); border-radius: 12px; box-shadow: var(--sh); padding: 20px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
.card-title { font-size: 1.125rem; font-weight: 700; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--s); border-radius: 12px; padding: 20px; box-shadow: var(--sh); display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 48px; height: 48px; border-radius: var(--r); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.stat-icon.primary { background: #e8eaf6; }
.stat-icon.success { background: #e8f5e9; }
.stat-icon.warning { background: #fff3e0; }
.stat-icon.danger { background: #ffebee; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--t); line-height: 1; }
.stat-label { font-size: 0.875rem; color: var(--t2); margin-top: 4px; }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge-filed { background: #E3F2FD; color: #1565C0; }
.badge-assigned { background: #FFF3E0; color: #E65100; }
.badge-in_progress { background: #FFF8E1; color: #F57F17; }
.badge-completed { background: #E8F5E9; color: #2E7D32; }
.badge-closed { background: #ECEFF1; color: #546E7A; }
.alert { padding: 16px; border-radius: var(--r); margin-bottom: 16px; display: flex; align-items: flex-start; gap: 12px; }
.alert-success { background: #e8f5e9; border: 1px solid #a5d6a7; color: #1b5e20; }
.alert-danger { background: #ffebee; border: 1px solid #ef9a9a; color: #b71c1c; }
.text-center { text-align: center; }
.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--t2); }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
.mb-4 { margin-bottom: 16px; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: 8px; }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
