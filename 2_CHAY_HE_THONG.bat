@echo off
chcp 65001 >nul
title HE THONG DIEM DANH KHUON MAT AI
echo Dang khoi dong he thong, vui long doi giay lat...
echo.

python run_system.py

if %errorlevel% neq 0 (
    echo.
    echo ====================================================================
    echo [THONG BAO] He thong bi dung hoac xay ra loi khi chay.
    echo Neu may chua cai thu vien, hay chay file '1_CAI_DAT_MOI_TRUONG.bat'.
    echo ====================================================================
)

pause
