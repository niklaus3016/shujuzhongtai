#!/bin/bash
export NODE_ENV=production
npm run build
npx vite preview --host 0.0.0.0 --port 3000