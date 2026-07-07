<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
## Project Overview

This is a restaurant review web app.

The app allows users to:

* join invite-only groups
* register restaurants
* post behavior-based reviews
* classify user values through onboarding
* view recommendations based on similar value types

## Tech Stack

* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* Supabase Auth
* PostgreSQL
* Supabase Row Level Security
* Vercel

## Important Product Rules

* Do not implement features outside the MVP unless explicitly requested.
* Do not add Google Maps integration yet.
* Do not add image upload yet.
* Do not add AI recommendations yet.
* Do not add public release features yet.
* Do not add follow/follower features yet.

## Important Data Rules

* Do not put group_id directly on restaurants as the main access control method.
* Use restaurant_accesses to manage restaurant visibility.
* Reviews must have group_id.
* Reviews must have visibility.
* Visibility should support private, group, and public.
* MVP primarily uses visibility = group.
* Rating must be 1 to 4.
* Rating meanings:

  * 4: 常連になりたい
  * 3: 機会があればまた行きたい
  * 2: 一度行けば十分
  * 1: 二度と行かない
* Value types for MVP are:

  * cost
  * taste
  * atmosphere
  * cleanliness
  * speed
  * exploration

## Development Rules

* Explain the plan before making large changes.
* Do not change the database design without confirmation.
* Do not modify unrelated files.
* Keep changes small and reviewable.
* After changes, explain what files were changed and why.
* If a task asks for a design proposal only, do not create or modify files.
* If a task asks not to run migrations, do not execute database changes.
