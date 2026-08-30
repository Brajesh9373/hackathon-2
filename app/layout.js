import './globals.css';
import './civic.css';

export const metadata = {
  title: 'VAANI — Civic operations, clearly connected',
  description: 'A shared civic operations workspace for citizens, administrators, supervisors and field workers.',
  keywords: 'VAANI, Kopargaon Municipal Council, civic complaints, public service',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
