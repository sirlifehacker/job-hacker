const express = require("express");
const cors = require("cors");
const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");

// Initialize Express app
const app = express();

// Configure middleware
// Allow cross-origin requests from n8n cloud and other origins
// n8n cloud uses specific origins, so we allow all for maximum compatibility
app.use(
  cors({
    origin: true, // Allow all origins (n8n cloud may use various domains)
    credentials: true,
  })
);

// Parse JSON bodies with a 50MB limit to handle large Base64 strings
// Note: n8n cloud may have smaller limits, so we validate size before processing
app.use(express.json({ limit: "50mb" }));

// Request timeout middleware (n8n cloud typically has 30-60s limits)
// Set a conservative timeout to ensure we respond before n8n times out
const REQUEST_TIMEOUT = 55000; // 55 seconds (leave buffer for n8n's timeout)
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT);
  res.setTimeout(REQUEST_TIMEOUT);
  next();
});

// Health check endpoint (useful for n8n cloud to verify service availability)
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Docx renderer service is running",
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint for basic connectivity check
app.get("/", (req, res) => {
  res.json({ 
    service: "DOCX Renderer Service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      render: "POST /render",
    },
  });
});

/**
 * POST /render
 * 
 * Renders a DOCX template by merging JSON data into it.
 * 
 * Request body:
 * {
 *   "templateBase64": "string",  // Base64-encoded DOCX template
 *   "data": {                    // JSON object with resume fields
 *     "summary_bullets": [...],
 *     "skills": "string",
 *     ...
 *   }
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "outputBase64": "string"     // Base64-encoded rendered DOCX
 * }
 * 
 * Response (error):
 * {
 *   "success": false,
 *   "error": "error message"
 * }
 */
app.post("/render", (req, res) => {
  const startTime = Date.now();
  
  try {
    // Extract template and data from request body
    const { templateBase64, data } = req.body;

    // Validate required fields
    if (!templateBase64) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: templateBase64",
      });
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: data",
      });
    }

    // Validate Base64 string size (n8n cloud may have response size limits)
    // Base64 is ~33% larger than binary, so a 10MB DOCX becomes ~13MB Base64
    // We'll limit to ~40MB Base64 string to stay within reasonable limits
    const MAX_BASE64_SIZE = 40 * 1024 * 1024; // 40MB
    if (templateBase64.length > MAX_BASE64_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Template too large. Maximum Base64 size is ${MAX_BASE64_SIZE / 1024 / 1024}MB. Received: ${(templateBase64.length / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // Log request info for debugging (without logging the actual Base64 data)
    console.log(`[${new Date().toISOString()}] Render request received - Template size: ${(templateBase64.length / 1024).toFixed(2)}KB`);

    // Step 1: Convert Base64 string to Buffer
    // This decodes the Base64-encoded DOCX template back to binary data
    let templateBuffer;
    try {
      templateBuffer = Buffer.from(templateBase64, "base64");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid Base64 encoding in templateBase64: " + error.message,
      });
    }

    // Step 2: Load the buffer as a ZIP file using PizZip
    // DOCX files are actually ZIP archives containing XML files
    let zip;
    try {
      zip = new PizZip(templateBuffer);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid DOCX template format: " + error.message,
      });
    }

    // Step 3: Initialize Docxtemplater with the ZIP
    // Options:
    // - paragraphLoop: true - allows looping over paragraphs
    // - linebreaks: true - preserves line breaks in the template
    let doc;
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to initialize Docxtemplater: " + error.message,
      });
    }

    // Step 4: Inject the JSON data into the template
    // This replaces placeholders in the template (e.g., {summary_bullets}) with actual data
    doc.setData(data);

    // Step 5: Render the template
    // This processes all the placeholders and merges the data
    try {
      doc.render();
    } catch (error) {
      // Docxtemplater provides detailed error information
      const errorMessage = error.properties
        ? `Template error: ${error.properties.explanation || error.message}`
        : error.message;

      console.error("Template rendering error:", errorMessage);
      console.error("Error details:", error);

      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }

    // Step 6: Generate the final DOCX as a Node buffer
    // This creates a new ZIP file (DOCX) with the rendered content
    let outputBuffer;
    try {
      outputBuffer = doc.getZip().generate({
        type: "nodebuffer", // Return as Node.js Buffer
        compression: "DEFLATE", // Standard ZIP compression
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate output DOCX: " + error.message,
      });
    }

    // Step 7: Convert the buffer back to Base64
    // This encodes the binary DOCX file as a Base64 string for JSON transport
    const outputBase64 = outputBuffer.toString("base64");

    // Log performance metrics
    const processingTime = Date.now() - startTime;
    const outputSizeKB = (outputBase64.length / 1024).toFixed(2);
    console.log(`[${new Date().toISOString()}] Render completed - Output size: ${outputSizeKB}KB, Processing time: ${processingTime}ms`);

    // Step 8: Return success response with Base64-encoded DOCX
    // Note: n8n cloud may have response size limits, so keep output files reasonable
    res.status(200).json({
      success: true,
      outputBase64: outputBase64,
      metadata: {
        outputSizeKB: parseFloat(outputSizeKB),
        processingTimeMs: processingTime,
      },
    });
  } catch (error) {
    // Catch any unexpected errors
    const processingTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Unexpected error in /render endpoint (${processingTime}ms):`, error);
    
    // Return user-friendly error message (don't expose internal details)
    const errorMessage = process.env.NODE_ENV === "production" 
      ? "An error occurred while processing the template. Please check your template and data format."
      : error.message;
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

// Get port from environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Docx engine running on port ${PORT}`);
});

