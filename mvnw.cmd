@REM Maven command forwarder for Railway Management System
@echo off
set "MAVEN_CMD=C:\Users\Dell\Downloads\IntelliJ IDEA 2025.3.1\plugins\maven\lib\maven3\bin\mvn.cmd"
if exist "%MAVEN_CMD%" (
    call "%MAVEN_CMD%" %*
) else (
    mvn %*
)
