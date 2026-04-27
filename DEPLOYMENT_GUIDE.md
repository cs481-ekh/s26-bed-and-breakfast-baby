# Bed and Breakfast Baby - Deployment Guide for SDP

## Overview

This guide provides instructions for deploying the Bed and Breakfast Baby application on the Boise State University SDP (Secure Development Platform) server.

**Project Name:** s26-bed-and-breakfast-baby  
**Project URL on SDP:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby`

---

## Prerequisites

The following tools must be available on the deployment server:
- Docker or Podman with Compose support
- Bash shell
- Git
- Python 3.12 (for running management commands)

---

## Deployment Steps

### Step 1: Clone the Repository

```bash
git clone <repository-url> s26-bed-and-breakfast-baby
cd s26-bed-and-breakfast-baby
```

### Step 2: Create Environment Configuration

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables (others can use defaults):

```
SECRET_KEY=<generate-a-secure-random-key>
DEBUG=False
APP_ROOT=s26-bed-and-breakfast-baby
HOST_PORT=8080
HOST_PORT_API=8000
```

**To generate a secure SECRET_KEY:**
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Step 3: Build Docker Images

Build the backend and database containers:

```bash
docker-compose build
```

### Step 4: Initialize the Database

Run database migrations to set up tables:

```bash
docker-compose run --rm backend bash -c "python manage.py migrate --noinput"
```

### Step 5: Create Admin User (Optional but Recommended)

Create a default superuser for accessing the Django admin panel:

```bash
# Interactive method - you'll be prompted for username, email, and password
docker-compose run --rm backend bash -c "python manage.py createsuperuser"

# Or non-interactive method:
docker-compose run --rm backend bash -c "echo 'from django.contrib.auth.models import User; User.objects.create_superuser(\"admin\", \"admin@example.com\", \"changeme\")' | python manage.py shell"
```

Access the admin panel at: `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/admin/`

### Step 6: Seed Test Data (Optional)

To populate the database with sample data for testing:

```bash
docker-compose run --rm backend bash -c "python manage.py seed_data"
```

For large sample data:
```bash
docker-compose run --rm backend bash -c "python manage.py seed_data --size large"
```

### Step 7: Start the Application

Start all containers in the background:

```bash
docker-compose up -d
```

Check that containers are running:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
```

---

## Accessing the Application

Once deployed, access the application at:

**Frontend:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby`  
**API:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/api/`  
**Admin:** `https://sdp.boisestate.edu/s26-bed-and-breakfast-baby/admin/`

---

## Configuration Details

### Port Configuration

The application uses environment variables for port configuration:
- `HOST_PORT`: Frontend port (default: 5173)
- `HOST_PORT_API`: Backend API port (default: 8000)

Example:
```bash
export HOST_PORT=8080
export HOST_PORT_API=8000
docker-compose up -d
```

### Application Root Path

The `APP_ROOT` environment variable controls the URL prefix:
- **Local development:** Leave empty (`APP_ROOT=`)
- **SDP deployment:** Set to `s26-bed-and-breakfast-baby`

This is already configured in `.env.example` and docker-compose files.

### Database Configuration

Default database settings (can be overridden with environment variables):
- **Engine:** PostgreSQL 16
- **Database Name:** `app`
- **User:** `app`
- **Password:** `app`
- **Host:** `db`
- **Port:** `5432`

For production deployments, update these in the `.env` file.

---

## Architecture

The application uses two main containers:

### Backend Container
- **Image:** Python 3.12 slim
- **Port:** 8000 (configurable via `HOST_PORT_API`)
- **Function:** Django REST API
- **Command:** Django development server with auto-reload

### Frontend Container
- **Image:** Node.js 20 slim
- **Port:** 5173 (configurable via `HOST_PORT`)
- **Function:** React Vite application
- **Command:** Vite development server with hot reload

### Database Container
- **Image:** PostgreSQL 16
- **Port:** 5432
- **Function:** Application database

---

## Container Dockerfiles

Both containers are defined with Dockerfiles in their respective directories:
- **Backend:** `backend/Dockerfile`
- **Frontend:** `frontend/Dockerfile`
- **Compose:** `docker-compose.yml` (production), `docker-compose.dev.yml` (development)

---

## Managing the Application

### View Logs
```bash
# All containers
docker-compose logs -f

# Specific container
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Execute Commands in Container
```bash
# Run Django management commands
docker-compose exec backend python manage.py <command>

# Run shell in backend container
docker-compose exec backend bash

# Run in frontend container
docker-compose exec frontend bash
```

### Stop Application
```bash
docker-compose down
```

### Remove Data (WARNING: Deletes database!)
```bash
docker-compose down -v
```

---

## Troubleshooting

### Backend container exits immediately
Check logs for errors:
```bash
docker-compose logs backend
```

Common causes:
- Missing SECRET_KEY in .env
- Database connection issues
- Missing migrations

### Frontend not loading
Ensure `APP_ROOT` is set correctly and matches the SDP deployment path.

Check frontend logs:
```bash
docker-compose logs frontend
```

### Database connection errors
Verify database container is running:
```bash
docker-compose ps db
```

Check database logs:
```bash
docker-compose logs db
```

### Permission issues
Ensure the user running docker-compose has permission to access the project directory and create volumes.

---

## Production Considerations

For production deployment on SDP:

1. **SECRET_KEY:** Generate a unique, random key and keep it secret
2. **DEBUG:** Set `DEBUG=False` in `.env`
3. **ALLOWED_HOSTS:** Already configured to include `sdp.boisestate.edu`
4. **CSRF_TRUSTED_ORIGINS:** Already configured for SDP domain
5. **Database:** Consider using a managed database service instead of container-based PostgreSQL
6. **SSL/TLS:** SDP server handles HTTPS; Django is configured appropriately
7. **Backups:** Implement regular database backups if using container-based PostgreSQL

---

## Support

For issues or questions about deployment:
- Check application logs: `docker-compose logs`
- Verify environment configuration: `cat .env`
- Ensure all containers are running: `docker-compose ps`
- Review SDP deployment requirements at the SDP documentation

---

## Development vs. Production

This application supports both development and production environments:

- **Development:** Use `./dev.sh` for local development with hot reload
- **Production:** Use `docker-compose up -d` with proper environment configuration

The configuration automatically adjusts based on the `DEBUG` environment variable.
