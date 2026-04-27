# Deployment Configuration Summary

## Changes Made for SDP Deployment

This document summarizes all configuration changes made to prepare the Bed and Breakfast Baby project for deployment on the Boise State University SDP server.

---

## 1. Django Settings Configuration (`backend/config/settings.py`)

### Added APP_ROOT Variable
- Reads from `APP_ROOT` environment variable
- Defaults to empty string for local development
- When set (e.g., "s26-bed-and-breakfast-baby"), prepends to all URLs
- Automatically appends "/" for proper URL formatting

### Updated ALLOWED_HOSTS
- Added `sdp.boisestate.edu` to default hosts
- Can be overridden via `ALLOWED_HOSTS` environment variable

### Updated CSRF_TRUSTED_ORIGINS
- Added `https://sdp.boisestate.edu` to default trusted origins
- Maintains backward compatibility with local development

### Updated STATIC_URL
- Now includes APP_ROOT prefix
- Format: `/{APP_ROOT}static/` (or just `/static/` if APP_ROOT is empty)
- This ensures CSS/JS files are served from correct paths on SDP

---

## 2. URL Configuration (`backend/config/urls.py`)

### Restructured URL Patterns
- Renamed original `urlpatterns` to `site_patterns`
- Created new `urlpatterns` that wraps `site_patterns` with APP_ROOT prefix
- When `APP_ROOT` is empty, uses `site_patterns` directly (for local dev)
- When `APP_ROOT` is set, wraps all routes with the prefix

**Example:**
- Local: `/api/` → `/api/health/`
- SDP: `/s26-bed-and-breakfast-baby/api/` → `/s26-bed-and-breakfast-baby/api/health/`

---

## 3. Docker Compose Configuration

### `docker-compose.yml` (Production)
- Added `HOST_PORT_API` environment variable for backend port (default: 8000)
- Added `HOST_PORT` environment variable for frontend port (default: 5173)
- Added `APP_ROOT` environment variable to backend service (default: empty)

### `docker-compose.dev.yml` (Development)
- Updated to use `HOST_PORT_API` for backend port
- Updated to use `HOST_PORT` for frontend port
- Added `APP_ROOT` environment variable to backend service

**Port Configuration Example:**
```bash
# For local development (default ports)
./dev.sh

# For custom ports
export HOST_PORT=3000
export HOST_PORT_API=5000
docker-compose up

# For SDP deployment (if needed to test)
export HOST_PORT=8080
export HOST_PORT_API=8000
export APP_ROOT=s26-bed-and-breakfast-baby
docker-compose up
```

---

## 4. Frontend Configuration (`frontend/vite.config.js`)

### Added VITE_BASE_PATH Support
- Reads from `VITE_BASE_PATH` environment variable
- Defaults to `/` for local development
- Can be set to `/s26-bed-and-breakfast-baby/` for SDP deployment
- Configures Vite's `base` option for correct asset paths

**Example:**
```bash
# Local development
VITE_BASE_PATH=/ npm run dev

# SDP deployment
VITE_BASE_PATH=/s26-bed-and-breakfast-baby/ npm run build
```

---

## 5. Environment Configuration (`.env.example`)

### Added APP_ROOT Documentation
- Explains when to leave APP_ROOT empty (local dev)
- Explains how to set APP_ROOT for SDP (project name)
- Includes examples

---

## Files Modified

1. `backend/config/settings.py` - Added APP_ROOT, updated ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, STATIC_URL
2. `backend/config/urls.py` - Restructured to support APP_ROOT prefix
3. `docker-compose.yml` - Added HOST_PORT, HOST_PORT_API, APP_ROOT environment variables
4. `docker-compose.dev.yml` - Added HOST_PORT, HOST_PORT_API, APP_ROOT environment variables
5. `frontend/vite.config.js` - Added VITE_BASE_PATH support
6. `.env.example` - Added APP_ROOT documentation

## Files Created

1. `DEPLOYMENT_GUIDE.md` - Comprehensive deployment instructions for the professor
2. `DEPLOYMENT_CHECKLIST.md` - Quick reference for deployment setup

---

## How It Works

### Local Development (APP_ROOT not set or empty)
```
Frontend:   http://localhost:5173
API:        http://localhost:8000/api/
Admin:      http://localhost:8000/admin/
Static:     /static/
```

### SDP Deployment (APP_ROOT=s26-bed-and-breakfast-baby)
```
Frontend:   https://sdp.boisestate.edu/s26-bed-and-breakfast-baby
API:        https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/api/
Admin:      https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/admin/
Static:     /s26-bed-and-breakfast-baby/static/
```

---

## Key Features

✅ **Backward Compatible** - Local development works without any changes  
✅ **Environment-Driven** - Configuration via environment variables  
✅ **Flexible Ports** - HOST_PORT and HOST_PORT_API can be set at deployment  
✅ **SDP Ready** - All URLs and static files properly prefixed for SDP deployment  
✅ **HTTPS Support** - Already configured for SDP's HTTPS on sdp.boisestate.edu  
✅ **CSRF Protection** - Properly configured for cross-origin requests  

---

## Testing

### Local Development Test
```bash
./dev.sh --data
# Access at http://localhost:5173
# API at http://localhost:8000/api/health/
```

### SDP Configuration Test (Simulated)
```bash
export APP_ROOT=s26-bed-and-breakfast-baby
export HOST_PORT=8080
export HOST_PORT_API=8000
docker-compose up -d
# Note: Frontend paths would be /s26-bed-and-breakfast-baby/*
# This simulates SDP deployment (but without HTTPS)
```

---

## What to Tell the Professor

1. **The project is SDP-ready** - All necessary configuration changes have been made
2. **No .env file needed in git** - They should use `.env.example` as a template
3. **Standard deployment process** - Build, migrate, create admin user, seed data (optional), start
4. **Environment variables handle deployment** - APP_ROOT, HOST_PORT, HOST_PORT_API are automatically configured
5. **All documentation is included** - See DEPLOYMENT_GUIDE.md for step-by-step instructions
6. **Local development unchanged** - The `./dev.sh` script still works exactly as before
7. **Test data available** - `./dev.sh --data` includes sample data for testing

---

## Verification Checklist

- ✅ Backend API responds: http://localhost:8000/api/health/
- ✅ Frontend loads: http://localhost:5173
- ✅ All three containers running: backend, frontend, db
- ✅ Database migrations applied
- ✅ Sample data seeded
- ✅ No configuration needed for local dev (APP_ROOT empty by default)
- ✅ Easy deployment with environment variables

---

## Next Steps

1. Commit all changes to git
2. Send deployment email to Dr. Henderson with:
   - Link to repository
   - Reference to DEPLOYMENT_CHECKLIST.md for quick setup
   - Reference to DEPLOYMENT_GUIDE.md for detailed instructions
   - Project name: s26-bed-and-breakfast-baby
   - Frontend port: 5173 (configurable via HOST_PORT)
   - Backend port: 8000 (configurable via HOST_PORT_API)
3. Professor will:
   - Clone the repository
   - Copy .env.example to .env
   - Follow steps in DEPLOYMENT_GUIDE.md
   - Set APP_ROOT=s26-bed-and-breakfast-baby in environment
   - Deploy and test

---

## Support Resources

- **DEPLOYMENT_GUIDE.md** - Full step-by-step deployment instructions
- **DEPLOYMENT_CHECKLIST.md** - Quick reference for Professor
- **README.md** - General project information
- **.env.example** - Example environment configuration with documentation
