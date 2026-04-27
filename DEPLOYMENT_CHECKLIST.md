# Bed and Breakfast Baby - SDP Deployment Checklist

**Team:** S26 Bed and Breakfast Baby  
**Project Repository:** s26-bed-and-breakfast-baby  
**Deployment Domain:** https://sdp.boisestate.edu/s26-bed-and-breakfast-baby

---

## Email to Dr. Henderson

**Subject:** Deployment Request for s26-bed-and-breakfast-baby

Dr. Henderson,

We are ready to stage our Bed and Breakfast Baby project on the SDP server. Please find the deployment information below:

**Project Details:**
- **Repository Name:** s26-bed-and-breakfast-baby
- **Container Type:** Docker Compose (multi-container)
- **Frontend Port:** 5173 (configurable via `HOST_PORT` environment variable)
- **Backend API Port:** 8000 (configurable via `HOST_PORT_API` environment variable)
- **Dockerfiles Location:** `frontend/Dockerfile` and `backend/Dockerfile` in project root
- **Compose Files:** `docker-compose.yml` (production), `docker-compose.dev.yml` (development)

**Application URLs:**
- Frontend: `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby`
- API: `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/api/`
- Admin Panel: `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/admin/`

---

## Quick Start for Deployment

### Prerequisites
```bash
git clone <repo-url> s26-bed-and-breakfast-baby
cd s26-bed-and-breakfast-baby
```

### 1. Create Environment File
```bash
cp .env.example .env
```

Edit `.env` and update (critical variables):
- `SECRET_KEY`: Generate with: `python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- `DEBUG=False` (for production)
- `APP_ROOT=s26-bed-and-breakfast-baby` (already in docker-compose.yml default)

### 2. Build and Initialize
```bash
# Build containers
docker-compose build

# Run migrations
docker-compose run --rm backend bash -c "python manage.py migrate --noinput"

# Create admin user (optional but recommended)
docker-compose run --rm backend bash -c "echo 'from django.contrib.auth.models import User; User.objects.create_superuser(\"admin\", \"admin@example.com\", \"changeme\")' | python manage.py shell"

# Seed test data (optional)
docker-compose run --rm backend bash -c "python manage.py seed_data"
```

### 3. Start Application
```bash
docker-compose up -d
```

### 4. Verify
```bash
# Check containers
docker-compose ps

# Check logs
docker-compose logs -f
```

---

## Architecture

**Frontend Container:**
- Image: Node.js 20 slim
- Port: 5173 (configurable)
- Tech: React + Vite
- Dockerfile: `frontend/Dockerfile`

**Backend Container:**
- Image: Python 3.12 slim
- Port: 8000 (configurable)
- Tech: Django + Django REST Framework
- Dockerfile: `backend/Dockerfile`

**Database Container:**
- Image: PostgreSQL 16
- Port: 5432
- Data: Persisted in Docker volumes

---

## Configuration Variables

Key environment variables (all optional with sensible defaults):

```
# Application Root (for URL prefix)
APP_ROOT=s26-bed-and-breakfast-baby

# Port Configuration
HOST_PORT=5173              # Frontend port
HOST_PORT_API=8000          # Backend port

# Django Configuration
SECRET_KEY=<random-key>
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend,sdp.boisestate.edu

# Database (uses PostgreSQL in container by default)
DB_NAME=app
DB_USER=app
DB_PASSWORD=app
DB_HOST=db
DB_PORT=5432

# CORS and CSRF
CORS_ALLOWED_ORIGINS=https://sdp.boisestate.edu
CSRF_TRUSTED_ORIGINS=https://sdp.boisestate.edu
```

---

## Important Notes

1. **No .env file in Git:** The actual `.env` file should be created on the deployment server using `.env.example` as a template. The `.env` file is listed in `.gitignore` and will not be committed to the repository.

2. **Port Configuration:** The application uses environment variables (`HOST_PORT` and `HOST_PORT_API`) for flexible port configuration during deployment.

3. **APP_ROOT Prefix:** All URLs are automatically prefixed with the `APP_ROOT` value when set. This allows the same application to work both locally (with empty `APP_ROOT`) and on SDP (with `APP_ROOT=s26-bed-and-breakfast-baby`).

4. **HTTPS:** The SDP server handles SSL/TLS. Django is pre-configured to work with HTTPS on the SDP domain.

5. **Static Files:** Django static files are served with the `APP_ROOT` prefix and should be collected before running in production:
   ```bash
   docker-compose exec backend python manage.py collectstatic --noinput
   ```

6. **Test Data:** The `seed_data` management command can populate the database with sample data for testing.

---

## Troubleshooting

### Backend container won't start
Check logs: `docker-compose logs backend`

Common issues:
- Missing `SECRET_KEY` in `.env`
- Database not ready
- Migration errors

### Frontend not accessible
Ensure `APP_ROOT` is set correctly and matches the deployment path.

### Database errors
Verify PostgreSQL container is running: `docker-compose ps db`

---

## Verification URLs

Once deployed, these URLs should be accessible:

- **Health Check:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/api/health/`
- **Admin Login:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/admin/`
- **API Root:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/api/`
- **Frontend:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/`

---

## Additional Resources

- **Full Deployment Guide:** See `DEPLOYMENT_GUIDE.md` in the repository
- **Local Development:** Run `./dev.sh` for local development with hot reload
- **Testing:** Run `./test.sh` (Bash) or `./test.ps1` (PowerShell) for automated tests

---

## Contact

For questions or issues during deployment, please refer to the project documentation in the repository.

**Team:** S26 Bed and Breakfast Baby
