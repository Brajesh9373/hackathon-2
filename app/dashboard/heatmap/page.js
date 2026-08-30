import { redirect } from 'next/navigation';

// The retired dashboard surface used its own static complaint register. Keep
// old bookmarks working, but send them to the single live admin map instead.
export default function LegacyHeatmapRedirect() {
  redirect('/admin/heatmap');
}
