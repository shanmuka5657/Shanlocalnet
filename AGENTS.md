# Project Overview: LocalNet (Shanlocalnet)

## Workspace Context
LocalNet is a hyper-local social entertainment and neighborhood commerce platform architected for AWS Mumbai (`ap-south-1`) and PostgreSQL 16 + PostGIS 3.4, with a React 19 + TypeScript frontend, Vite, Express fullstack backend, and Capacitor Android mobile app.

## Repository Structure
- `src/`: React frontend (Vite, TailwindCSS, Motion, Lucide)
  - `src/components/`: UI components (HomeFeed, ReelsView, BusinessAdHub, StudioTimeline, TopNavigation, ProfileView, MarketplaceView, etc.)
  - `src/context/`: Location & session context
  - `src/db/`: Database schemas, repositories, and PostGIS spatial queries
- `android/`: Native Android project with Capacitor
- `server.ts`: Express + Vite full-stack server
- `capacitor.config.ts`: Capacitor configuration
- `package.json`: Dependencies and scripts

## Common Development Commands
- Start dev server: `npm run dev`
- Build app: `npm run build`

