#Persistent
#NoEnv
SetBatchLines -1
TimerOn := false

GuiColor := "0x1F1F1F"
TextColor := "0xFFFFFF"
ButtonColorStart := "0xFFFFFF"
ActiveBorderColor := "0xcc4444"

Gui, New
Gui, Color, %GuiColor%
Gui, Font, s16 c%TextColor% Arial
Gui, Add, Text, xm w200 h40 Center Background%GuiColor% c%TextColor%, Interval (in seconds):
Gui, Font, s32 c%TextColor% Arial
Gui, Add, Edit, vInterval w200 h50 Center Background%GuiColor% c%GuiColor% Border, 10
Gui, Font, s16 c%TextColor% Arial
Gui, Add, Button, gToggleTimer w200 h50 Center vButton1 Background%ButtonColorStart% c%GuiColor% Default, Start
Gui, Show, x0 y147 w240 h200, Honeyview Shuffle

Hotkey, Escape, GuiClose

return

ToggleTimer:
    Gui, Submit, NoHide
    If (TimerOn)
    {
        SetTimer, SendCtrlAltPageUp, Off
        GuiControl,, Button1, Start
        Gui, Color, %GuiColor%
        TimerOn := false
    }
    else
    {
        If WinExist("ahk_exe Honeyview.exe")
        {
            WinActivate
            Send, {F11}
        }
        Interval := Interval * 1000
        SetTimer, SendCtrlAltPageUp, %Interval%
        GuiControl,, Button1, Stop
        Gui, Color, %ActiveBorderColor%
        TimerOn := true
    }
    Gui, Show,, Honeyview Shuffle
return


SendCtrlAltPageUp:
    If WinExist("ahk_exe Honeyview.exe")
    {
        WinActivate
        Send, ^!{PgUp}
    }
return

GuiClose:
    ExitApp
return
