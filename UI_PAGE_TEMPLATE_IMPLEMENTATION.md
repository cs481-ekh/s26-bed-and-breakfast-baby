# Page Template Implementation - Feature/UI-Page-Template Branch

## Overview

A reusable page template system has been implemented to provide a consistent layout across all pages (except login). The template includes a header bar with IDOC logo, navigation links, and user actions.

## Components Created

### 1. Header Component (`src/components/Header.jsx`)

- **Logo Section**: Displays "IDOC" placeholder on the left (can be replaced with actual logo image)
- **Navigation Section**: Navigation links including:
  - Main Dashboard
  - Admin Dashboard
  - Active link highlighting
- **Right Actions Section**:
  - Settings button (gear icon) - for future user settings menu implementation
  - Logout button
- **Responsive Design**: Mobile-friendly with responsive breakpoints

**Features:**

- Uses React Router for navigation (`useNavigate` and `useLocation`)
- Active route highlighting based on current path
- Clean, semantic HTML with accessibility attributes
- Logout functionality that clears auth token and redirects to login

### 2. PageTemplate Component (`src/components/PageTemplate.jsx`)

- Wrapper component that combines Header + main content area
- Flexible layout that grows to fill viewport
- Padding and max-width for content

### 3. Styling Files

- **Header.css**: Light, sleek styling with:
  - Minimal borders and subtle shadows
  - Clean typography using system font stack
  - Light gray and sky blue color scheme
  - Responsive breakpoints at 768px and 640px
  - Smooth transitions and hover effects

- **PageTemplate.css**: Layout styling with:
  - Flexbox layout for full-height pages
  - Content centering and max-width constraints
  - Responsive padding adjustments

## Updated Files

### App.jsx

- Integrated React Router with BrowserRouter
- Created `AdminPage` component wrapping admin dashboard with template
- Created `MainDashboardPageComponent` wrapping main dashboard with template
- Set up routes:
  - `/login` → LoginPage (no header)
  - `/` → Main Dashboard (with header)
  - `/admin` → Admin Dashboard (with header)

### MainDashboardPage.jsx

- Removed old hardcoded navigation
- Wrapped content with PageTemplate component

### package.json

- Added `react-router-dom` dependency

## How to Use

### Using the Template on a Page

```jsx
import PageTemplate from "./components/PageTemplate";

export default function MyPage() {
  return <PageTemplate>{/* Your page content here */}</PageTemplate>;
}
```

### Adding New Navigation Links

Edit `src/components/Header.jsx` and add new buttons in the navigation section:

```jsx
<button
  className={`nav-link ${isMyPage ? "active" : ""}`}
  onClick={() => navigate("/my-page")}
>
  My Page
</button>
```

### Styling the Header

The header uses CSS custom properties that can be overridden in `Header.css`:

- Primary background: `#ffffff`
- Border color: `#e5e7eb`
- Text colors: Gray (`#6b7280`), Dark gray (`#1f2937`)
- Accent color: Sky blue (`#0284c7`) for active links
- Hover background: `#f3f4f6`

### Future Enhancements

1. **User Settings Menu** - Implement dropdown menu for settings button
2. **Logo Image** - Replace "IDOC" text with actual logo image
3. **Dynamic User Info** - Display logged-in user name/role if needed
4. **Role-Based Navigation** - Show different links based on user role
5. **Mobile Menu** - Add hamburger menu for very small screens

## Notes

- The dev server requires Node.js 20.19+ or 22.12+ (currently at 18.17.1)
- All components are properly exported and tested for import/export integrity
- The template is ready for use on any page that needs the header bar
- Login page intentionally excluded from page template
