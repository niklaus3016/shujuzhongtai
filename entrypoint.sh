#!/bin/bash
npm run build
cp -r dist/* /usr/share/nginx/html/
nginx -g "daemon off;"