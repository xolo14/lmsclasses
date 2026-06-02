<<<<<<< HEAD
# LMS Platform

Production-grade Learning Management System built with **Next.js 14**, **TypeScript**, **NeonDB (PostgreSQL)**, **Drizzle ORM**, **NextAuth.js v5**, **Tailwind CSS**, and **shadcn/ui**.

## Features

- **5 role-based portals**: Super Admin, Organisation Admin, Manager, Mentor, Student
- **Slot-based enrollment**: Org admins purchase course slots via Razorpay
- **Live classes**: Schedule classes, notify mentors via email
- **Audit logging**: Immutable trail for all mutations
- **Dark professional UI**: Navy/slate theme with cyan accents

## Quick Start

### 1. Install dependencies

```bash
cd lms-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | NeonDB PostgreSQL connection string |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Random secret for JWT sessions |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay payment credentials |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public Razorpay key for checkout |

### 3. Push database schema

```bash
npm run db:push
```

### 4. Seed super admin

```bash
npm run seed
```

Default credentials: `superadmin@lms.com` / `SuperAdmin@123`

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login)

## Project Structure

```
app/
├── (auth)/login/          # Unified login
├── super-admin/           # Super Admin portal
├── manager/               # Manager portal (no Payments)
├── org-admin/             # Organisation Admin portal
├── mentor/                # Mentor portal
├── student/               # Student portal
└── api/                   # REST API routes

components/
├── layout/                # Sidebars, TopBar, PortalLayout
├── modals/                # CRUD modals
├── tables/                # DataTable wrapper
├── charts/                # KpiCard
└── ui/                    # shadcn/ui components

lib/
├── db/                    # Drizzle schema + connection
├── auth.ts                # NextAuth config
├── audit.ts               # Audit log helper
├── email.ts               # Resend templates
└── validations/           # Zod schemas
```

## Role Routes

| Role | Login Redirect | Base Path |
|------|---------------|-----------|
| Super Admin | `/super-admin/dashboard` | `/super-admin/*` |
| Manager | `/manager/dashboard` | `/manager/*` |
| Org Admin | `/org-admin/dashboard` | `/org-admin/*` |
| Mentor | `/mentor/live-classes` | `/mentor/*` |
| Student | `/student/courses` | `/student/*` |

## Slot System

1. Super Admin creates courses with per-slot pricing
2. Org Admin buys slots via Razorpay on the Courses page
3. Org Admin adds students — each enrollment consumes one slot
4. Deleting a student frees the slot
5. Slots never expire

## Payment Flow (Razorpay)

When Razorpay is not configured, the system runs in **mock mode** — payments are verified automatically without a real checkout. Configure Razorpay keys in `.env.local` for production.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- NeonDB + Drizzle ORM
- NextAuth.js v5 (JWT)
- TanStack Query + Table
- React Hook Form + Zod
- Recharts
- Resend + Razorpay
- Tailwind CSS + shadcn/ui
=======
# lmsclasses
>>>>>>> 42222c322efe267c1b2973b42793143089688d6d
