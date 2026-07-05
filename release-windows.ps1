[CmdletBinding()]
param(
    [string]$OutputDirName = ("release_local_" + (Get-Date -Format "yyyyMMdd_HHmmss")),
    [switch]$BuildStandalone,
    [switch]$Archive,
    [switch]$BundleNsis,
    [switch]$SkipRootInstall,
    [switch]$SkipElectronInstall,
    [switch]$RefreshAndroidTemplate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$terre2Dir = Join-Path $projectRoot "packages/terre2"
$origine2Dir = Join-Path $projectRoot "packages/origine2"
$webgalElectronDir = Join-Path $projectRoot "packages/WebGAL-electron"
$releaseRoot = Join-Path $projectRoot "release"
$tempRoot = Join-Path $projectRoot ".codex-tmp/release-windows"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-ProjectPath {
    param([string]$Path)

    $projectPath = [System.IO.Path]::GetFullPath($projectRoot)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($projectPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside project root: $fullPath"
    }
}

function Reset-Directory {
    param([string]$Path)

    Assert-ProjectPath -Path $Path
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Ensure-Directory {
    param([string]$Path)

    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Copy-DirectoryContents {
    param(
        [string]$Source,
        [string]$Destination
    )

    Ensure-Directory -Path $Destination
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

function Clear-DirectoryContents {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Get-ChildItem -LiteralPath $Path -Force | Remove-Item -Recurse -Force
    }
}

function Invoke-External {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments = @()
    )

    Write-Step ("{0} {1}" -f $Command, ($Arguments -join " "))
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Ensure-Rcedit {
    param([string]$DestinationFile)

    $cachedFile = Join-Path $projectRoot "release/lib/rcedit-x64.exe"
    if (Test-Path -LiteralPath $cachedFile) {
        Copy-Item -LiteralPath $cachedFile -Destination $DestinationFile -Force
        return
    }

    Write-Step "Downloading rcedit-x64.exe"
    Invoke-WebRequest `
        -Uri "https://github.com/electron/rcedit/releases/latest/download/rcedit-x64.exe" `
        -OutFile $DestinationFile
}

function Copy-AndroidTemplate {
    param([string]$TemplatesDir)

    $destination = Join-Path $TemplatesDir "WebGAL_Android_Template"
    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Recurse -Force
    }

    if (-not $RefreshAndroidTemplate) {
        $cacheCandidates = @(
            Join-Path $projectRoot "release/assets/templates/WebGAL_Android_Template"
        )

        $releaseTemplateCaches = Get-ChildItem -LiteralPath $releaseRoot -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName "assets/templates/WebGAL_Android_Template" } |
            Where-Object { (Test-Path -LiteralPath $_) -and ([System.IO.Path]::GetFullPath($_) -ne [System.IO.Path]::GetFullPath($destination)) } |
            Sort-Object { (Get-Item -LiteralPath $_).LastWriteTimeUtc } -Descending

        $cacheCandidates += $releaseTemplateCaches
        $cachedTemplate = $cacheCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($cachedTemplate) {
            Write-Step ("Using cached WebGAL Android template: {0}" -f $cachedTemplate)
            Copy-Item -LiteralPath $cachedTemplate -Destination $destination -Recurse -Force
            return
        }
    }

    $cloneParent = Join-Path $tempRoot "android-template"
    Reset-Directory -Path $cloneParent
    Invoke-External -WorkingDirectory $cloneParent -Command "git" -Arguments @("clone", "--depth", "1", "https://github.com/nini22P/WebGAL-Android.git", "WebGAL_Android_Template")

    $cloneDir = Join-Path $cloneParent "WebGAL_Android_Template"
    $sourceMainActivity = Join-Path $cloneDir "app/src/main/java/com/openwebgal/demo/MainActivity.kt"
    $targetMainActivity = Join-Path $cloneDir "app/src/main/java/MainActivity.kt"
    if (Test-Path -LiteralPath $sourceMainActivity) {
        Move-Item -LiteralPath $sourceMainActivity -Destination $targetMainActivity -Force
    }

    Copy-Item -LiteralPath $cloneDir -Destination $destination -Recurse -Force
}

function Remove-OptionalPath {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
}

if ([System.IO.Path]::IsPathRooted($OutputDirName)) {
    $outputDir = [System.IO.Path]::GetFullPath($OutputDirName)
}
else {
    $normalizedOutputDirName = $OutputDirName.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    if ($normalizedOutputDirName -eq "release" -or $normalizedOutputDirName.StartsWith("release$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
        $outputDir = Join-Path $projectRoot $normalizedOutputDirName
    }
    else {
        $outputDir = Join-Path $releaseRoot $normalizedOutputDirName
    }
}

Assert-ProjectPath -Path $outputDir
Reset-Directory -Path $outputDir
Ensure-Directory -Path $tempRoot

if ($BundleNsis) {
    $null = Get-Command "makensis" -ErrorAction Stop
}

if (-not $SkipRootInstall) {
    Invoke-External -WorkingDirectory $projectRoot -Command "yarn" -Arguments @("install", "--frozen-lockfile", "--network-timeout=300000")
}

$terreBuildScript = if ($BuildStandalone) { "build-standalone" } else { "build" }
Invoke-External -WorkingDirectory $terre2Dir -Command "yarn" -Arguments @($terreBuildScript)
Invoke-External -WorkingDirectory $terre2Dir -Command "yarn" -Arguments @("pkg")
if (-not $BuildStandalone) {
    Invoke-External -WorkingDirectory $terre2Dir -Command "yarn" -Arguments @("update-exe-resources")
}

$libDir = Join-Path $outputDir "lib"
$publicDir = Join-Path $outputDir "public"
$assetsDir = Join-Path $outputDir "assets"
$templatesDir = Join-Path $assetsDir "templates"

Ensure-Directory -Path $libDir
Ensure-Directory -Path $publicDir
Ensure-Directory -Path $templatesDir
Ensure-Directory -Path (Join-Path $outputDir "Exported_Games")

Copy-Item -LiteralPath (Join-Path $terre2Dir "dist/WebGAL_Terre.exe") -Destination (Join-Path $outputDir "WebGAL_Terre.exe") -Force
Copy-DirectoryContents -Source (Join-Path $terre2Dir "public") -Destination $publicDir
Copy-DirectoryContents -Source (Join-Path $terre2Dir "assets") -Destination $assetsDir
Ensure-Rcedit -DestinationFile (Join-Path $libDir "rcedit-x64.exe")

Invoke-External -WorkingDirectory $origine2Dir -Command "yarn" -Arguments @("build")
Copy-DirectoryContents -Source (Join-Path $origine2Dir "dist") -Destination $publicDir

if (-not $SkipElectronInstall) {
    Invoke-External -WorkingDirectory $webgalElectronDir -Command "yarn" -Arguments @("install", "--frozen-lockfile")
}
Invoke-External -WorkingDirectory $webgalElectronDir -Command "yarn" -Arguments @("build")

$steamApiDll = Join-Path $webgalElectronDir "node_modules/steamworks.js/dist/win64/steam_api64.dll"
$electronOutDir = Join-Path $webgalElectronDir "build/win-unpacked"
if (Test-Path -LiteralPath $steamApiDll) {
    Copy-Item -LiteralPath $steamApiDll -Destination (Join-Path $electronOutDir "steam_api64.dll") -Force
}

Copy-Item -LiteralPath $electronOutDir -Destination (Join-Path $templatesDir "WebGAL_Electron_Template") -Recurse -Force
Copy-AndroidTemplate -TemplatesDir $templatesDir

Clear-DirectoryContents -Path (Join-Path $outputDir "Exported_Games")
Clear-DirectoryContents -Path (Join-Path $publicDir "games")
Clear-DirectoryContents -Path (Join-Path $templatesDir "WebGAL_Template/game/video")

@(
    (Join-Path $publicDir "games/.gitkeep"),
    (Join-Path $templatesDir "WebGAL_Template/game/video/.gitkeep"),
    (Join-Path $templatesDir "WebGAL_Android_Template/.github"),
    (Join-Path $templatesDir "WebGAL_Android_Template/.git"),
    (Join-Path $templatesDir "WebGAL_Android_Template/.gitattributes"),
    (Join-Path $templatesDir "WebGAL_Android_Template/app/src/main/assets/webgal/.gitkeep"),
    (Join-Path $templatesDir "WebGAL_Android_Template/app/src/main/java/com")
) | ForEach-Object {
    Remove-OptionalPath -Path $_
}

$zipPath = $null
if ($Archive) {
    $zipPath = "$outputDir.zip"
    Assert-ProjectPath -Path $zipPath
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    $null = Get-Command "tar.exe" -ErrorAction Stop
    Invoke-External -WorkingDirectory (Split-Path -Parent $outputDir) -Command "tar.exe" -Arguments @("-a", "-cf", $zipPath, (Split-Path -Leaf $outputDir))
}

$setupPath = $null
if ($BundleNsis) {
    $bundleDir = Join-Path $releaseRoot "bundle"
    Ensure-Directory -Path $bundleDir
    $setupPath = Join-Path $bundleDir ((Split-Path -Leaf $outputDir) + "_Setup.exe")
    if (Test-Path -LiteralPath $setupPath) {
        Remove-Item -LiteralPath $setupPath -Force
    }

    Invoke-External `
        -WorkingDirectory $projectRoot `
        -Command "makensis" `
        -Arguments @("/DRELEASE_PATH=$outputDir", "/DOUT_FILE=$setupPath", "./installer.nsi")
}

$summary = [PSCustomObject]@{
    OutputDir = $outputDir
    Archive = $zipPath
    Setup = $setupPath
    TotalSizeMB = [math]::Round(((Get-ChildItem -LiteralPath $outputDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)
}

Write-Host ""
$summary | Format-List
