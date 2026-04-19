# Subly — UMich Sublease Platform

A sublease listing platform for University of Michigan students. Only `@umich.edu` email addresses are allowed to sign up.

## Tech Stack

- **React 19** + **Vite** (no React Router — all routing is state-based in App.jsx)
- **Supabase** — auth, database (Postgres), and file storage
- **Leaflet / react-leaflet** — map view in BrowseListings with Nominatim geocoding
- **react-datepicker** — date range picker in PostListing
- No CSS framework — inline styles + `<style>` blocks per component

## Project Structure

```
src/
  App.jsx           # Root component; manages all page state, dark mode, auth session
  Auth.jsx          # Sign up / sign in page (email + password, @umich.edu only)
  BrowseListings.jsx # Browse/search/filter listings with map and tile views
  Dashboard.jsx     # User's own listings; edit, delete, mark as filled
  PostListing.jsx   # Create a new listing with image upload and tag selection
  ListingModal.jsx  # Full listing detail modal with image gallery and lightbox
  Logo.jsx          # SublyLogo (SVG icon) and SublyWordmark (icon + "Subly" text)
  supabase.js       # Supabase client initialization
  main.jsx          # React entry point
```

## Routing

There is no React Router. Page visibility is controlled by boolean state in `App.jsx`:
- `showAuth` — Auth page
- `showPost` — PostListing page
- `showBrowse` — BrowseListings page
- `showDashboard` — Dashboard page

All other state (auth session, dark mode) lives in `App.jsx` and is passed down as props.

## Supabase

**Project URL:** `https://qbmiuontydxmfygxoavr.supabase.co`

### Table: `listings`

| Column          | Type      | Notes                                                        |
|-----------------|-----------|--------------------------------------------------------------|
| `id`            | uuid      | Primary key, auto-generated                                  |
| `user_id`       | uuid      | References `auth.users.id`; set on insert via `auth.uid()`  |
| `title`         | text      |                                                              |
| `address`       | text      |                                                              |
| `price`         | numeric   | Monthly rent in USD                                          |
| `beds`          | text      | e.g. "2 bed / 1 bath"                                        |
| `dates`         | text      | Human-readable date range, e.g. "May–Aug 2025"              |
| `description`   | text      |                                                              |
| `contact_email` | text      | Must be @umich.edu                                           |
| `image_url`     | text      | **JSON array of URLs** (uploaded to Supabase Storage). Parse with `JSON.parse()`. May also be a bare URL string for legacy rows — always try/catch. |
| `tags`          | text[]    | Array of amenity strings (e.g. `["WiFi", "Parking", "AC"]`). May be null. |
| `filled`        | boolean   | Default `false`. Owner can toggle via Dashboard.             |
| `created_at`    | timestamp | Auto-set by Supabase                                         |

### Storage: `listing-images` bucket

Images are uploaded here during listing creation. The resulting public URLs are stored as a JSON array in `image_url`.

### RLS Policies (listings table)

- **SELECT** — public (anyone can read)
- **INSERT** — authenticated users only; `user_id` must equal `auth.uid()`
- **UPDATE** — owner only (`user_id = auth.uid()`)
- **DELETE** — owner only (`user_id = auth.uid()`)

## Dark Mode

- Default: light mode
- Toggle: 🌙/☀️ button present on every page (top-right corner)
- State: `darkMode` boolean in `App.jsx`, persisted to `localStorage` under key `subly_dark`
- Applied via: `document.documentElement.dataset.theme = 'dark' | 'light'`
- Each component receives `darkMode` and `onToggleDark` as props
- CSS: hybrid approach — `[data-theme="dark"]` overrides in each component's `<style>` block for class-based styles; conditional `dm ? dark : light` inline styles for structural/layout colors

## Auth

- Email + password via Supabase Auth
- Only `@umich.edu` emails accepted (validated client-side before submit)
- Email confirmation required on signup (`emailRedirectTo: 'http://localhost:5173'`)
- After sign-in, `onLogin(user)` is called to update `App.jsx` state

## Avatar Initials

Logged-in user avatar shows: **first letter + last letter** of the email username (before `@`).
Example: `jsmith@umich.edu` → `JH` (first = `j`, last = `h`).

## Amenity Tags

Defined as a constant in `PostListing.jsx`. Current set:
`WiFi`, `Parking`, `Laundry`, `AC`, `Furnished`, `Utilities Included`, `Pet Friendly`, `Gym`, `Dishwasher`, `Balcony`, `Private Room`, `Quiet Building`
