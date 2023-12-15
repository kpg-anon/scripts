@echo off
setlocal

:: This script is used to horizontally stack a remote video 3 times with optional rotation using yt-dlp and mpv.
:: Usage:
:: Normal viewing
:: triplestack.bat "[url]"
:: With 90 degree rotation
:: triplestack.bat -r 1 "[url]"
:: With 270 degree rotation
:: triplestack.bat -r 3 "[url]"

:: Initialize variables
set "rotation="
set "video_url_arg="

:: Check for rotation argument and set rotation and video URL accordingly
if "%~1"=="-r" (
    if "%~2"=="1" set "rotation=transpose=1,"
    if "%~2"=="3" set "rotation=transpose=3,"
    set "video_url_arg=%~3"
) else (
    set "video_url_arg=%~1"
)

:: Exit if no URL is provided
if "%video_url_arg%"=="" (
    echo No URL provided.
    goto :eof
)

:: Create temporary files
set temp_video_url=%TEMP%\video_url.txt
set temp_audio_url=%TEMP%\audio_url.txt

:: Extract video URL and write to temp file
yt-dlp -g --format "bestvideo[ext=webm]" "%video_url_arg%" > "%temp_video_url%"

:: Extract audio URL and write to temp file
yt-dlp -g --format "bestaudio" "%video_url_arg%" > "%temp_audio_url%"

:: Read URLs from temp files
set /p video_url=<"%temp_video_url%"
set /p audio_url=<"%temp_audio_url%"

:: Play video with mpv
mpv --speed=0.4 --loop=inf "%video_url%" --audio-file="%audio_url%" --vf="%rotation%lavfi=[split=3[a][b:lit][c];[a][b:lit][c]hstack=inputs=3]"

:: Clean up temp files
del "%temp_video_url%"
del "%temp_audio_url%"

endlocal
