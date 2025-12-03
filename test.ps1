# PowerShell test script for Windows
# Usage: .\test.ps1

$SERVER_URL = "http://localhost:3000"

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "DOCX Renderer Service - Local Testing" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "Server URL: $SERVER_URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "Make sure the server is running (npm start) before running tests!" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
Write-Host "[Test 1] Testing /health endpoint..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$SERVER_URL/health" -Method GET -ErrorAction Stop
    if ($response.status -eq "ok") {
        Write-Host "✓ Health check passed" -ForegroundColor Green
        $healthPassed = $true
    } else {
        Write-Host "✗ Health check failed" -ForegroundColor Red
        $healthPassed = $false
    }
} catch {
    Write-Host "✗ Health check error: $($_.Exception.Message)" -ForegroundColor Red
    $healthPassed = $false
}

# Test 2: Root Endpoint
Write-Host ""
Write-Host "[Test 2] Testing / endpoint..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$SERVER_URL/" -Method GET -ErrorAction Stop
    if ($response.service) {
        Write-Host "✓ Root endpoint passed" -ForegroundColor Green
        $rootPassed = $true
    } else {
        Write-Host "✗ Root endpoint failed" -ForegroundColor Red
        $rootPassed = $false
    }
} catch {
    Write-Host "✗ Root endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    $rootPassed = $false
}

# Test 3: Render Endpoint (requires test template)
Write-Host ""
Write-Host "[Test 3] Testing /render endpoint..." -ForegroundColor Green

if (-not (Test-Path "test-template.docx")) {
    Write-Host "⚠ Test template not found. Creating one..." -ForegroundColor Yellow
    Write-Host "  Run 'npm test' first to create the test template, or provide your own template." -ForegroundColor Yellow
    $renderPassed = $false
} else {
    try {
        # Read template and convert to Base64
        $templateBytes = [System.IO.File]::ReadAllBytes("test-template.docx")
        $templateBase64 = [System.Convert]::ToBase64String($templateBytes)
        
        # Prepare test data
        $testData = @{
            templateBase64 = $templateBase64
            data = @{
                summary_bullets = @(
                    "Experienced software developer with 5+ years in web development",
                    "Strong problem-solving skills and attention to detail",
                    "Proven track record of delivering high-quality solutions"
                )
                skills = "JavaScript, Node.js, Express, React, Python"
                tools = "VS Code, Git, Docker, AWS, PostgreSQL"
            }
        } | ConvertTo-Json -Depth 10
        
        # Make request
        $response = Invoke-RestMethod -Uri "$SERVER_URL/render" -Method POST `
            -Body $testData -ContentType "application/json" -ErrorAction Stop
        
        if ($response.success -and $response.outputBase64) {
            Write-Host "✓ Render endpoint passed" -ForegroundColor Green
            if ($response.metadata) {
                Write-Host "  - Output size: $($response.metadata.outputSizeKB) KB" -ForegroundColor Gray
                Write-Host "  - Processing time: $($response.metadata.processingTimeMs) ms" -ForegroundColor Gray
            }
            
            # Save output
            $outputBytes = [System.Convert]::FromBase64String($response.outputBase64)
            [System.IO.File]::WriteAllBytes("test-output.docx", $outputBytes)
            Write-Host "  - Output saved to: test-output.docx" -ForegroundColor Gray
            
            $renderPassed = $true
        } else {
            Write-Host "✗ Render endpoint failed" -ForegroundColor Red
            $renderPassed = $false
        }
    } catch {
        Write-Host "✗ Render endpoint error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        $renderPassed = $false
    }
}

# Summary
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan

$results = @{
    "Health Check" = $healthPassed
    "Root Endpoint" = $rootPassed
    "Render Endpoint" = $renderPassed
}

foreach ($test in $results.Keys) {
    $passed = $results[$test]
    $symbol = if ($passed) { "✓" } else { "✗" }
    $color = if ($passed) { "Green" } else { "Red" }
    $status = if ($passed) { "PASSED" } else { "FAILED" }
    Write-Host "$symbol $test`: $status" -ForegroundColor $color
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan

$allPassed = ($healthPassed -and $rootPassed -and $renderPassed)
if ($allPassed) {
    Write-Host "🎉 All tests passed! Service is ready to deploy." -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Please check the errors above." -ForegroundColor Yellow
}

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 59) -ForegroundColor Cyan

exit $(if ($allPassed) { 0 } else { 1 })

