MiscButtonText "Quay lại" "Tiếp tục"

!macro REGISTER_OPEN_WITH EXT
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}" "" "Office 23 ${EXT}"
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}\DefaultIcon" "" '"$INSTDIR\${MAINBINARYNAME}.exe",0'
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MinhSparkOffice.${EXT}" ""
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".${EXT}" ""
  WriteRegStr HKCU "Software\Minh Spark\Office 23\Capabilities\FileAssociations" ".${EXT}" "MinhSparkOffice.${EXT}"
!macroend

!macro UNREGISTER_OPEN_WITH EXT
  DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MinhSparkOffice.${EXT}"
  DeleteRegKey /ifempty HKCU "Software\Classes\.${EXT}\OpenWithProgids"
  DeleteRegKey HKCU "Software\Classes\MinhSparkOffice.${EXT}"
!macroend

!define LEGACY_PRODUCTNAME "Minh Spark Office"
!define LEGACY_PRODUCTKEY "Software\Minh Spark\Minh Spark Office"

!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R9 SHCTX "Software\${MANUFACTURER}\${PRODUCTNAME}" ""
  ${If} $R9 == ""
    ReadRegStr $R9 SHCTX "${LEGACY_PRODUCTKEY}" ""
    ${If} $R9 != ""
    ${AndIf} ${FileExists} "$R9\${MAINBINARYNAME}.exe"
      StrCpy $INSTDIR $R9
      SetOutPath $INSTDIR
    ${EndIf}
  ${EndIf}
!macroend

!macro MIGRATE_LEGACY_SHORTCUTS
  ${If} ${FileExists} "$DESKTOP\${LEGACY_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${LEGACY_PRODUCTNAME}.lnk"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\office-app.ico" 0
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}
  Delete "$SMPROGRAMS\${LEGACY_PRODUCTNAME}\${LEGACY_PRODUCTNAME}.lnk"
  RMDir "$SMPROGRAMS\${LEGACY_PRODUCTNAME}"
  Delete "$SMPROGRAMS\${LEGACY_PRODUCTNAME}.lnk"
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${LEGACY_PRODUCTNAME}"
  DeleteRegKey SHCTX "${LEGACY_PRODUCTKEY}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "Office 23"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr HKCU "Software\Minh Spark\Office 23\Capabilities" "ApplicationName" "Office 23"
  WriteRegStr HKCU "Software\Minh Spark\Office 23\Capabilities" "ApplicationDescription" "Documents, spreadsheets, slides and photos"
  WriteRegStr HKCU "Software\Minh Spark\Office 23\Capabilities" "ApplicationIcon" '"$INSTDIR\${MAINBINARYNAME}.exe",0'
  WriteRegStr HKCU "Software\RegisteredApplications" "MinhSparkOffice" "Software\Minh Spark\Office 23\Capabilities"
  !insertmacro REGISTER_OPEN_WITH "docx"
  !insertmacro REGISTER_OPEN_WITH "xlsx"
  !insertmacro REGISTER_OPEN_WITH "xlsm"
  !insertmacro REGISTER_OPEN_WITH "xls"
  !insertmacro REGISTER_OPEN_WITH "csv"
  !insertmacro REGISTER_OPEN_WITH "tsv"
  !insertmacro REGISTER_OPEN_WITH "pdf"
  !insertmacro REGISTER_OPEN_WITH "pptx"
  !insertmacro REGISTER_OPEN_WITH "ppt"
  !insertmacro REGISTER_OPEN_WITH "txt"
  !insertmacro REGISTER_OPEN_WITH "md"
  !insertmacro REGISTER_OPEN_WITH "png"
  !insertmacro REGISTER_OPEN_WITH "jpg"
  !insertmacro REGISTER_OPEN_WITH "jpeg"
  !insertmacro REGISTER_OPEN_WITH "jfif"
  !insertmacro REGISTER_OPEN_WITH "webp"
  !insertmacro REGISTER_OPEN_WITH "gif"
  !insertmacro REGISTER_OPEN_WITH "bmp"
  !insertmacro REGISTER_OPEN_WITH "ico"
  !insertmacro REGISTER_OPEN_WITH "svg"
  !insertmacro REGISTER_OPEN_WITH "avif"
  !insertmacro REGISTER_OPEN_WITH "tiff"
  !insertmacro REGISTER_OPEN_WITH "tif"
  ${If} $AppStartMenuFolder != ""
    CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\office-app.ico" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    System::Call 'shell32::SHChangeNotify(i 0x00002000, i 0x0005, w "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk", p 0)'
  ${Else}
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\office-app.ico" 0
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    System::Call 'shell32::SHChangeNotify(i 0x00002000, i 0x0005, w "$SMPROGRAMS\${PRODUCTNAME}.lnk", p 0)'
  ${EndIf}
  !insertmacro MIGRATE_LEGACY_SHORTCUTS
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ReadRegStr $R0 HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" ""
  ${If} $R0 == '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
    !insertmacro UNREGISTER_OPEN_WITH "docx"
    !insertmacro UNREGISTER_OPEN_WITH "xlsx"
    !insertmacro UNREGISTER_OPEN_WITH "xlsm"
    !insertmacro UNREGISTER_OPEN_WITH "xls"
    !insertmacro UNREGISTER_OPEN_WITH "csv"
    !insertmacro UNREGISTER_OPEN_WITH "tsv"
    !insertmacro UNREGISTER_OPEN_WITH "pdf"
    !insertmacro UNREGISTER_OPEN_WITH "pptx"
    !insertmacro UNREGISTER_OPEN_WITH "ppt"
    !insertmacro UNREGISTER_OPEN_WITH "txt"
    !insertmacro UNREGISTER_OPEN_WITH "md"
    !insertmacro UNREGISTER_OPEN_WITH "png"
    !insertmacro UNREGISTER_OPEN_WITH "jpg"
    !insertmacro UNREGISTER_OPEN_WITH "jpeg"
    !insertmacro UNREGISTER_OPEN_WITH "jfif"
    !insertmacro UNREGISTER_OPEN_WITH "webp"
    !insertmacro UNREGISTER_OPEN_WITH "gif"
    !insertmacro UNREGISTER_OPEN_WITH "bmp"
    !insertmacro UNREGISTER_OPEN_WITH "ico"
    !insertmacro UNREGISTER_OPEN_WITH "svg"
    !insertmacro UNREGISTER_OPEN_WITH "avif"
    !insertmacro UNREGISTER_OPEN_WITH "tiff"
    !insertmacro UNREGISTER_OPEN_WITH "tif"
    DeleteRegKey HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe"
    DeleteRegKey HKCU "Software\Minh Spark\Office 23\Capabilities"
    DeleteRegValue HKCU "Software\RegisteredApplications" "MinhSparkOffice"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
