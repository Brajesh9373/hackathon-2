/**
 * NagarSetu API client for all backend communication
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

let accessToken = null;

// Initialize from localStorage (client-side only)
export function initAuth() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('nagarsetu_token');
  }
}

export function setToken(token) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('nagarsetu_token', token);
    document.cookie = `nagarsetu_token=${token}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nagarsetu_token');
    localStorage.removeItem('nagarsetu_refresh');
    localStorage.removeItem('nagarsetu_user');
    document.cookie = 'nagarsetu_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
  }
}

export function getStoredUser() {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('nagarsetu_user');
    return data ? JSON.parse(data) : null;
  }
  return null;
}

export function setStoredUser(user) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nagarsetu_user', JSON.stringify(user));
  }
}

async function request(path, options = {}) {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = localStorage.getItem('nagarsetu_token');
  }
  const url = `${API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });

    // Handle token refresh
    if (res.status === 401) {
      const data = await res.json();
      if (data.code === 'TOKEN_EXPIRED') {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          headers.Authorization = `Bearer ${accessToken}`;
          return fetch(url, { ...options, headers }).then(r => r.json());
        }
      }
      clearToken();
      if (typeof window !== 'undefined') window.location.href = '/';
      return data;
    }

    return res.json();
  } catch (err) {
    console.error('API request failed:', err);
    return { error: 'Network error - please check your connection' };
  }
}

async function refreshAccessToken() {
  try {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('nagarsetu_refresh') : null;
    if (!refreshToken) return false;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      setToken(data.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nagarsetu_refresh', data.refreshToken);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// === AUTH ===
export const auth = {
  sendOtp: (mobile) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ mobile }) }),
  verifyOtp: (mobile, otp) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ mobile, otp }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

// === COMPLAINTS ===
export const complaints = {
  file: (data) => request('/complaints', { method: 'POST', body: JSON.stringify(data) }),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/complaints?${qs}`);
  },
  get: (id) => request(`/complaints/${id}`),
  updateStatus: (id, status, note) => request(`/complaints/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  addTimeline: (id, data) => request(`/complaints/${id}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
  // The current civic workflow keeps a worker's submission in
  // AWAITING_VERIFICATION until the citizen confirms it.
  resolve: (id, data) => request(`/complaints/${id}/complete`, { method: 'POST', body: JSON.stringify({
    resolution_note: data?.resolution_note || data?.speaking_order || '',
    resolution_photos: data?.resolution_photos || [],
    geofence: data?.geofence,
  }) }),
  citizenVerify: (id, response) => response === 'confirmed'
    ? request(`/complaints/${id}/confirm`, { method: 'POST' })
    : request(`/complaints/${id}/follow-up`, { method: 'POST', body: JSON.stringify({ note: 'Citizen reported that the issue is still present.' }) }),
  deptVerify: (id, note) => request(`/complaints/${id}/dept-verify`, { method: 'POST', body: JSON.stringify({ note }) }),
  dmVerify: (id, note) => request(`/complaints/${id}/dm-verify`, { method: 'POST', body: JSON.stringify({ note }) }),
  citizenRate: (id, rating, feedback) => request(`/complaints/${id}/citizen-rate`, { method: 'POST', body: JSON.stringify({ rating, feedback }) }),
  escalate: (id, reason) => request(`/complaints/${id}/escalate`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cmFlag: (id) => request(`/complaints/${id}/cm-flag`, { method: 'POST' }),
  cmDirective: (id, directive) => request(`/complaints/${id}/cm-directive`, { method: 'POST', body: JSON.stringify({ directive }) }),
  extendSla: (id, hours, reason) => request(`/complaints/${id}/extend-sla`, { method: 'POST', body: JSON.stringify({ hours, reason }) }),
  assign: (id, officerId) => request(`/complaints/${id}/assign-worker`, { method: 'POST', body: JSON.stringify({ workerId: officerId }) }),
  assignSupervisor: (id, supervisorId) => request(`/complaints/${id}/assign-supervisor`, { method: 'POST', body: JSON.stringify({ supervisorId }) }),
  assignWorker: (id, workerId, equipment) => request(`/complaints/${id}/assign-worker`, { method: 'POST', body: JSON.stringify({ workerId, equipment }) }),
  myComplaints: () => request('/complaints/my'),
  officerQueue: () => request('/complaints/worker/tasks'),
  workerTasks: () => request('/complaints/worker/tasks'),
  supervisorQueue: () => request('/complaints/supervisor/queue'),
  startWork: (id) => request(`/complaints/${id}/start`, { method: 'POST' }),
  completeWork: (id, data) => request(`/complaints/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  citizenConfirm: (id) => request(`/complaints/${id}/confirm`, { method: 'POST' }),
  requestFollowUp: (id, note) => request(`/complaints/${id}/follow-up`, { method: 'POST', body: JSON.stringify({ note }) }),
  duplicateCheck: (lat, lng, category) => request(`/complaints/duplicate-check?lat=${lat}&lng=${lng}&category=${category}`),
};

export const agents = {
  forComplaint: (id) => request(`/agents/complaints/${id}`),
};
export const voiceIntake = { start: (safety) => request('/voice-intake/start', { method: 'POST', body: JSON.stringify({ safety }) }), result: (id, draft) => request(`/voice-intake/${id}/result`, { method: 'POST', body: JSON.stringify({ draft }) }), confirm: (id, edits) => request(`/voice-intake/${id}/confirm`, { method: 'POST', body: JSON.stringify({ edits }) }) };

// === CIVIC DECISION ENGINE ===
// Responses are intentionally kept structured here; the UI formats them into
// a short priority brief instead of rendering raw JSON.
export const priority = {
  evaluate: (id, updateComplaint = false) => request(`/civic/evaluate/${id}`, { method: 'POST', body: JSON.stringify({ update_complaint: updateComplaint }) }),
  optimize: (data = {}) => request('/civic/optimize', { method: 'POST', body: JSON.stringify(data) }),
  recalculate: (id, contextChanges, updateComplaint = false) => request(`/civic/recalculate/${id}`, { method: 'POST', body: JSON.stringify({ context_changes: contextChanges, update_complaint: updateComplaint }) }),
  factors: () => request('/priority/factors'),
};

// === ANALYTICS ===
export const analytics = {
  dashboard: () => request('/dashboard'),
  detailed: () => request('/analytics/detailed'),
  heatmap: () => request('/heatmap'),
  leaderboard: () => request('/leaderboard/districts'),
  officerLeaderboard: () => request('/leaderboard/officers'),
  defcon: () => request('/defcon'),
  trends: (days = 7) => request(`/trends?days=${days}`),
};

// === RESOURCES ===
export const resources = {
  supervisors: () => request('/complaints/admin/users'),
  officers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/officers?${qs}`);
  },
  createOfficer: (data) => request('/officers', { method: 'POST', body: JSON.stringify(data) }),
  officerScorecard: (id) => request(`/officers/${id}/scorecard`),
  departments: () => request('/departments'),
  department: (id) => request(`/departments/${id}`),
  districts: () => request('/districts'),
  notifications: () => request('/notifications'),
  readNotification: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/notifications/read-all', { method: 'POST' }),
  visits: () => request('/visits'),
  createVisit: (data) => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
  syncStatus: () => request('/external/sync-status'),
};
