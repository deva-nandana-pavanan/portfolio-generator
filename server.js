import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Set correct MIME type for CSS
app.use('/style.css', (req, res, next) => {
  res.type('text/css');
  next();
});

// Configure Multer for image uploads
const upload = multer({ dest: "uploads/" });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyC5HOY8Av9HOcBzZGeWRSUESDvFLZTu6HA");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function generatePortfolioHTML(userInput, summary, experience, skills, contact) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Generated Portfolio</title>
        <style>
            /* Add inline styles here to avoid MIME type issues */
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            section {
                margin-bottom: 20px;
                padding: 15px;
                border-radius: 5px;
                background-color: #f5f5f5;
            }
            h2 {
                color: #333;
            }
            ul {
                list-style-type: none;
                padding-left: 0;
            }
            li {
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <section id="summary">
            <h2>Professional Summary</h2>
            <p>${summary}</p>
        </section>

        <section id="experience">
            <h2>Experience</h2>
            <ul>
                ${experience.map(exp => `<li>${exp}</li>`).join('')}
            </ul>
        </section>

        <section id="skills">
            <h2>Skills</h2>
            <p>${skills}</p>
        </section>

        <section id="contact">
            <h2>Contact Information</h2>
            <p>${contact}</p>
        </section>
    </body>
    </html>`;
}

// API endpoint to process user input & image
// Update the API endpoint in server.js to remove any Markdown formatting
app.post("/generate", upload.single("image"), async (req, res) => {
  try {
      const userInput = req.body.text;

      const aiPrompt = `You are an AI specializing in generating structured content for portfolios. 
      Generate a professional portfolio based on the following input. Return JSON with this structure:
      {
          "summary": "A brief professional summary about the user.",
          "experience": ["List of experience highlights."],
          "skills": "Comma-separated list of skills.",
          "contact": "Contact information (if provided)."
      }`;

      const combinedInput = `${aiPrompt}\n\nUser Input: ${userInput}`;

      const imagePath = req.file?.path;
      const mimeType = req.file?.mimetype;

      let requestParts = [{ text: combinedInput }];

      if (imagePath && mimeType) {
          requestParts.push(fileToGenerativePart(imagePath, mimeType));
      }

      const result = await model.generateContent(requestParts);
      const responseText = result.response.candidates[0].content.parts[0].text;
      
      // Parse the JSON response, removing any Markdown formatting
      const cleanResponse = responseText.replace(/```[a-z]*\n|\n```/g, '');
      const aiGeneratedText = JSON.parse(cleanResponse);

      const html = generatePortfolioHTML(
          userInput,
          aiGeneratedText.summary || "No summary provided.",
          aiGeneratedText.experience || [],
          aiGeneratedText.skills || "No skills listed.",
          aiGeneratedText.contact || "No contact info provided."
      );

      // Send clean HTML response
      res.setHeader('Content-Type', 'text/html');
      res.send(html);

      if (imagePath) fs.unlinkSync(imagePath);
  } catch (error) {
      console.error("Error:", error); 
      res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});