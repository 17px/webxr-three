# 使用官方的 Nginx 镜像作为基础镜像
FROM nginx:alpine

# 复制 dist 文件夹内容到 Nginx 的默认 Web 根目录
COPY dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]