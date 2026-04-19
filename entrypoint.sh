#!/bin/bash
# React 应用启动
chmod +x /home/devbox/project/entrypoint.sh
export NODE_ENV=production
npx serve -s dist -l 3003