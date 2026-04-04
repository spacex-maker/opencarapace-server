; 插入在 MUI2.nsh 之后、assistedInstaller.nsh（MUI_PAGE_*）之前。
; 仅 !define MUI_ICON 不会替换安装包 .exe 在资源管理器里的图标；必须再发编译器 Icon。
!ifdef BUILD_UNINSTALLER
  !ifdef UNINSTALLER_ICON
    Icon "${UNINSTALLER_ICON}"
  !endif
!else
  !ifdef MUI_ICON
    Icon "${MUI_ICON}"
  !endif
!endif
