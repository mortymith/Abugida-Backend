# Abugida Academy — UX Design Specification

This document is the authoritative user-experience blueprint for the Abugida Academy course-operations platform. It specifies every screen, workflow, shared component, and design-system token required to design, build, and evaluate the product. It is written for cross-functional use by product designers, engineers, QA, and stakeholders, and it describes the target experience rather than any particular release of it.

**Scope:** The admin-facing workspace — authentication, dashboard, courses, content library, students, analytics, marketing, and settings.
**Convention:** Screens carry stable IDs (`S-x.y`) that are referenced throughout the document; every screen ID in the sitemap links to the module file that holds its full definition.

---

## High-Level Sitemap / Page Hierarchy

| Section / Module                   | Screen Name                                 | Screen ID                                            |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| **0. Authentication & Onboarding** | Login                                       | [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1) |
|                                    | Organization Sign-Up & Onboarding           | [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) |
|                                    | Multi-Factor Authentication Challenge       | [S-0.3](01-Authentication-and-Onboarding.md#scr-0-3) |
| **A. Global Navigation**           | Main App Shell (Sidebar + Header)           | [S-A.1](02-Global-Navigation.md#scr-a-1)             |
| **1. Dashboard**                   | Analytics Overview                          | [S-1.1](03-Dashboard.md#scr-1-1)                     |
|                                    | Revenue Analytics                           | [S-1.2](03-Dashboard.md#scr-1-2)                     |
|                                    | Global Search Results                       | [S-1.3](03-Dashboard.md#scr-1-3)                     |
|                                    | Notifications Center                        | [S-1.4](03-Dashboard.md#scr-1-4)                     |
| **2. Courses (Primary)**           | Course Catalog / Grid                       | [S-2.1](04-Courses.md#scr-2-1)                       |
|                                    | Course Creation Wizard (Step 1: Details)    | [S-2.2](04-Courses.md#scr-2-2)                       |
|                                    | Course Creation Wizard (Step 2: Curriculum) | [S-2.3](04-Courses.md#scr-2-3)                       |
|                                    | Course Creation Wizard (Step 3: Pricing)    | [S-2.4](04-Courses.md#scr-2-4)                       |
|                                    | Course Creation Wizard (Step 4: Publish)    | [S-2.5](04-Courses.md#scr-2-5)                       |
|                                    | Course Detail / Curriculum Builder          | [S-2.6](04-Courses.md#scr-2-6)                       |
|                                    | Lesson Editor                               | [S-2.7](04-Courses.md#scr-2-7)                       |
|                                    | Quiz Builder                                | [S-2.8](04-Courses.md#scr-2-8)                       |
|                                    | Live Session Scheduler                      | [S-2.9](04-Courses.md#scr-2-9)                       |
|                                    | Certificates & Completion Rules             | [S-2.10](04-Courses.md#scr-2-10)                     |
|                                    | AI Course Generator                         | [S-2.11](04-Courses.md#scr-2-11)                     |
|                                    | Template Library                            | [S-2.12](04-Courses.md#scr-2-12)                     |
|                                    | Bulk Module & Lesson Import                 | [S-2.13](04-Courses.md#scr-2-13)                     |
|                                    | Review & Approval Queue                     | [S-2.14](04-Courses.md#scr-2-14)                     |
|                                    | Prerequisites & Unlock Rules                | [S-2.15](04-Courses.md#scr-2-15)                     |
|                                    | AI Quiz Generator                           | [S-2.16](04-Courses.md#scr-2-16)                     |
| **3. Content Library**             | Asset Repository                            | [S-3.1](05-Content-Library.md#scr-3-1)               |
|                                    | Asset Upload Modal                          | [S-3.2](05-Content-Library.md#scr-3-2)               |
|                                    | Asset Detail View                           | [S-3.3](05-Content-Library.md#scr-3-3)               |
|                                    | Folders & Collections                       | [S-3.4](05-Content-Library.md#scr-3-4)               |
|                                    | File Preview Modal                          | [S-3.5](05-Content-Library.md#scr-3-5)               |
|                                    | Transcription & Subtitle Editor             | [S-3.6](05-Content-Library.md#scr-3-6)               |
| **4. Students**                    | Student Directory                           | [S-4.1](06-Students.md#scr-4-1)                      |
|                                    | Student Profile                             | [S-4.2](06-Students.md#scr-4-2)                      |
|                                    | Student Progress Dashboard                  | [S-4.3](06-Students.md#scr-4-3)                      |
|                                    | Cohort Management                           | [S-4.4](06-Students.md#scr-4-4)                      |
|                                    | Messaging Center                            | [S-4.5](06-Students.md#scr-4-5)                      |
|                                    | Enrollment Requests / Waitlist              | [S-4.6](06-Students.md#scr-4-6)                      |
|                                    | Badges & Achievements                       | [S-4.7](06-Students.md#scr-4-7)                      |
|                                    | Automated Enrollment Rules                  | [S-4.8](06-Students.md#scr-4-8)                      |
| **5. Analytics**                   | Course Performance                          | [S-5.1](07-Analytics.md#scr-5-1)                     |
|                                    | Quiz Analytics                              | [S-5.2](07-Analytics.md#scr-5-2)                     |
|                                    | Drop-off Analysis                           | [S-5.3](07-Analytics.md#scr-5-3)                     |
|                                    | Export Reports                              | [S-5.4](07-Analytics.md#scr-5-4)                     |
|                                    | Cohort Comparison Report                    | [S-5.5](07-Analytics.md#scr-5-5)                     |
| **6. Settings**                    | General Settings                            | [S-6.1](08-Settings.md#scr-6-1)                      |
|                                    | Team Management                             | [S-6.2](08-Settings.md#scr-6-2)                      |
|                                    | Integrations                                | [S-6.3](08-Settings.md#scr-6-3)                      |
|                                    | Branding                                    | [S-6.4](08-Settings.md#scr-6-4)                      |
|                                    | My Profile & Account                        | [S-6.5](08-Settings.md#scr-6-5)                      |
|                                    | Billing & Subscription                      | [S-6.6](08-Settings.md#scr-6-6)                      |
|                                    | API & Webhooks                              | [S-6.7](08-Settings.md#scr-6-7)                      |
|                                    | Security & Audit Log                        | [S-6.8](08-Settings.md#scr-6-8)                      |
|                                    | Roles & Permissions                         | [S-6.9](08-Settings.md#scr-6-9)                      |
|                                    | Privacy & Data Retention                    | [S-6.10](08-Settings.md#scr-6-10)                    |
| **7. Shared Components**           | Confirmation Dialog                         | [S-7.1](09-Shared-Components.md#scr-7-1)             |
|                                    | Toast Notifications                         | [S-7.2](09-Shared-Components.md#scr-7-2)             |
|                                    | Empty State Component                       | [S-7.3](09-Shared-Components.md#scr-7-3)             |
|                                    | Help & Support Panel                        | [S-7.4](09-Shared-Components.md#scr-7-4)             |
|                                    | Command Palette                             | [S-7.5](09-Shared-Components.md#scr-7-5)             |
|                                    | Onboarding Tour                             | [S-7.6](09-Shared-Components.md#scr-7-6)             |
|                                    | Duplicate Lesson Modal                      | [S-7.7](09-Shared-Components.md#scr-7-7)             |
| **8. Marketing & Growth**          | Email Campaigns                             | [S-8.1](10-Marketing-and-Growth.md#scr-8-1)          |
|                                    | Email Template Editor                       | [S-8.2](10-Marketing-and-Growth.md#scr-8-2)          |
|                                    | Discount & Coupon Codes                     | [S-8.3](10-Marketing-and-Growth.md#scr-8-3)          |
|                                    | Affiliate Program                           | [S-8.4](10-Marketing-and-Growth.md#scr-8-4)          |
|                                    | Student Testimonials                        | [S-8.5](10-Marketing-and-Growth.md#scr-8-5)          |

---

## Document Map — Files in This Split

The specification is split into one file per module, exactly as listed in the
sitemap table above. Screen-ID links (e.g. `[S-2.6]`) jump straight to the
definition inside the owning file.

| Part | File                                                                       | Module (per sitemap table)                                                                       | Screens        |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| 00   | `00-Overview-and-Sitemap.md`                                               | Introduction, scope & sitemap                                                                    | — (this file)  |
| 01   | [01-Authentication-and-Onboarding.md](01-Authentication-and-Onboarding.md) | 0. Authentication & Onboarding                                                                   | S-0.1 – S-0.3  |
| 02   | [02-Global-Navigation.md](02-Global-Navigation.md)                         | A. Global Navigation                                                                             | S-A.1          |
| 03   | [03-Dashboard.md](03-Dashboard.md)                                         | 1. Dashboard                                                                                     | S-1.1 – S-1.4  |
| 04   | [04-Courses.md](04-Courses.md)                                             | 2. Courses (Primary)                                                                             | S-2.1 – S-2.16 |
| 05   | [05-Content-Library.md](05-Content-Library.md)                             | 3. Content Library                                                                               | S-3.1 – S-3.6  |
| 06   | [06-Students.md](06-Students.md)                                           | 4. Students                                                                                      | S-4.1 – S-4.8  |
| 07   | [07-Analytics.md](07-Analytics.md)                                         | 5. Analytics                                                                                     | S-5.1 – S-5.5  |
| 08   | [08-Settings.md](08-Settings.md)                                           | 6. Settings                                                                                      | S-6.1 – S-6.10 |
| 09   | [09-Shared-Components.md](09-Shared-Components.md)                         | 7. Shared Components                                                                             | S-7.1 – S-7.7  |
| 10   | [10-Marketing-and-Growth.md](10-Marketing-and-Growth.md)                   | 8. Marketing & Growth                                                                            | S-8.1 – S-8.5  |
| 11   | [11-Global-Standards.md](11-Global-Standards.md)                           | Cross-cutting UX, roles & permissions, design system, responsive, accessibility, navigation flow | —              |
