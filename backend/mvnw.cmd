@ECHO OFF
SETLOCAL

SET BASE_DIR=%~dp0
SET WRAPPER_DIR=%BASE_DIR%.mvn\wrapper
SET PROPS_FILE=%WRAPPER_DIR%\maven-wrapper.properties
SET WRAPPER_JAR=%WRAPPER_DIR%\maven-wrapper.jar

IF NOT EXIST "%PROPS_FILE%" (
  ECHO Missing %PROPS_FILE%
  EXIT /B 1
)

IF NOT EXIST "%WRAPPER_JAR%" (
  FOR /F "usebackq tokens=1,* delims==" %%A IN ("%PROPS_FILE%") DO (
    IF "%%A"=="wrapperUrl" SET WRAPPER_URL=%%B
  )
  IF "%WRAPPER_URL%"=="" (
    ECHO Missing wrapperUrl in %PROPS_FILE%
    EXIT /B 1
  )
  SET WRAPPER_URL=%WRAPPER_URL:\:=:%
  IF NOT EXIST "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"
  powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing '%WRAPPER_URL%' -OutFile '%WRAPPER_JAR%'" || EXIT /B 1
)

IF NOT "%JAVA_HOME%"=="" (
  SET JAVA_BIN=%JAVA_HOME%\bin\java.exe
) ELSE (
  SET JAVA_BIN=java.exe
)

"%JAVA_BIN%" -Dmaven.multiModuleProjectDirectory="%BASE_DIR%" -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*

ENDLOCAL
