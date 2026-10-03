!macro customInstall
  ${if} $LANGUAGE == 2052
  ${orIf} $LANGUAGE == 1028
  ${orIf} $LANGUAGE == 3076
    ${ifNot} ${isUpdated}
      !insertmacro moveFile "$newDesktopLink" "$DESKTOP\咕咕地球.lnk"
      !insertmacro moveFile "$newStartMenuLink" "$SMPROGRAMS\咕咕地球.lnk"
      StrCpy $launchLink "$SMPROGRAMS\咕咕地球.lnk"
    ${endIf}
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" ShortcutName "咕咕地球"
    WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayName "咕咕地球"
  ${endIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isKeepShortcuts}
    ${if} ${FileExists} "$DESKTOP\咕咕地球.lnk"
      WinShell::UninstShortcut "$DESKTOP\咕咕地球.lnk"
      Delete "$DESKTOP\咕咕地球.lnk"
    ${endIf}
    ${if} ${FileExists} "$SMPROGRAMS\咕咕地球.lnk"
      WinShell::UninstShortcut "$SMPROGRAMS\咕咕地球.lnk"
      Delete "$SMPROGRAMS\咕咕地球.lnk"
    ${endIf}
  ${endIf}
!macroend
