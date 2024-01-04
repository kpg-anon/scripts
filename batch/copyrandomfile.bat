@echo off
REM This batch file runs the Copy-RandomFile PowerShell script.
REM It copies a random file from the specified folder(s) to the clipboard.
REM 
REM Usage:
REM To run with the default folder, just double-click this batch file.
REM 
REM To run with a custom folder, use the command line:
REM copyrandomfile.bat "C:\Your\Custom\Folder\Path"
REM 
REM To run with multiple custom folders, list them all separated by spaces:
REM copyrandomfile.bat "C:\First\Folder\Path" "C:\Second\Folder\Path"
REM 
REM Ensure that Copy-RandomFile.ps1 is located in your %USERPROFILE% directory.

powershell -ExecutionPolicy Bypass -Command "& { . '%USERPROFILE%\Copy-RandomFile.ps1' %*; exit $LASTEXITCODE }" >nul 2>&1
