# EcoGuía SOS: Product Context

## Tech Stack
*   **Frontend**: Vanilla HTML, CSS, and Javascript.
*   **Database & Auth**: Supabase (PostgreSQL with RLS).
*   **Maps**: MapLibre GL JS / Google Maps API (Mixed).
*   **Styling**: Custom CSS following **Organic Biophilic** and **Bento Grid** principles.
*   **Deployment**: Vercel (Production) at `ecoguiasos.com`.
*   **Source Control**: GitHub.

## User Roles & Permissions
1.  **Super Admin**: Total control over all users, organizations, and events. Review and approve/reject submissions.
2.  **Verified Actor (Org)**: Trusted organization. Events are auto-published. Can clone events and view basic interest metrics.
3.  **Actor (Org)**: New organization. Events require Admin approval. Can manage and clone own events.
4.  **Registered User**: Public user with an account. Can save favorites (interesados), get notifications, and earn badges (EcoOficial).
5.  **Public Guest**: Can browse all approved events and use the map without logging in.

## Core Workflows
1.  **Event Submission**: Actor fills out a modal form on a public page -> state `pending` -> Admin notifies -> Admin approves -> state `approved` -> Event visible.
2.  **Event Cloning**: Actor selects a previous event -> "Clone" -> New `pending` event created with same details.
3.  **Interest Tracking**: User clicks "I'm Interested" -> Registration record created -> Actor sees participant count.
4.  **Verification**: Actor requests verification -> Admin reviews -> `is_verified` set to true -> Auto-publishing enabled.
