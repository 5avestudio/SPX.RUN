// Tradier API Diagnostic Script
// Run this to generate a debug report for Tradier support

const TRADIER_API_KEY = process.env.TRADIER_API_KEY
const BASE_URL = "https://api.tradier.com/v1"

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split("T")[0]

// Test configurations
const testCases = [
  {
    name: "SPX Quote",
    endpoint: "/markets/quotes",
    params: { symbols: "SPX", greeks: "false" },
  },
  {
    name: "SPX Options Expirations",
    endpoint: "/markets/options/expirations",
    params: { symbol: "SPX", includeAllRoots: "false" },
  },
  {
    name: "SPX Options Expirations (with allRoots)",
    endpoint: "/markets/options/expirations",
    params: { symbol: "SPX", includeAllRoots: "true" },
  },
  {
    name: "SPXW Options Expirations",
    endpoint: "/markets/options/expirations",
    params: { symbol: "SPXW", includeAllRoots: "false" },
  },
  {
    name: "SPX Options Chain (today)",
    endpoint: "/markets/options/chains",
    params: { symbol: "SPX", expiration: today, greeks: "false" },
  },
  {
    name: "SPXW Options Chain (today)",
    endpoint: "/markets/options/chains",
    params: { symbol: "SPXW", expiration: today, greeks: "false" },
  },
  {
    name: "SPX Options Chain (with greeks)",
    endpoint: "/markets/options/chains",
    params: { symbol: "SPX", expiration: today, greeks: "true" },
  },
  {
    name: "AAPL Quote (control test)",
    endpoint: "/markets/quotes",
    params: { symbols: "AAPL", greeks: "false" },
  },
  {
    name: "AAPL Options Expirations (control test)",
    endpoint: "/markets/options/expirations",
    params: { symbol: "AAPL", includeAllRoots: "false" },
  },
  {
    name: "SPX Option Symbol Quote (example format)",
    endpoint: "/markets/quotes",
    params: { symbols: `SPX${today.replace(/-/g, "").slice(2)}C06950000`, greeks: "true" },
  },
]

