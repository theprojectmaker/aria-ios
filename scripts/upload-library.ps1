# Publishes the offline Library pack as GitHub release "library-v1" on the
# public theprojectmaker/aria-ios repo, where the app downloads it from.
# Run from the aria folder:  & .\scripts\upload-library.ps1
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:TEMP 'claude\45f43a4479ee10a8\5de2b708-b77f-4854-86ba-232c8bc09e5a\scratchpad\aria2\library-flat'
if (-not (Test-Path (Join-Path $dir 'manifest.json'))) { throw "Library pack not found at $dir" }
$repo = 'theprojectmaker/aria-ios'
$notes = "Offline knowledge pack downloaded in-app by Aria: 79,055 Simple English Wikipedia articles (CC BY-SA 4.0) and 85,931 Webster's 1913 dictionary entries (public domain), sharded JSON with a search index."
gh release view library-v1 -R $repo *> $null
if ($LASTEXITCODE -ne 0) {
  gh release create library-v1 -R $repo --title "Aria offline Library v1" --notes $notes (Join-Path $dir 'manifest.json')
}
$files = Get-ChildItem $dir -Filter *.json | Where-Object { $_.Name -ne 'manifest.json' } | ForEach-Object { $_.FullName }
for ($i = 0; $i -lt $files.Count; $i += 30) {
  $batch = $files[$i..([Math]::Min($i + 29, $files.Count - 1))]
  Write-Host "Uploading $($i + 1)-$($i + $batch.Count) of $($files.Count)..."
  gh release upload library-v1 -R $repo --clobber @batch
  if ($LASTEXITCODE -ne 0) { throw "upload failed at batch starting $i" }
}
gh release upload library-v1 -R $repo --clobber (Join-Path $dir 'manifest.json')
$n = gh release view library-v1 -R $repo --json assets --jq '.assets | length'
Write-Host "Done: $n files on the release (expected 273)."
