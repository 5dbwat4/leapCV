@echo off
chcp 65001 >nul
title 简跃 LeapCV - AI 简历优化工具

echo ============================================
echo   简跃 LeapCV 一键启动
echo ============================================
echo.

cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/3] 首次运行：创建 Python 虚拟环境并安装依赖...
    cd backend
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requirements.txt
    cd ..
)

if not exist "backend\.env" (
    echo [提示] 未找到 backend\.env，已复制示例配置（演示模式，无需 API Key）
    copy backend\.env.example backend\.env >nul
)

if not exist "frontend\node_modules" (
    echo [2/3] 首次运行：安装前端依赖...
    cd frontend
    pnpm install
    cd ..
)

echo [3/3] 启动服务...
echo   - 后端: http://127.0.0.1:8000  (API 文档 /docs)
echo   - 前端: http://localhost:5173
echo.
echo 关闭本窗口即可停止服务
echo ============================================

start "LeapCV-Backend" cmd /c "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "LeapCV-Frontend" cmd /c "cd /d %~dp0frontend && pnpm dev"

timeout /t 6 /nobreak >nul
start http://localhost:5173
echo 已在浏览器打开 http://localhost:5173
pause >nul
