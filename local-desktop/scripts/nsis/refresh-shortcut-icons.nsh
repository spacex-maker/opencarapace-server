; 由 package.json build.nsis.include 引入。
; 升级保留 .lnk 时壳层常仍显示旧图标；删建 + 独立 ico 路径 + SHCNF_FLUSH，比 F5 可靠。

!macro clawheartRefreshOneShortcut LNK_PATH
  ${if} ${FileExists} "${LNK_PATH}"
    Delete "${LNK_PATH}"
  ${endIf}
  Sleep 300
  !ifdef UNINSTALLER_ICON
    ${if} ${FileExists} "$INSTDIR\uninstallerIcon.ico"
      CreateShortCut "${LNK_PATH}" "$appExe" "" "$INSTDIR\uninstallerIcon.ico" 0 "" "" "${APP_DESCRIPTION}"
    ${else}
      CreateShortCut "${LNK_PATH}" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${endIf}
  !else
    CreateShortCut "${LNK_PATH}" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  !endif
  ClearErrors
!macroend

!macro customInstall
  !ifndef DO_NOT_CREATE_DESKTOP_SHORTCUT
  ${ifNot} ${isNoDesktopShortcut}
    !insertmacro clawheartRefreshOneShortcut "$newDesktopLink"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${endIf}
  !endif

  !ifndef DO_NOT_CREATE_START_MENU_SHORTCUT
    !insertmacro clawheartRefreshOneShortcut "$newStartMenuLink"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  !endif

  ; SHCNE_ASSOCCHANGED(0x08000000)；SHCNF_FLUSH(0x1000) 强制提交，否则 F5 也常无效
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)'
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

  ; 异步触发图标缓存刷新（不阻塞安装结束页）
  IfFileExists "$SYSDIR\ie4uinit.exe" 0 +2
  Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend
