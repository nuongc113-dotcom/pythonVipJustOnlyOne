@echo off
chcp 65001 >nul
echo ====================================================================
echo  CAI DAT MOI TRUONG CHO HE THONG DIEM DANH KHUON MAT
echo ====================================================================
echo.

echo [1/3] Kiem tra Python...
python --version
if %errorlevel% neq 0 (
    echo [LOI] May tinh chua cai dat Python hoac chua tich 'Add Python to PATH'!
    echo Vui long tai va cai dat Python tai: https://www.python.org/downloads/
    echo Nho tich chon vao o: "Add python.exe to PATH" khi cai.
    goto END
)
echo -- Python da san sang!
echo.

echo [2/3] Dang cai dat cac thu vien Python can thiet...
pip install -r FaceRecognitionAI\requirements.txt
if %errorlevel% neq 0 (
    echo [CANH BAO] Co the xay ra loi khi cai thu vien Python. Vui long kiem tra ket noi mang.
) else (
    echo -- Tat ca thu vien Python (OpenCV, Flask, NumPy...) da cai dat thanh cong!
)
echo.

echo [3/3] Kiem tra .NET SDK (danh cho Backend C#)...
dotnet --version
if %errorlevel% neq 0 (
    echo [CHU Y] May tinh chua co .NET SDK!
    echo Backend C# can co .NET SDK de chay.
    echo Neu can Backend C#, vui long tai tai: https://dotnet.microsoft.com/download
) else (
    echo -- .NET SDK da san sang!
)
echo.

echo ====================================================================
echo HOAN TAT! Bay gio ban co the nhap dup chuot vao '2_CHAY_HE_THONG.bat'.
echo ====================================================================

:END
pause
