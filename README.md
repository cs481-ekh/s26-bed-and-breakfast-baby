# Team Bed and Breakfast Baby
BSU CS481 Capstone project template

[![CI](https://github.com/cs481-ekh/s26-bed-and-breakfast-baby/actions/workflows/ci.yml/badge.svg)](https://github.com/cs481-ekh/s26-bed-and-breakfast-baby/actions/workflows/ci.yml)

## Overview

This project is a full-stack web application built with:

- Backend: Django + Django REST Framework
- Frontend: React (Vite)
- Database: PostgreSQL
- Containerization: Docker + Docker Compose
- CI: GitHub Actions

The repository includes automated build and test scripts and runs continuous integration on every push and pull request.

## Prerequisites

- Docker
- Docker Compose
- Node.js (only if running frontend outside Docker)
- Python 3.12 (only if running backend outside Docker)

## Development

Start the development environment:

```bash
./dev.sh
```

Frontend:
http://localhost:5173

Backend API:
http://localhost:8000