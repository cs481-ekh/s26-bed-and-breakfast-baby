# IDOC Reentry Housing Tracker — Database Setup

## Prerequisites

- Python 3.10+
- PostgreSQL 14+
- pip

## Quick Start

### 1. Install dependencies

```bash
pip install django djangorestframework psycopg2-binary
```

### 2. Create the PostgreSQL database

```bash
# Connect to PostgreSQL and create the database
psql -U postgres
```

```sql
CREATE DATABASE idoc_housing;
\q
```

### 3. Configure database connection

The app reads from environment variables. Set them for your local setup:

```bash
export DB_NAME=idoc_housing
export DB_USER=postgres
export DB_PASSWORD=your_password_here
export DB_HOST=localhost
export DB_PORT=5432
```

Or edit `idoc_housing/settings.py` directly if you prefer.

### 4. Run migrations

```bash
python manage.py makemigrations housing
python manage.py migrate
```

### 5. Seed the database

```bash
python manage.py seed_data
```

This populates the database with:

| Data              | Count | Details                                        |
|-------------------|-------|------------------------------------------------|
| Districts         | 7     | Idaho's judicial districts with county listings |
| Providers         | 5     | Sample housing organizations                   |
| Facilities        | 8     | Across multiple districts and tiers             |
| Programs          | 4     | Substance abuse, mental health, work release, general |
| Beds              | 45    | 4-8 per facility with status tracking           |
| Users             | 5     | Admin, case managers, and provider staff        |
| Parolees          | 5     | Minimal profiles with sample assignments        |
| Holds             | 1     | Active hold awaiting paperwork                  |
| Waitlist Entries  | 1     | High-priority waitlist example                  |

### 6. Access the admin panel

```bash
python manage.py runserver
```

Navigate to `http://localhost:8000/admin/`

## Sample Login Credentials

| Role          | Username      | Password      |
|---------------|---------------|---------------|
| Admin         | `admin`       | `admin123`    |
| Case Manager  | `cm_adams`    | `testpass123` |
| Case Manager  | `cm_baker`    | `testpass123` |
| Provider      | `prov_johnson`| `testpass123` |
| Provider      | `prov_chen`   | `testpass123` |

> **Note:** These are development credentials only. Change all passwords before any deployment.

## Database Schema Overview

```
User (extends AbstractUser)
 ├── role: admin | case_manager | provider
 ├── district → District (for case managers)
 └── provider → Provider (for provider staff)

District
 └── number, name, description (Idaho's 7 judicial districts)

Provider → has many → Facility
Facility → has many → Bed
Facility ←→ Program (many-to-many)
Facility → belongs to → District

Bed
 ├── status: available | occupied | held | maintenance
 └── assigned_parolee → Parolee (one-to-one)

Parolee
 ├── idoc_id, first_name, last_name
 ├── district → District
 └── assigned_bed → Bed

Hold (temporary bed reservation)
 ├── bed → Bed
 ├── parolee → Parolee
 ├── placed_by → User
 └── status: active | expired | converted | cancelled

WaitlistEntry (standby when no beds available)
 ├── parolee → Parolee
 ├── facility → Facility
 ├── priority: urgent | high | medium | low
 └── auto-sorted by priority then created_at
```

## Subtask Checklist

- [x] Configure PostgreSQL connection
- [x] Create User model (roles, district FK, provider FK)
- [x] Create District model (Idaho's 7 judicial districts)
- [x] Create Provider model (contact info, timestamps)
- [x] Create Facility model (provider FK, district FK, tier)
- [x] Create Program model (eligibility, M2M to facilities)
- [x] Create Bed model (status choices, facility FK)
- [x] Create Parolee model (IDOC ID, name, bed assignment)
- [x] Create Hold model (temporary reservations with expiry)
- [x] Create WaitlistEntry model (priority-sorted standby list)
- [x] Run and verify migrations
- [x] Create seed data command
- [x] Register models in Django admin
- [x] Document setup steps and sample credentials
