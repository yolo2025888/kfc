# Gemini Context: Hunlian Admin (SaaS Template)

## Project Overview

This is a Next.js 15 project serving as a SaaS template. It utilizes the App Router and is built with TypeScript. The architecture relies heavily on Supabase for backend services (Authentication, Database, Storage, Realtime).

### Key Technologies

*   **Framework:** Next.js 15.4.7 (App Router)
*   **Backend:** Supabase (Auth, Postgres DB, Storage, Realtime)
*   **UI:** Tailwind CSS, Radix UI, Lucide Icons, Shadcn UI (Checkbox, Tabs, Dialog)
*   **Loading Bar:** `nextjs-toploader` + `nprogress` manual triggers

## Core Features & Logic (Jan 2026 Updates)

### 1. Task Management System
*   **Platforms:** `xiaohongshu`, `douyin`, `gpt`, `other`.
*   **Smart ID:** Platform-prefixed IDs (e.g., `X-10001`) via Postgres trigger.
*   **New Field:** `guest_description` added to tasks for richer context.
*   **Lifecycle:** `open` -> `ongoing` -> `closed`. Closing a task wipes `user_tasks` and `leads` for a clean reset.
*   **Workspace UI:** Task images moved to top with "Preview/Long-press save" hints. Unified button styles for "Copy Title" and "Copy Content".

### 2. Advanced Review & Workflow System (Major Update - Jan 6)
The system now supports a highly collaborative, multi-stage workflow:

*   **Workflow States & Timestamps:**
    1.  `pending`: User submitted.
    2.  `verified`: Admin Approved -> `verified_at` recorded.
    3.  `claimed`: Auditor Claimed -> `claimed_at` recorded. Redirects immediately to detail.
    4.  `done` -> `completed` -> `rejected`.
*   **Time Tracking:** Real-time **Wait Timer** displayed in lists and details (counts up from `verified_at` until `claimed_at`). Timer resets on unclaim.
*   **Internal Collaboration (Admin & Auditor Only):**
    *   **Chat System:** Real-time internal communication with **Read/Unread status** based on page visibility (Visibility API).
    *   **Follow-up Module:** Dedicated `lead_followups` table for auditors to upload media (images/videos) and toggle "WeChat Added" status.
    *   **Unread Indicators:** Red pulse badges in the lead list for new internal messages.
*   **Data Privacy & Masking:**
    *   Auditors see masked contact info (e.g., `138****5678`) in public pools; full info revealed only after claiming.
    *   Sensitive info like "Post Links" and "Submitter Profiles" hidden from auditors.
*   **UI Structure:**
    *   **List Page (`/admin/reviews`):** Tab state persisted in URL (`?tab=...`). Added manual refresh button with loading state. Top refresh banner appears when new data arrives via Realtime.
    *   **Detail Page Refactor:** 50/50 split layout. Left side focuses on "Static Archives" (Time bar, Task details with collapsible requirements, Submission info + Proofs). Right side focuses on "Active Operations" (Follow-ups, Chat, Actions).
    *   **Image Editing:** Integrated `react-image-crop` for admins to crop and update proof images directly.

### 3. User Workspace & Self-Service
*   **My Leads Page:** Leads grouped by task with expandable rows. Aggregated stats (Total submitted vs. Passed).
*   **Resubmit Loop:** Users can re-edit and resubmit `rejected` leads. Direct Supabase update enabled via updated RLS policies.
*   **General UI:** Navigation bar prioritizes `full_name` for a personalized experience.

## Database Schema Highlights
*   **Leads Table:** Added `verified_at`, `claimed_at`. Updated RLS for user updates.
*   **Lead Comments Table:** For internal staff chat.
*   **Lead Reads Table:** Tracking last-read timestamps per user per lead.
*   **Lead Followups Table:** Media attachments and WeChat status.
*   **Views:** `lead_unread_view` for efficient unread count calculation.

## Building and Running
```bash
npm install
npm run dev
npx supabase gen types typescript --project-id vlrmlshxllbmsiofxftf > src/lib/types.ts
```

