[CmdletBinding()]
param(
  [string]$GatewayHost = 'whisperchat.local',
  [string]$LanIp = '',
  [int]$GatewayPort = 8443,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secretDir = Join-Path $repoRoot 'infra\secrets'
$publicDir = Join-Path $repoRoot 'infra\public'
$envPath = Join-Path $repoRoot 'server\.env'

New-Item -ItemType Directory -Force $secretDir, $publicDir | Out-Null

$protectedPaths = @(
  (Join-Path $secretDir 'ca.key'),
  (Join-Path $secretDir 'server.key'),
  (Join-Path $secretDir 'backup-server.key'),
  $envPath
)
if (-not $Force -and ($protectedPaths | Where-Object { Test-Path -LiteralPath $_ })) {
  throw 'Secrets already exist. Re-run with -Force only for intentional local rotation.'
}

function Invoke-OpenSsl([string[]]$Arguments) {
  & openssl @Arguments
  if ($LASTEXITCODE -ne 0) { throw "openssl failed: $($Arguments -join ' ')" }
}

function New-SecureRandomBytes([int]$Length) {
  $bytes = New-Object byte[] $Length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return $bytes
}

function ConvertTo-Hex([byte[]]$Bytes) {
  return (($Bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

$caKey = Join-Path $secretDir 'ca.key'
$caCert = Join-Path $publicDir 'ca.crt'
$serverKey = Join-Path $secretDir 'server.key'
$serverCsr = Join-Path $secretDir 'server.csr'
$serverCert = Join-Path $publicDir 'server.crt'
$backupKey = Join-Path $secretDir 'backup-server.key'
$backupCsr = Join-Path $secretDir 'backup-server.csr'
$backupCert = Join-Path $publicDir 'backup-server.crt'
$extFile = Join-Path $secretDir 'server.ext'

$altNames = "DNS:$GatewayHost,DNS:whisperchat.local,DNS:whisperchat.lan,DNS:localhost,IP:127.0.0.1,IP:10.0.2.2"
if ($LanIp) {
  $parsedIp = $null
  if (-not [System.Net.IPAddress]::TryParse($LanIp, [ref]$parsedIp)) { throw "Invalid -LanIp: $LanIp" }
  $altNames += ",IP:$LanIp"
}

@(
  'authorityKeyIdentifier=keyid,issuer',
  'basicConstraints=CA:FALSE',
  'keyUsage=digitalSignature,keyEncipherment',
  'extendedKeyUsage=serverAuth',
  "subjectAltName=$altNames"
) | Set-Content -LiteralPath $extFile -Encoding ascii

Invoke-OpenSsl @('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', $caKey)
Invoke-OpenSsl @('req', '-x509', '-new', '-sha256', '-days', '3650', '-key', $caKey, '-subj', '/CN=WhisperChat Demo CA', '-out', $caCert)

foreach ($pair in @(@($serverKey, $serverCsr, $serverCert), @($backupKey, $backupCsr, $backupCert))) {
  $serialBytes = New-SecureRandomBytes 16
  $serial = ConvertTo-Hex $serialBytes
  Invoke-OpenSsl @('genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', $pair[0])
  Invoke-OpenSsl @('req', '-new', '-sha256', '-key', $pair[0], '-subj', "/CN=$GatewayHost", '-out', $pair[1])
  Invoke-OpenSsl @('x509', '-req', '-sha256', '-days', '825', '-in', $pair[1], '-CA', $caCert, '-CAkey', $caKey, '-set_serial', "0x$serial", '-extfile', $extFile, '-out', $pair[2])
}

function Get-SpkiPin([string]$CertificatePath) {
  $publicPem = Join-Path $secretDir 'spki-temp.pem'
  $publicDer = Join-Path $secretDir 'spki-temp.der'
  Invoke-OpenSsl @('x509', '-in', $CertificatePath, '-pubkey', '-noout', '-out', $publicPem)
  Invoke-OpenSsl @('pkey', '-pubin', '-in', $publicPem, '-outform', 'DER', '-out', $publicDer)
  $digest = (& openssl dgst -sha256 $publicDer) -join ''
  if ($LASTEXITCODE -ne 0 -or $digest -notmatch '=\s*([0-9a-fA-F]{64})$') { throw 'Unable to calculate SPKI digest.' }
  $hex = $Matches[1]
  $hashBytes = New-Object byte[] 32
  for ($i = 0; $i -lt 32; $i++) { $hashBytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }
  Remove-Item -LiteralPath $publicPem, $publicDer -Force
  return [Convert]::ToBase64String($hashBytes)
}

$passwordBytes = New-SecureRandomBytes 32
$dbPassword = ConvertTo-Hex $passwordBytes
$tokenBytes = New-SecureRandomBytes 32
$socketToken = [Convert]::ToBase64String($tokenBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

@(
  'POSTGRES_DB=whisperchat',
  'POSTGRES_USER=whisperchat',
  "POSTGRES_PASSWORD=$dbPassword",
  "DATABASE_URL=postgresql://whisperchat:$dbPassword@db:5432/whisperchat?schema=public",
  "P0_SOCKET_TOKEN=$socketToken",
  "GATEWAY_HOST=$GatewayHost",
  "GATEWAY_PORT=$GatewayPort",
  'LOG_LEVEL=info'
) | Set-Content -LiteralPath $envPath -Encoding ascii

$primaryPin = Get-SpkiPin $serverCert
$backupPin = Get-SpkiPin $backupCert
$endDateOutput = (& openssl x509 -in $serverCert -enddate -noout) -join ''
if ($LASTEXITCODE -ne 0 -or $endDateOutput -notmatch '^notAfter=(.+)$') { throw 'Unable to read certificate expiration.' }
$normalizedEndDate = ($Matches[1] -replace '\s+', ' ').Trim()
$expiration = [DateTime]::ParseExact(
  $normalizedEndDate,
  "MMM d HH:mm:ss yyyy 'GMT'",
  [Globalization.CultureInfo]::InvariantCulture,
  [Globalization.DateTimeStyles]::AssumeUniversal
).ToUniversalTime().ToString('yyyy-MM-dd')
[ordered]@{
  host = $GatewayHost
  pins = @($primaryPin, $backupPin)
  expiration = $expiration
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $publicDir 'pins.json') -Encoding ascii

Write-Output "Gateway URL: https://$GatewayHost`:$GatewayPort"
Write-Output "Primary SPKI pin: sha256/$primaryPin"
Write-Output "Backup SPKI pin:  sha256/$backupPin"
Write-Output "Public CA: $caCert"
Write-Output 'Private keys and server/.env were written only to gitignored paths.'
