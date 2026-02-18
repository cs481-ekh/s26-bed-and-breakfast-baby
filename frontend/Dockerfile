FROM node:20-slim

WORKDIR /app
COPY package*.json /app/
RUN npm ci
COPY . /app
