# PowerShell Script to Copy a Random File from a Specified Folder or Folders to Clipboard
# Set the default folder path below or pass a different folder path as an argument via copyrandomfile.bat

$defaultFolderPath = "$env:USERPROFILE\Downloads"

function Copy-RandomFile {
    param (
        [string[]]$folderPaths
    )
    Add-Type -AssemblyName System.Windows.Forms
    $allFiles = @()
    foreach ($folderPath in $folderPaths) {
        $filesInFolder = Get-ChildItem -Path $folderPath -Recurse -Filter "*.*" -ErrorAction SilentlyContinue | 
                         Where-Object { $_.Extension -in @(".jpg", ".jpeg", ".png", ".gif", ".webm") -and $_.Length -lt 4MB }
        $allFiles += $filesInFolder
    }
    
    if ($allFiles.Count -gt 0) {
        $randomFile = Get-Random -InputObject $allFiles
        $stringCollection = New-Object System.Collections.Specialized.StringCollection
        $stringCollection.Add($randomFile.FullName)
        [System.Windows.Forms.Clipboard]::SetFileDropList($stringCollection)
    }
}

# Call the function with default or provided paths
$paths = if ($args.Count -eq 0) { $defaultFolderPath } else { $args }
Copy-RandomFile -folderPaths $paths