## Technical Implementations (Jan 6)
1.  **Global Realtime Singleton:** Standardized all listeners into a single global channel in `RealtimeProvider`. Dispatches custom window events (`new-lead-submitted`, `new-chat-message`) to trigger in-page updates without multiple WebSocket connections.
2.  **Smart Notifications:** Looping audio (`tip.wav`) until user interaction. Focus/Visibility based read-receipts.
3.  **RLS Hardening:** Configured complex cross-table RLS for staff-only tables.
4.  **Error Resilience:** Implemented time-buffers (10s) for read-status to handle server/client clock skew.


## Development Guidelines
1.  **Edge Runtime:** All dynamic routes must export `export const runtime = 'edge'`.
2.  **Admin Actions:** Use `/api/admin` routes to bypass RLS for profile/password updates.
3.  **Realtime:** Ensure table replication is enabled for `tasks`, `user_tasks`, and `leads`.

## Updates - Jan 14, 2026

### 1. Points System Transition
*   **Terminology Normalization**: Unified all currency-related terms (Yuan, ¥, r) to **"Points (积分)"** across the entire platform, including landing pages, user workspaces, and admin panels.
*   **Logic Alignment**: Task rewards and estimated earnings are now consistently represented as points.

### 2. Task Category Management
*   **Category Configuration**: Introduced `/admin/categories` for administrators to manage custom task categories.
*   **Task Association**: Tasks now support a `category_id` field.
*   **Visibility Control**: Added `visible_categories` to the `profiles` table, allowing admins to restrict user access to specific categories.

### 3. Exclusive Avatar Claiming System
*   **Exclusive Mechanism**: Implemented a "Claim" system for official avatars. Once a user claims an avatar, it is removed from the public pool, ensuring exclusive usage.
*   **Admin Oversight**: Admins can monitor claim status and claimants in the backend and "Release" (reset) avatars back to the pool if necessary.
*   **API Resilience**: Developed a manual distributed join logic in `unified.ts` for the `getAvatars` method to bypass PostgREST `PGRST200` errors related to schema cache desynchronization.

### 4. Advanced Filtering & UX Improvements
*   **Multi-dimensional Filtering**: Added combined filters for Platform, Category, Status, and Claimant across Admin Tasks, Review Center, and the User Task Hall.
*   **Date Filtering**: Integrated a specialized Date Picker (Calendar + Popover) to filter records by creation date.
*   **User Management**: The registered users list now supports filtering by roles (e.g., admin, auditor, user).
*   **Global Loading States**: Implemented **Relative-Absolute Loading Overlays** for all primary data tables to ensure smooth UI transitions during data fetching.
*   **Progress Feedback**: Manually integrated **TopLoader (NProgress)** triggers for critical async actions (Submit, Save, Delete, Claim) and all single-page application (SPA) route changes.

### 5. Utility & Stability Enhancements
*   **Robust Clipboard Support**: Encapsulated a `copyToClipboard` utility in `utils.ts` with an automatic fallback to `document.execCommand('copy')` for non-HTTPS or legacy environments.
*   **Realtime Optimization**: Refined `RealtimeProvider` logic to prevent self-triggered notification sounds when staff members edit records (e.g., cropping images).
*   **UI Modernization**: Integrated and styled `react-day-picker` v9 for better date selection interaction.
*   **User Deletion**: Enabled full user account deletion for admins, including secondary confirmation and automatic cleanup of associated data.

### 6. Maintenance & DevOps
*   **Database Synchronization**: Updated the `admin_tasks_stats_view` to include `leads_count` for better performance tracking.
*   **Type Safety**: Re-synchronized TypeScript definitions using `npx supabase gen types` to provide full support for new schema fields like `category_id` and `visible_categories`.

## Updates - Jan 18, 2026

### 1. Visibility & Permissions System (Platform & Category)
*   **Dual-Dimension Filtering**: Implemented `getTasksForUser` logic to filter tasks by both `visible_platforms` and `visible_categories`. Users now only see tasks matching their specific permissions.
*   **Admin UI Support**: Updated User Management (`/admin/users/[userId]`) to allow administrators to configure `visible_categories` for each user.
*   **Auditor Security**: Enforced strict server-side filtering in the Auditor Review Center (`/admin/reviews`). Auditors now only receive data authorized by their permissions, even without active frontend filters.

