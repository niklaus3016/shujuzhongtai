# 第一阶段：构建前端应用
FROM node:18-alpine as build

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有文件
COPY . .

# 构建生产版本
RUN npm run build

# 第二阶段：使用nginx作为服务器
FROM nginx:alpine

# 复制构建好的文件到nginx的html目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制nginx配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露80端口
EXPOSE 80

# 启动nginx（使用shell形式的CMD命令）
CMD nginx -g "daemon off;"