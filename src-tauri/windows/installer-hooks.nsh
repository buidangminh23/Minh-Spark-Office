MiscButtonText "Quay lại" "Tiếp tục"

!macro REGISTER_OPEN_WITH EXT
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}" "" "Minh Spark Office ${EXT}"
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}\DefaultIcon" "" '"$INSTDIR\${MAINBINARYNAME}.exe",0'
  WriteRegStr HKCU "Software\Classes\MinhSparkOffice.${EXT}\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MinhSparkOffice.${EXT}" ""
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".${EXT}" ""
  WriteRegStr HKCU "Software\Minh Spark\Minh Spark Office\Capabilities\FileAssociations" ".${EXT}" "MinhSparkOffice.${EXT}"
!macroend

!macro UNREGISTER_OPEN_WITH EXT
  DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MinhSparkOffice.${EXT}"
  DeleteRegKey /ifempty HKCU "Software\Classes\.${EXT}\OpenWithProgids"
  DeleteRegKey HKCU "Software\Classes\MinhSparkOffice.${EXT}"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "Minh Spark Office"
  WriteRegStr HKCU "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'
  WriteRegStr HKCU "Software\Minh Spark\Minh Spark Office\Capabilities" "ApplicationName" "Minh Spark Office"
  WriteRegStr HKCU "Software\Minh Spark\Minh Spark Office\Capabilities" "ApplicationDescription" "Documents, spreadsheets, slides and photos"
  WriteRegStr HKCU "Software\Minh Spark\Minh Spark Office\Capabilities" "ApplicationIcon" '"$INSTDIR\${MAINBINARYNAME}.exe",0'
  WriteRegStr HKCU "Software\RegisteredApplications" "MinhSparkOffice" "Software\Minh Spark\Minh Spark Office\Capabilities"
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
    DeleteRegKey HKCU "Software\Minh Spark\Minh Spark Office\Capabilities"
    DeleteRegValue HKCU "Software\RegisteredApplications" "MinhSparkOffice"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