### 2. Mobile UI/UX Overhaul
*   **Global Layout Optimization**: Adjusted `AppLayout` to use responsive padding (`p-2 sm:p-4`), reclaiming screen real estate on mobile devices.
*   **Page Container Refinement**: Standardized containers in Tasks Hall, My Leads, and Task Workspaces to `max-w-7xl mx-auto px-1 sm:px-4`, eliminating double-padding issues.
*   **Visual Tuning**: 
    *   Reduced heading sizes (`text-3xl` -> `text-2xl`) on mobile.
    *   Tightened Card padding (`p-6` -> `p-4`) for compact information display.
    *   Optimized font sizes and spacing in form labels, badges, and list items.
    *   Improved hero image aspect ratios and action button layouts for touch interaction.

### 3. Logic & Stability Refinements
*   **Race Condition Fix**: Refactored `TasksPage` data loading to use `Promise.all` for fetching platforms, categories, and user profiles. This resolves a bug where filter dropdowns would momentarily show all options before permissions were applied.
*   **Simplified User Experience**: Removed the "Status" filter from the User Task Hall (users implicitly only see 'Open' tasks) and hid "Platform/Category" filters for Auditors in the Review Center (to focus on assigned work).

### 4. Login Experience
*   **Seamless Transition**: Modified `LoginPage` logic to persist the "Loading..." state after a successful login until the redirect completes. This eliminates the jarring "freeze" effect where the loading spinner disappeared before the new page loaded.

## Pending Features (As of Jan 18, 2026)

### 1. Post Stats Synchronization
*   **Objective**: Allow admins to manually trigger a data sync for user-submitted post links (e.g., from Xiaohongshu, Douyin) to fetch real-time stats like likes, comments, and check if the post is still active.
*   **Proposed UI**:
    *   Add a "Sync" or "Refresh" button next to the post link in the Admin Tasks list.
    *   Display fetched stats (e.g., 👍 1.2k, 💬 88) and a "Deleted" status if the post is no longer available.
*   **Proposed Technical Implementation**:
    *   **Database**: Add `post_stats (JSONB)` and `post_last_sync (TIMESTAMPTZ)` columns to the `user_tasks` table.
    *   **Backend**: Create a Node.js API route (e.g., `/api/admin/tasks/sync-post`) that uses `Puppeteer` or a well-disguised `fetch` request to scrape the post URL.
    *   **Status**: This feature is currently on hold and will be implemented upon user request.

## Updates - Jan 20, 2026

### 1. Admin Task List Enhancements
*   **Inline Status Editing**: Implemented a popover menu on the "审核状态" (`link_status`) column in the Admin Tasks list (`/admin/tasks`). Administrators can now directly change the status of a user's post link submission to "通过", "驳回", or "重置待审" without leaving the list view, speeding up the review workflow.

### 2. Hardcoding Cleanup & Dynamic Configuration
*   **Objective**: Remove hardcoded frontend logic for platform types (e.g., `xiaohongshu`, `douyin`).
*   **Implementation**: Conducted a full-codebase sweep and replaced static checks and fallbacks with dynamic data fetching from the `platforms` table. This affects task lists, detail pages, review centers, and user management settings.
*   **Outcome**: Platform configuration is now fully dynamic. Changes made in `/admin/platforms` (e.g., name, color) are instantly reflected across the entire application, significantly improving maintainability.

### 3. Enhanced Media Uploads
*   **Video Support for Tasks**: The "Create Task" modal for administrators now supports video uploads in addition to images.
*   **Unified Media Handling**: The `images` field in the `tasks` table is now used to store both image and video URLs.
*   **Frontend Adaptation**:
    *   Task creation previews now render `<video>` elements for video files.
    *   Task list and detail pages display video thumbnails or playable videos.
    *   The global `ImageViewer` component was upgraded to a `MediaViewer`, supporting both image display and video playback in a modal.

