@echo off
chcp 65001 >nul
title Excel 文件比对工具

echo ========================================
echo    Excel 文件比对工具
echo ========================================
echo.

:: 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请安装 Python 3.8+
    pause
    exit /b 1
)

:: 检查依赖
echo [检查] 检测依赖库...
python -c "import pandas, openpyxl" >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 正在安装依赖（pandas, openpyxl）...
    pip install pandas openpyxl -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo [启动] 打开比对工具界面...
start "" pythonw "%~dp0compare_gui.py" 2>nul
if %errorlevel% neq 0 (
    python "%~dp0compare_gui.py"
)
