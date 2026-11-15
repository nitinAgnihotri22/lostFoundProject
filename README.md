# LostFound 📍🔍

**LostFound** is a full-stack geocoded community recovery platform designed to help people report, search, and reclaim lost and found items.

---

## 🌟 Key Features Implemented

1. **Found Items Feed & Exploration**:
   - Opens straight into the feed of items reported by the community.
   - Switchable between **Card Grid View**, **Interactive Map View**, and **Split Desktop View**.
   - Displays real-time distance calculations (e.g., `1.4 km away`).

2. **Item Detail Page & Full Gallery**:
   - Multi-photo carousel displaying all images uploaded by users.
   - Title, full description, category tags, and status badge.
   - Precise **geocode location** (street address, city, latitude/longitude).
   - Timestamp indicating when the item was lost or found.
   - Finder profile badge and verification shield.

3. **Reporting a Found (or Lost) Item**:
   - Interactive modal with toggle between **Found Item** and **Lost Item**.
   - Multiple image upload (local device files with FileReader previews or direct URLs).
   - **Interactive Geocoding Map**: Click anywhere to drop a pin, or use the **"Use My GPS"** button for automatic location detection and reverse geocoding.
   - Set up **3 custom secret verification questions** for potential claimants.

4. **Geospatial & Filter Search (Radius 5km)**:
   - Search by keyword (title, description, location).
   - Filter by category (Electronics, Wallets, Keys, Bags, Documents, Jewelry, Pets, Clothing, Other).
   - **Radius Filter**: Default **5 km**, with options for 1 km, 3 km, 10 km, 25 km, or 50 km.
   - Date range filter: Filter items found or lost on or after specific dates and times.

5. **3-Proof Claim Verification System**:
   - To prevent fraudulent claims, claimants must provide **at least three specific proofs** that only the true owner would know (e.g. lock screen image, hidden compartments, serial numbers, unique scratches).
   - Claimant contact details are kept private and only shared upon finder verification.

6. **Authentication**:
   - User Registration and Login modal.
   - Manages user sessions, associating reported items and claim submissions with user profiles.

---

## 🗄️ Database Recommendation & Architecture

### Recommended Database: **PostgreSQL + PostGIS (via Supabase)**

- **Why PostGIS?**
  Calculating distances over Earth's curvature (like a **5km radius query**) is natively supported via spatial indexes (`GIST`). A query like:
  ```sql
  SELECT * FROM items
  WHERE ST_DWithin(location, ST_MakePoint(:user_lon, :user_lat)::geography, 5000)
    AND status = 'active';
  ```
  runs in milliseconds even with hundreds of thousands of records.
- **Image Storage**: Supabase Storage or AWS S3 buckets for high-resolution item photos.
- **Where to Store the DB**:
  - **Supabase Cloud (Recommended)**: Free tier includes PostgreSQL, PostGIS, Storage, and Auth.
  - **Alternative**: Managed AWS RDS PostgreSQL or DigitalOcean Managed Databases.

The complete database schema is ready in [`schema.sql`](./schema.sql).

---

## 🚀 Getting Started

### 1. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Build for Production
```bash
npm run build
npm run start
```

---

## 📱 Mobile App & Website Roadmap

- **Website**: Built on Next.js 15 + Tailwind CSS, fully responsive across mobile, tablet, and desktop screens. Can be configured as a Progressive Web App (PWA) with offline support.
- **Mobile App**: The components, types in `src/types/index.ts`, and geospatial utilities in `src/lib/geo.ts` are 100% reusable in React Native (Expo) or Flutter.