### 4. Lead & Task Information Editing
*   **Direct Editing in Review Detail**: On the lead review page (`/admin/reviews/[id]`), administrators can now directly edit:
    1.  **Lead Information**: `contact_info` and `social_id` of the current lead.
    2.  **Task Information**: The `guest_description` of the associated task (a global change affecting all instances of that task).
*   **UI Implementation**: Added "Edit" buttons that trigger modals for safe and explicit data modification.

### 5. Extended Follow-up Tracking
*   **"Called" Status**: Added a new "已电话沟通" (`is_called`) status tracker to the `lead_followups` table via a database migration.
*   **UI Integration**: In the lead review page's "对接信息" card, a new "已电话沟通" switch has been added below the "已添加微信" switch, allowing auditors to log more detailed follow-up actions.

## Updates - Jan 21, 2026

### 1. Universal Video & Media Support
*   **Full Lifecycle Video Support**: Extended video handling across all core modules.
    *   **Admin Review Center**: Admins can now preview video proofs in the review detail page.
    *   **User Workspace**: Users can preview task materials (images/videos) and submit video proofs. Added video thumbnails to submission history.
    *   **Resubmission Loop**: Users can now upload videos when resubmitting rejected leads.
    *   **Task Management**: Admin task creation now supports video uploads for "Task Materials" (formerly "Example Images").
*   **Media Viewer Upgrade**: Standardized the use of `MediaViewer` (ImageViewer) with full video playback support across all detail views.

### 2. Mobile UX & Saving Mechanism
*   **iOS Saving Optimization**: Refactored the download logic to use the **Web Share API (`navigator.share`)**. On iOS, this triggers the system Share Sheet, allowing users to "Save Video" or "Save Image" directly to the Photos app, bypassing browser download limitations.
*   **Explicit Action Buttons**: Added dedicated download buttons to task materials in the Workspace to facilitate easy saving for mobile users.
*   **Status Feedback**: Refined toast messages during media processing to provide clearer "Saving..." and "Completed" states.

### 3. Navigation & Performance
*   **Instant Feedback (Loading States)**: Implemented `loading.tsx` for all primary App Router segments (`/tasks`, `/leads`, `/admin/tasks`, `/admin/reviews`). This ensures immediate visual feedback (Spinner) during Server Component data fetching, eliminating "frozen" navigation perceptions.

### 4. UI Modernization (Task Hall)
*   **Flattened Filters**: Replaced dropdown `Select` components in the Task Hall with **Horizontally Scrollable Pill Buttons**. Users can now switch between Platforms and Categories with a single tap, optimized for mobile interaction.

### 5. Database Schema Hardening
*   **Constraint Decoupling**: Removed the legacy hardcoded `tasks_platform_check` constraint via a new migration (`20260121000000_remove_tasks_platform_check.sql`). Platform validation is now fully dynamic and delegated to the `platforms` table.

## Updates - Jan 22, 2026

### 1. Admin Task List Refinement
*   **Dynamic Time Tracking**: Updated `admin_tasks_stats_view` to include `participant_claimed_at`.
*   **Column Swap**: The Admin Tasks list now prioritizes **"Claim Time (领取时间)"** over creation time in the primary column. Unclaimed tasks show a placeholder `-`.
*   **Clean Layout**: Streamlined the "Claimant" column to a simple horizontal layout (Avatar + Name), moving the timestamp data to the primary time column.

### 2. Task Hall Logic & Diversity
*   **Fair Exposure Mechanism**: Implemented a new RPC `get_latest_tasks_for_user` that limits the display to **1 latest task per platform** per user. This prevents high-volume platforms from dominating the hall and ensures all active platforms are visible.
*   **Manual Refresh**: Added a persistent, animated "Refresh" button to the Task Hall header, allowing users to manually pull the latest Top 1 tasks.

### 3. Concurrency & Reliability
*   **Atomic Claiming**: Re-engineered the `join_task` RPC using an **Atomic Update Pattern** (`UPDATE ... WHERE status = 'open'`). This prevents race conditions where multiple users could simultaneously "claim" the same single-participant task.
*   **Failure Recovery**: Updated the Task Detail page to automatically redirect users back to the Hall after a 1.5s delay if a claim attempt fails (e.g., "Hand is slow, task taken").