async function runTest(testCase) {
  const params = new URLSearchParams(testCase.params)
  const url = `${BASE_URL}${testCase.endpoint}?${params.toString()}`

  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${TRADIER_API_KEY}`,
      },
    })

    const endTime = Date.now()
    const responseText = await response.text()

    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseText)
    } catch {
      parsedResponse = responseText
    }

    return {
      name: testCase.name,
      url: url.replace(TRADIER_API_KEY || "", "[REDACTED]"),
      status: response.status,
      statusText: response.statusText,
      responseTime: `${endTime - startTime}ms`,
      headers: Object.fromEntries(response.headers.entries()),
      response: parsedResponse,
      success: response.ok,
      hasData: checkHasData(parsedResponse),
    }
  } catch (error) {
    return {
      name: testCase.name,
      url: url.replace(TRADIER_API_KEY || "", "[REDACTED]"),
      status: "ERROR",
      error: error.message,
      success: false,
      hasData: false,
    }
  }
}

function checkHasData(response) {
  if (!response || typeof response !== "object") return false
  if (response.quotes?.quote) return true
  if (response.options?.option && response.options.option.length > 0) return true
  if (response.expirations?.date && response.expirations.date.length > 0) return true
  return false
}

async function runAllTests() {
  console.log("=".repeat(80))
  console.log("TRADIER API DIAGNOSTIC REPORT")
  console.log("=".repeat(80))
  console.log("")
  console.log("Generated:", new Date().toISOString())
  console.log("Test Date (for expirations):", today)
  console.log("API Key Present:", !!TRADIER_API_KEY)
  console.log("API Key Length:", TRADIER_API_KEY?.length || 0)
  console.log("API Key Prefix:", TRADIER_API_KEY?.substring(0, 8) + "..." || "N/A")
  console.log("Base URL:", BASE_URL)
  console.log("")
  console.log("=".repeat(80))
  console.log("TEST RESULTS")
  console.log("=".repeat(80))
  console.log("")

  const results = []

  for (const testCase of testCases) {
    console.log(`\n${"─".repeat(60)}`)
    console.log(`TEST: ${testCase.name}`)
    console.log("─".repeat(60))

    const result = await runTest(testCase)
    results.push(result)

    console.log(`URL: ${result.url}`)
    console.log(`Status: ${result.status} ${result.statusText || ""}`)
    console.log(`Response Time: ${result.responseTime || "N/A"}`)
    console.log(`Has Data: ${result.hasData}`)
    console.log(`Response Preview:`)
    console.log(JSON.stringify(result.response, null, 2).substring(0, 500))

    if (result.error) {
      console.log(`Error: ${result.error}`)
    }
  }

  // Summary
  console.log("\n")
  console.log("=".repeat(80))
  console.log("SUMMARY")
  console.log("=".repeat(80))
  console.log("")

  const successCount = results.filter((r) => r.success && r.hasData).length
  const failCount = results.length - successCount

  console.log(`Total Tests: ${results.length}`)
  console.log(`Successful (with data): ${successCount}`)
  console.log(`Failed/No Data: ${failCount}`)
  console.log("")

  console.log("Results by Test:")
  results.forEach((r) => {
    const status = r.success && r.hasData ? "✓ PASS" : "✗ FAIL"
    console.log(`  ${status} - ${r.name}`)
  })

  // Issues found
  console.log("\n")
  console.log("=".repeat(80))
  console.log("ISSUES IDENTIFIED")
  console.log("=".repeat(80))
  console.log("")

  const issues = []

  // Check SPX quote
  const spxQuote = results.find((r) => r.name === "SPX Quote")
  if (!spxQuote?.hasData) {
    issues.push("SPX quotes not returning data")
  }

  // Check SPX expirations
  const spxExp = results.find((r) => r.name === "SPX Options Expirations")
  if (!spxExp?.hasData) {
    issues.push('SPX options expirations returning null (symbol="SPX")')
  }

  // Check SPXW expirations
  const spxwExp = results.find((r) => r.name === "SPXW Options Expirations")
  if (!spxwExp?.hasData) {
    issues.push('SPXW options expirations returning null (symbol="SPXW")')
  }

  // Check SPX options chain
  const spxChain = results.find((r) => r.name === "SPX Options Chain (today)")
  if (!spxChain?.hasData) {
    issues.push(`SPX options chain returning null for expiration ${today}`)
  }

  // Check AAPL (control)
  const aaplQuote = results.find((r) => r.name === "AAPL Quote (control test)")
  const aaplExp = results.find((r) => r.name === "AAPL Options Expirations (control test)")
  if (aaplQuote?.hasData && aaplExp?.hasData) {
    issues.push("AAPL (control) works fine - issue appears to be SPX-specific")
  }

  if (issues.length === 0) {
    console.log("No issues found - all tests passed!")
  } else {
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`)
    })
  }

  // Recommended curl commands for Tradier support
  console.log("\n")
  console.log("=".repeat(80))
  console.log("CURL COMMANDS FOR TRADIER SUPPORT TO TEST")
  console.log("=".repeat(80))
  console.log("")
  console.log("# 1. SPX Quote (this should work)")
  console.log(`curl --request GET \\`)
  console.log(`  --url 'https://api.tradier.com/v1/markets/quotes?symbols=SPX&greeks=false' \\`)
  console.log(`  --header 'Accept: application/json' \\`)
  console.log(`  --header 'Authorization: Bearer <TOKEN>'`)
  console.log("")
  console.log("# 2. SPX Options Expirations")
  console.log(`curl --request GET \\`)
  console.log(`  --url 'https://api.tradier.com/v1/markets/options/expirations?symbol=SPX' \\`)
  console.log(`  --header 'Accept: application/json' \\`)
  console.log(`  --header 'Authorization: Bearer <TOKEN>'`)
  console.log("")
  console.log("# 3. SPX Options Chain")
  console.log(`curl --request GET \\`)
  console.log(
    `  --url 'https://api.tradier.com/v1/markets/options/chains?symbol=SPX&expiration=${today}&greeks=false' \\`,
  )
  console.log(`  --header 'Accept: application/json' \\`)
  console.log(`  --header 'Authorization: Bearer <TOKEN>'`)
  console.log("")

  // Full JSON report
  console.log("\n")
  console.log("=".repeat(80))
  console.log("FULL JSON REPORT (for attachment)")
  console.log("=".repeat(80))
  console.log("")

  const fullReport = {
    generatedAt: new Date().toISOString(),
    testDate: today,
    environment: {
      apiKeyPresent: !!TRADIER_API_KEY,
      apiKeyLength: TRADIER_API_KEY?.length || 0,
      baseUrl: BASE_URL,
    },
    summary: {
      totalTests: results.length,
      successful: successCount,
      failed: failCount,
    },
    issues: issues,
    results: results.map((r) => ({
      name: r.name,
      url: r.url,
      status: r.status,
      hasData: r.hasData,
      response: r.response,
    })),
  }

  console.log(JSON.stringify(fullReport, null, 2))
}

// Run the tests
runAllTests().catch(console.error)
