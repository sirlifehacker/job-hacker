const http = require("http");
const fs = require("fs");
const path = require("path");
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const TEST_TEMPLATE_PATH = path.join(__dirname, "test-template.docx");

/**
 * Creates a simple test DOCX template if it doesn't exist
 */
function createTestTemplate() {
  if (fs.existsSync(TEST_TEMPLATE_PATH)) {
    console.log("✓ Test template already exists");
    return;
  }

  console.log("Creating test template...");
  
  // Create a minimal DOCX structure
  // This is a simplified DOCX file structure
  // NOTE: We use double braces {{ }} for template tags to match the server configuration
  // The server is configured with delimiters: { start: '{{', end: '}}' } to support
  // templates that use Handlebars/Mustache-style syntax, which helps avoid conflicts
  // with single braces that might appear in regular text content.
  const minimalDocx = {
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Resume Test</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Summary:</w:t>
      </w:r>
    </w:p>
    {{#summary_bullets}}
    <w:p>
      <w:r>
        <w:t>• {{.}}</w:t>
      </w:r>
    </w:p>
    {{/summary_bullets}}
    <w:p>
      <w:r>
        <w:t>Skills: {{skills}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Tools: {{tools}}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  };

  // Create a ZIP file (DOCX is a ZIP)
  const zip = new PizZip();
  Object.entries(minimalDocx).forEach(([filePath, content]) => {
    zip.file(filePath, content);
  });

  // Generate and save
  const buffer = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(TEST_TEMPLATE_PATH, buffer);
  console.log("✓ Test template created at:", TEST_TEMPLATE_PATH);
}

/**
 * Makes an HTTP request to the server
 */
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Test the health endpoint
 */
async function testHealth() {
  console.log("\n[Test 1] Testing /health endpoint...");
  try {
    const url = new URL(SERVER_URL);
    const result = await makeRequest({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: "/health",
      method: "GET",
    });

    if (result.status === 200 && result.data.status === "ok") {
      console.log("✓ Health check passed");
      return true;
    } else {
      console.log("✗ Health check failed:", result);
      return false;
    }
  } catch (error) {
    console.log("✗ Health check error:", error.message);
    return false;
  }
}

/**
 * Test the root endpoint
 */
async function testRoot() {
  console.log("\n[Test 2] Testing / endpoint...");
  try {
    const url = new URL(SERVER_URL);
    const result = await makeRequest({
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: "/",
      method: "GET",
    });

    if (result.status === 200 && result.data.service) {
      console.log("✓ Root endpoint passed");
      return true;
    } else {
      console.log("✗ Root endpoint failed:", result);
      return false;
    }
  } catch (error) {
    console.log("✗ Root endpoint error:", error.message);
    return false;
  }
}

/**
 * Test the render endpoint
 */
async function testRender() {
  console.log("\n[Test 3] Testing /render endpoint...");

  // Read the test template
  if (!fs.existsSync(TEST_TEMPLATE_PATH)) {
    console.log("✗ Test template not found. Run the test again to create it.");
    return false;
  }

  const templateBuffer = fs.readFileSync(TEST_TEMPLATE_PATH);
  const templateBase64 = templateBuffer.toString("base64");

  // Test data matching the template structure
  const testData = {
    templateBase64: templateBase64,
    data: {
      summary_bullets: [
        "Experienced software developer with 5+ years in web development",
        "Strong problem-solving skills and attention to detail",
        "Proven track record of delivering high-quality solutions",
      ],
      skills: "JavaScript, Node.js, Express, React, Python",
      tools: "VS Code, Git, Docker, AWS, PostgreSQL",
    },
  };

  try {
    const url = new URL(SERVER_URL);
    const result = await makeRequest(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: "/render",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      testData
    );

    if (result.status === 200 && result.data.success && result.data.outputBase64) {
      console.log("✓ Render endpoint passed");
      console.log(`  - Output size: ${result.data.metadata?.outputSizeKB || "N/A"} KB`);
      console.log(`  - Processing time: ${result.data.metadata?.processingTimeMs || "N/A"} ms`);

      // Optionally save the output for manual inspection
      const outputPath = path.join(__dirname, "test-output.docx");
      const outputBuffer = Buffer.from(result.data.outputBase64, "base64");
      fs.writeFileSync(outputPath, outputBuffer);
      console.log(`  - Output saved to: ${outputPath}`);

      return true;
    } else {
      console.log("✗ Render endpoint failed:", result);
      return false;
    }
  } catch (error) {
    console.log("✗ Render endpoint error:", error.message);
    return false;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log("\n[Test 4] Testing error handling...");

  const testCases = [
    {
      name: "Missing templateBase64",
      data: { data: { skills: "test" } },
      expectedStatus: 400,
    },
    {
      name: "Missing data",
      data: { templateBase64: "dGVzdA==" },
      expectedStatus: 400,
    },
    {
      name: "Invalid Base64",
      data: { templateBase64: "not-valid-base64!!!", data: {} },
      expectedStatus: 400,
    },
  ];

  let passed = 0;
  for (const testCase of testCases) {
    try {
      const url = new URL(SERVER_URL);
      const result = await makeRequest(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: "/render",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
        testCase.data
      );

      if (result.status === testCase.expectedStatus && result.data.success === false) {
        console.log(`  ✓ ${testCase.name} - handled correctly`);
        passed++;
      } else {
        console.log(`  ✗ ${testCase.name} - unexpected response:`, result);
      }
    } catch (error) {
      console.log(`  ✗ ${testCase.name} - error:`, error.message);
    }
  }

  return passed === testCases.length;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("=".repeat(60));
  console.log("DOCX Renderer Service - Local Testing");
  console.log("=".repeat(60));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log("\nMake sure the server is running (npm start) before running tests!");

  // Create test template
  createTestTemplate();

  // Run tests
  const results = {
    health: await testHealth(),
    root: await testRoot(),
    render: await testRender(),
    errors: await testErrorHandling(),
  };

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? "✓" : "✗"} ${test}: ${passed ? "PASSED" : "FAILED"}`);
  });

  const allPassed = Object.values(results).every((r) => r === true);
  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("🎉 All tests passed! Service is ready to deploy.");
  } else {
    console.log("⚠️  Some tests failed. Please check the errors above.");
  }
  console.log("=".repeat(60));

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

