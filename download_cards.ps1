$suits = @('H', 'D', 'C', 'S')
$ranks = @('7', '8', '9', '0', 'J', 'Q', 'K', 'A')

$outDir = "d:\Antigravity\belote-tutorial\assets\cards"
New-Item -ItemType Directory -Force -Path $outDir

foreach ($s in $suits) {
    foreach ($r in $ranks) {
        $fileName = "$r$s.png"
        $url = "https://deckofcardsapi.com/static/img/$fileName"
        $outFile = Join-Path $outDir $fileName
        Write-Host "Downloading $url"
        try {
            Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing
        } catch {
            Write-Host "Failed to download $url"
        }
    }
}
Write-Host "Done downloading cards."