### 4. Mobile UI/UX Polishing
*   **Vertical Hierarchy**: In the User Task Hall, split Badges (Platform/Category) and Task Titles into two separate rows. This provides more horizontal breathing room for tags and prevents text squishing on narrow devices.
*   **Squish Prevention**: Applied `flex-shrink-0` and `min-w-max` (via inline styles) to all filter pills and card badges to strictly forbid vertical text stacking (e.g., preventing "抖音" from becoming two lines).
*   **Global Warning Alert**: Integrated a bold, high-visibility orange warning bar above the task list to emphasize correct material usage ("乱接无效").
*   **Navigation Cleanup**: Standardized all task titles to use single-line `truncate` while maintaining multi-line `line-clamp` for content descriptions where appropriate.

## Updates - Jan 23, 2026

### 1. Admin Lead Assignment System
*   **Manual Dispatch**: Introduced a "Direct Assign" feature for administrators. Admins can now bypass the public pool and assign a `verified` lead directly to a specific auditor.
*   **Backend Implementation**: Created an atomic RPC `admin_assign_lead` to handle status transitions (`verified` -> `claimed`), auditor binding, and timestamping in a single transaction.
*   **UI Integration**:
    *   Added a "指定分配 (Assign)" button to the Lead Review detail page for administrator roles.
    *   Developed `AssignLeadDialog`, a searchable modal for selecting auditors with real-time profile previews.
    *   Optimized the dialog for environments without the `ScrollArea` component by using native scroll containers.

### 2. Landing Page Overhaul & Branding
*   **Visual Redesign**: Completely replaced the landing page (`/`) with a "Dopamine" style design, featuring:
    *   **Douyu Chase Font**: Integrated local `.otf` font with global CSS injection.
    *   **3D Interactive Elements**: Added a floating 3D revenue board with `requestAnimationFrame` powered scrolling.
    *   **Responsive Layout**: Optimized for both mobile and wide-screen desktop (up to 1600px width).
*   **Flow Optimization**: Removed all "Register" entry points. The landing page now exclusively funnels users to "Login" (`/auth/login`).
*   **Technical Fixes**:
    *   Resolved Hydration Mismatch errors by moving random data generation to `useEffect`.
    *   Fixed CSS priority issues by using `!important` and inline style injection to override global Tailwind defaults.
    *   Updated Favicon to a custom SVG ("K" logo).

### 3. Advanced Routing & Middleware
*   **Domain Isolation**: Implemented middleware logic to detect `qlei.com`. Users visiting the root path from this domain are physically redirected to the login page, bypassing the landing page entirely.
*   **Path Correction**: Fixed middleware redirect paths from `/app/auth/...` to the correct Next.js route `/auth/...`.

### 4. Admin UI/UX Refinement
*   **Navigation Structure**: Reorganized the Admin Sidebar into logical groups (Tasks, Avatars, Settings, Users) with visual separators (`hr`) and increased spacing.
*   **Visual Hierarchy**: Highlighted "客资中心 (Lead Center)" with a distinct Rose color scheme to emphasize its operational importance.
*   **Auth Layout**: Removed the "Back to Homepage" link from the login/register pages to prevent user leakage.

## Updates - Jan 29, 2026

### 1. Sub-category System (Second-level Categories)
*   **Database Architecture**: Extended the `categories` table with a `parent_id` field via migration `20260129000000_add_category_parent.sql` to support hierarchical relationships.
*   **Admin UI**: Updated the category management page (`/admin/categories`) to display a nested tree structure and implemented logic to prevent deletion of parent categories that contain children.

### 2. Advanced Task Creation (Batch & Cascade)
*   **Batch Creation Logic**: Refactored the Task Creation workflow to support **Multi-Platform** and **Multi-Category** selection simultaneously.
    *   **Mechanism**: The system now automatically generates a Cartesian product of selected platforms and categories, creating multiple independent tasks in a single click (e.g., Selecting 2 platforms and 3 categories creates 6 distinct tasks).
