import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini API client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // AI Prediction endpoint
  app.post('/api/predict', async (req: express.Request, res: express.Response) => {
    try {
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please add it in Settings > Secrets.',
        });
      }

      const { product } = req.body;
      if (!product) {
        return res.status(400).json({ error: 'Product data is required' });
      }

      const { name, stock, price, expiryDate, daysLeft } = product;

      const prompt = `Perform a food waste risk analysis and sales optimization recommendation for the following product:
Product Name: ${name}
Current Stock: ${stock} units
Price: Rp ${price.toLocaleString('id-ID')}
Expiry Date: ${expiryDate}
Days Left to Expiry: ${daysLeft} days (relative to current date June 29, 2026)

Provide the analysis as a structured JSON object with the following fields:
- riskLevel: "High" | "Medium" | "Low"
- riskProbability: number (0 to 100)
- salesVelocityRequired: string (e.g. "3.5 units/day")
- keyRiskFactors: string[] (reasons why it is at risk, e.g. short shelf life, low historical demand, overstock)
- actionPlan: string (concrete recommendation, e.g. dynamic discounting, flash sales, bundle packaging)
- marketingTagline: string (a catchy promotional message to help sell the product quickly)`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskLevel: { type: Type.STRING, description: 'Waste risk level: High, Medium, or Low' },
              riskProbability: { type: Type.INTEGER, description: 'Probability of being wasted (0-100)' },
              salesVelocityRequired: { type: Type.STRING, description: 'Required sales rate to sell out before expiry' },
              keyRiskFactors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of factors contributing to the waste risk'
              },
              actionPlan: { type: Type.STRING, description: 'Concrete optimization and discounting strategy' },
              marketingTagline: { type: Type.STRING, description: 'Promotional tagline for discount' }
            },
            required: ['riskLevel', 'riskProbability', 'salesVelocityRequired', 'keyRiskFactors', 'actionPlan', 'marketingTagline']
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      const prediction = JSON.parse(responseText.trim());
      res.json(prediction);
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AI prediction' });
    }
  });

  // Bulk / Aggregate inventory report endpoint
  app.post('/api/reports', async (req: express.Request, res: express.Response) => {
    try {
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please add it in Settings > Secrets.',
        });
      }

      const { products } = req.body;
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Valid products list is required' });
      }

      const inventoryDescription = products.map((p: any) => 
        `- ${p.name}: ${p.stock} units, price Rp ${p.price}, expires on ${p.expiryDate} (${p.daysLeft} days left)`
      ).join('\n');

      const prompt = `Analyze the following store inventory and generate a food waste optimization report. Keep recommendations highly professional and practical.
Current date is June 29, 2026.

Inventory:
${inventoryDescription}

Provide the analysis as a structured JSON object with the following fields:
- generalAssessment: string (brief overview of current inventory health and waste exposure)
- topHighRiskItems: string[] (list of product names that require immediate attention)
- totalEstimatedSavingsIDR: number (estimated saving value in IDR if optimization is applied)
- operationalRecommendations: string[] (3 general operational actions to minimize waste store-wide)`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              generalAssessment: { type: Type.STRING },
              topHighRiskItems: { type: Type.ARRAY, items: { type: Type.STRING } },
              totalEstimatedSavingsIDR: { type: Type.INTEGER },
              operationalRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['generalAssessment', 'topHighRiskItems', 'totalEstimatedSavingsIDR', 'operationalRecommendations']
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini API');
      }

      const report = JSON.parse(responseText.trim());
      res.json(report);
    } catch (error: any) {
      console.error('Gemini API Reports Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate inventory report' });
    }
  });

  // Serve static assets or use Vite in dev mode
  if (process.env.NODE_ENV === 'production' || process.env.DISABLE_HMR === 'true') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
