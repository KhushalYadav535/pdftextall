import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

async function runBrowserTest() {
  console.log('--- Starting Playwright UI Test for GAP-P0-2 ---')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  try {
    console.log('Navigating to http://localhost:5175/ ...')
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' })

    // Upload fillable-form-test.pdf
    const filePath = path.resolve('scratch/test-docs/fillable-form-test.pdf')
    console.log(`Setting input file: ${filePath}`)
    const fileInput = await page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(filePath)

    // Wait for canvas to render
    console.log('Waiting for canvas to render...')
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.waitForTimeout(2000) // allow annotation layer & widgets to mount

    // Check if mode switcher is visible
    const editModeBtn = page.getByRole('button', { name: 'Edit', exact: true })
    const fillModeBtn = page.getByRole('button', { name: 'Fill Form', exact: true })
    console.log('Checking Mode Switcher buttons...')
    await editModeBtn.waitFor({ state: 'visible', timeout: 5000 })
    await fillModeBtn.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ Mode Switcher buttons visible')

    // Click "Fill Form" mode
    console.log('Switching to Fill Form mode...')
    await fillModeBtn.click()
    await page.waitForTimeout(500)

    // Check that form inputs are present in DOM
    const textInput = page.locator('input[name="applicant.name"]')
    await textInput.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ applicant.name input visible')

    const checkboxInput = page.locator('input[name="applicant.subscribe"]')
    await checkboxInput.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ applicant.subscribe checkbox visible')

    const radioInputs = page.locator('input[name="applicant.plan"]')
    const radioCount = await radioInputs.count()
    console.log(`  ✓ applicant.plan radio count: ${radioCount}`)

    const selectDropdown = page.locator('select[name="applicant.country"]')
    await selectDropdown.waitFor({ state: 'visible', timeout: 5000 })
    console.log('  ✓ applicant.country select dropdown visible')

    // Interact with form fields
    console.log('Interacting with form fields...')
    await textInput.fill('Alice Wonderland')
    await checkboxInput.check()
    if (radioCount > 1) {
      await radioInputs.nth(1).check() // select 'Pro'
    }
    await selectDropdown.selectOption('Germany')
    await page.waitForTimeout(500)

    // Capture screenshot of filled form in Fill Form mode
    const screenshotDir = path.resolve('scratch/test-docs/screenshots')
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })
    const screenshotPath = path.join(screenshotDir, 'acroform-fill-mode.png')
    await page.screenshot({ path: screenshotPath, fullPage: false })
    console.log(`  ✓ Screenshot saved to: ${screenshotPath}`)

    // Verify Flatten Form toggle
    const flattenCheckbox = page.locator('label:has-text("Flatten Form") input[type="checkbox"]')
    await flattenCheckbox.waitFor({ state: 'visible' })
    const isFlattenCheckedInitial = await flattenCheckbox.isChecked()
    console.log(`  ✓ Flatten Form initial state: ${isFlattenCheckedInitial}`)

    await flattenCheckbox.check()
    console.log(`  ✓ Flatten Form checked: ${await flattenCheckbox.isChecked()}`)

    console.log('\n=== PLAYWRIGHT UI TEST PASSED! ===\n')
  } finally {
    await browser.close()
  }
}

runBrowserTest().catch(err => {
  console.error('\n❌ Playwright UI Test failed:', err)
  process.exit(1)
})
