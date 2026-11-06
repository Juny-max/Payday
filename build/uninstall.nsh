; Only fixed Payday-owned children of an existing app-data directory.
; Shared with the disposable NSIS regression harness.
!macro PaydayDeleteOwnedData ROOT
  StrCpy $R3 0
  GetFullPathName $R2 "${ROOT}"
  StrCmp $R2 "" paydayCleanupInvalidRoot
  ; Resolve the existing PARENT, never a possibly missing child. NSIS returns
  ; an empty path for a missing child, which previously skipped all cleanup.
  ClearErrors
  RMDir /r "$R2\Payday"
  IfErrors 0 +2
    StrCpy $R3 1
  ClearErrors
  RMDir /r "$R2\payday-desktop"
  IfErrors 0 +2
    StrCpy $R3 1
  Goto paydayCleanupComplete
  paydayCleanupInvalidRoot:
    StrCpy $R3 1
  paydayCleanupComplete:
!macroend

!macro customUnInstallSection
  Section "un.Delete ALL Payday history, balances and API key" PaydayRemoveData
    ; Upgrades preserve records. A normal uninstall removes selected data.
    ${If} ${isUpdated}
      Goto paydayCleanupDone
    ${EndIf}
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/KEEP_APP_DATA" $R1
    ${IfNot} ${Errors}
      Goto paydayCleanupDone
    ${EndIf}
    SetShellVarContext current
    !insertmacro PaydayDeleteOwnedData "$APPDATA"
    StrCmp $R3 0 paydayCleanupDone
    SetErrorLevel 1
    IfSilent paydayCleanupDone
    MessageBox MB_OK|MB_ICONEXCLAMATION "Payday could not remove all saved data. Close any running Payday window and retry. Saved data may remain in AppData Roaming\payday-desktop or AppData Roaming\Payday."
    paydayCleanupDone:
  SectionEnd
!macroend
