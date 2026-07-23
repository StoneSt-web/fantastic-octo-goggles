"""起本地 HTTP server，serve 倔强死神目录"""
import http.server
import socketserver
import os

os.chdir(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜')
PORT = 8765

Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f'serving at port {PORT}')
    httpd.serve_forever()