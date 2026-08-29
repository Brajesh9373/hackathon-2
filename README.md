# Kopargaon Civic Platform

**Resource-Constrained Civic Decision & Response Platform**

A civic complaint management system for Kopargaon Municipal Council, Nashik, Maharashtra that helps prioritize and allocate limited municipal resources effectively.

---

## System Overview

### Roles

| Role | Responsibility |
|------|---------------|
| **Citizen** | File complaints, track status, confirm resolution |
| **Admin/Officer** | Route complaints to supervisors (no prioritization) |
| **Field Supervisor** | Prioritize, assign workers, verify completion |
| **Worker** | Execute assigned tasks |

### Complaint Flow

```
CITIZEN files complaint
        ↓
ADMIN routes to supervisor
        ↓
SUPERVISOR views queue
        ↓
PRIORITY ENGINE calculates priority
        ↓
SUPERVISOR approves/overrides
        ↓
Assign worker + equipment
        ↓
Worker completes + uploads proof
        ↓
Supervisor verifies
        ↓
Citizen confirms: Fixed? YES/NO
        ↓
Closed or Reopened
```

---

## Priority Engine

The system includes a **smart priority engine** that calculates:

- **Impact** - How many people affected
- **Urgency** - How quickly it needs action
- **Risk** - What happens if we wait
- **Context** - Current conditions (weather, events)
- **Confidence** - How sure are we about the data

### API Endpoints

```
POST /api/priority/evaluate     - Evaluate single issue
POST /api/priority/optimize    - Optimize batch with resources
POST /api/priority/recalculate - Recalculate when context changes
GET  /api/priority/factors     - Get priority factors info
```

---

## Quick Start

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
npm install
npm run dev
```

### Demo Accounts

| Role | Phone | OTP |
|------|-------|-----|
| Admin | +91 9999000001 | 123456 |
| Supervisor | +91 9999000002 | 123456 |
| Worker | +91 9999000010 | 123456 |
| Citizen | +91 9800000001 | 123456 |

---

## Tech Stack

- **Frontend**: Next.js 16, React
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Priority Engine**: Custom Node.js module

---

## Kopargaon Municipal Council

Location: Kopargaon, Taluka Kopargaon, District Ahilya Bai Nagar (Nashik), Maharashtra 423601
