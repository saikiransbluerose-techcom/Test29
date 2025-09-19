# Runs the same test 2-3 times sequentially with different SCENARIO values.
# Execute this script from the project root.

$datasets = @("Test Data 1", "Test Data 3")

foreach ($data in $datasets) {
    $env:SCENARIO = $data
    Write-Host "============================================="
    Write-Host " Running test with scenario: $data "
    Write-Host "============================================="

    # Specific test file (path is from the project root)
    npx playwright test SiemensApplication/tests/completeWorkFlow1WithExcelAndConfig.spec.js --project=chromium --headed 


    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Test failed for scenario: $data"
        exit $LASTEXITCODEs
    }
}
