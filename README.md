# Issue Tracker

Internal issue tracking system for logging customer and technical issues.

## Features

- **Issue Management** — Create, edit, track issues with full lifecycle (Open → In Progress → Resolved → Closed)
- **Custom Fields** — Admin can dynamically add new fields (text, number, date, dropdown, textarea)
- **Comments** — Threaded comments with username, date and time
- **File Attachments** — Upload and download files on any issue (10MB limit)
- **Dashboard** — Charts and metrics: open issues, SLA status, weekly trends, issues by customer/priority/assignee
- **SLA Tracking** — Per-customer SLA targets by priority (High/Medium/Low), with On Track / At Risk / Breached indicators
- **Search & Filter** — Search by title, description, issue number. Filter by status, priority, customer, assignee
- **CSV Export** — Export filtered issues with all fields including custom fields
- **Admin Panel** — Manage users, customers, dropdown options, custom fields, SLA settings
- **Authentication** — Username/password login with email password reset
- **Responsive** — Works on desktop, tablet, and mobile
- **Customisable Theme** — Dark/light mode and 5 accent colour themes

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Backend**: Node.js, Express
- **Database**: SQLite (via better-sqlite3, WAL mode for concurrent access)
- **Auth**: JWT tokens, bcrypt password hashing

## Quick Start

```bash
# Install all dependencies
npm run setup

# Start development servers (API + React)
npm run dev
```

This starts:
- API server on `http://localhost:3001`
- React dev server on `http://localhost:5173`

### Default Login

- **Username:** `admin`
- **Password:** `admin123`

> Change the admin password after first login via Admin → Users → Edit.

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `JWT_SECRET` | Secret for JWT tokens | `dev-secret-...` |
| `SMTP_HOST` | Email server host | — |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email username | — |
| `SMTP_PASS` | Email password | — |
| `SMTP_FROM` | From address for emails | — |
| `APP_URL` | Public URL (for email links) | `http://localhost:5173` |

Email is optional — if SMTP is not configured, email content is logged to the console.

## Production Build

```bash
npm run build   # Builds the React client
npm start       # Starts production server on PORT
```

In production, Express serves the built React app and the API from a single server.

## Deploy to Render.com

1. Push this repository to GitHub
2. Create a new Web Service on Render, linked to the repo
3. Render will auto-detect the `render.yaml` configuration
4. The service includes a persistent disk for the SQLite database

## Deploy with Docker

```bash
docker build -t issue-tracker .
docker run -p 3001:3001 -v issue-data:/app/data -v issue-uploads:/app/uploads issue-tracker
```

## Project Structure

```
├── server.js              # Express server entry point
├── database.js            # SQLite setup and schema
├── middleware/auth.js      # JWT authentication
├── routes/
│   ├── auth.js            # Login, password reset
│   ├── issues.js          # Issue CRUD
│   ├── comments.js        # Issue comments
│   ├── attachments.js     # File uploads/downloads
│   ├── users.js           # User management (admin)
│   ├── admin.js           # Dropdowns, custom fields, customers
│   ├── dashboard.js       # Dashboard metrics and charts
│   └── export.js          # CSV export
├── utils/email.js         # Email notifications
├── client/                # React SPA
│   └── src/
│       ├── components/    # Layout, Modal
│       ├── context/       # Auth context
│       ├── pages/         # All application pages
│       └── services/      # API client (Axios)
├── Dockerfile
└── render.yaml            # Render.com deployment config
```

## Issue Fields

Built-in fields: Title, Description, Status, Priority, Type, Customer, Part Affected, Unit Affected, Engineering Change, Assigned To, Open Date, Closed Date, Days Open.

Additional fields can be added at any time via Admin → Custom Fields.

## SLA Configuration

SLA targets are set per customer in Admin → Customers. Each customer has separate targets (in days) for High, Medium, and Low priority issues.

- **On Track** — Less than 80% of SLA target elapsed
- **At Risk** — 80–100% of SLA target elapsed
- **Breached** — Over the SLA target
