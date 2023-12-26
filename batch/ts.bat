@echo off
setlocal EnableDelayedExpansion

:: This script horizontally stacks local videos side-by-side using mpv's built-in filtergraph.
:: It accepts either a single input file or three total input files.
:: It can optionally apply 90-degree (transpose=1) or 270-degree (transpose=3) rotation.
::
:: Usage: 
::      ts.bat [-r 1|3] "input" ["input2" "input3"]
::
:: Examples:
:: Hstack a single video without rotation:
::      ts.bat 1.webm
:: Hstack multiple videos with 90 degree rotation:
::      ts.bat -r 1 1.webm 2.webm 3.webm

set "rotation="
set "input_file="
set "external_files="
set "input_count=0"

if "%~1"=="-r" (
    if "%~2"=="1" (
        set "rotation=[vid1]transpose=1[rot1];[vid2]transpose=1[rot2];[vid3]transpose=1[rot3];"
    ) else if "%~2"=="3" (
        set "rotation=[vid1]transpose=3[rot1];[vid2]transpose=3[rot2];[vid3]transpose=3[rot3];"
    ) else (
        echo Invalid rotation value provided. Please use 1 for 90 degrees or 3 for 270 degrees.
        exit /b
    )
    shift
    shift
)

set "stack_inputs=[vid1][vid2][vid3]"
if not "!rotation!"=="" set "stack_inputs=[rot1][rot2][rot3]"

:next_arg
:next_arg
if "%~1"=="" (
    if "!input_file!"=="" (
        echo Usage: %0 [-r 1^|3] "input" ["input2" "input3"^]
        echo Rotation: 1 for 90 degrees, 3 for 270 degrees^.
        echo Accepts either a single input file or three total inputs^.
        exit /b
    )
    goto :construct_external_files
)
set /a input_count+=1

if !input_count! EQU 1 (
    set "input_file=%~1"
) else (
    set "external_files=!external_files!;%~1"
)

shift
goto :next_arg

:construct_external_files
if !input_count! EQU 1 set "external_files=!input_file!;!input_file!"

mpv --lavfi-complex="!rotation!!stack_inputs!hstack=inputs=3[vo];[aid1][aid2][aid3]amix=inputs=3[ao]" "!input_file!" --external-files=!external_files!

endlocal