*   **Cascade Selection UI**: Replaced the flat category dropdown with a **Dual-Column Cascade Selector**.
    *   **Left Column**: Lists Parent Categories.
    *   **Right Column**: Lists Child Categories for the selected parent, allowing for precise multi-selection.
*   **UX Optimization**: Switched Platform selection to a flat Checkbox Group for faster interaction.

## Updates - Jan 30, 2026

### 1. Quick Registration System (Onboarding)
*   **New Flow**: Implemented a multi-step registration page at `/onboarding` featuring a "Claymorphism" UI design. Steps include: Experience Check -> Auto Location -> Platform Selection -> Account Binding -> WeChat Entry.
*   **Auto-Account Generation**: Backend now uses a Postgres Sequence (`user_short_id_seq`) to generate unique short IDs (e.g., `a10001`) starting from 10000. These serve as the primary username (mapped to `a10001@gmail.com` internally).
*   **Multi-Account Support**: Users can bind multiple accounts per platform (e.g., 2 Douyin IDs) during registration. These are stored in the new `user_platform_accounts` table.
*   **Entry Points**: Added "Register" buttons to the Landing Page header and floating CTA for guest users.

### 2. RBAC System Refactor (Role-Based Access Control)
*   **Database Architecture**: Introduced `app_roles`, `app_permissions`, and `app_role_permissions` tables to support dynamic permission management.
*   **Dynamic Menus**: Refactored `AppLayout.tsx` to fetch sidebar menus from `/api/auth/permissions` based on the user's role, replacing hardcoded lists.
*   **Admin UI**: Created **Role Management** (`/app/admin/roles`) for administrators to create roles and assign menu permissions via a checkbox tree.
*   **User Management Integration**: Updated "Add User" and "Edit User" pages to fetch roles dynamically. Users are now assigned a `custom_role_id` which takes precedence over the legacy `role` string.

### 3. Visibility Logic Hardening (Strict Whitelist)
*   **Logic Change**: Changed the default behavior of Task Visibility. Previously, "Unchecked" meant "View All". Now, **"Unchecked" means "View None"**.
*   **Implementation**: Updated `get_latest_tasks_for_user` RPC to enforce strict cardinality checks. If `visible_platforms` or `visible_categories` is empty/null, the API returns an empty list immediately.
*   **Bug Fixes**: Resolved SQL `400` errors (handling null arrays) and `42804` errors (column mismatch in RPC return types).

### 4. User Experience Improvements
*   **User Settings**: Enhanced `/app/users` to display "Basic Info" (Short ID, Location, WeChat) and a list of "Bound Platform Accounts" with verification status.
*   **Admin Detail View**: Updated the Admin User Detail page (`/admin/users/[id]`) to show all registration data (WeChat, Location, Accounts), providing admins with full user context.
*   **Deployment Fixes**: Added `export const runtime = 'edge'` to all new API routes (`quick-register`, `roles`, `permissions`) to ensure compatibility with Cloudflare Pages.

## Updates - Feb 02, 2026

### 1. Referral & Invitation System (Growth)
*   **Core Logic**: Implemented `invited_by` relationship in `profiles`. Used existing `short_id` as the unique invite code.
*   **Onboarding**: Updated `/onboarding` to capture `?invite=...` parameter and automatically bind the new user to the referrer upon registration.
*   **User UI**: Added an "Invite Friends" card in User Settings (`/app/users`) with a one-click copyable link (e.g., `.../onboarding?invite=a10001`).
*   **Admin UI**: Added an "Invite Count" column to the User Management list (`/app/admin/users`) to track user growth performance.
*   **Database**: Updated `user_stats_view` to include `invite_count`. Fixed schema migration conflicts by dropping and recreating the view.

### 2. Dynamic Role Management
*   **Refactor**: Replaced hardcoded role filtering in the Admin User List with dynamic data fetching from the `app_roles` table.
*   **Client**: Added `getRoles()` method to `unified.ts` for consistent data access.

### 3. Stability & Build Fixes
*   **Suspense Boundary**: Wrapped `OnboardingPage` content in `<Suspense>` to resolve Next.js build errors (`prerender-error`) caused by `useSearchParams` usage in a Client Component during static export.
