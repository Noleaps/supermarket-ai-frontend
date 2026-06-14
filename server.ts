import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

const DATA_FILE = path.join(process.cwd(), "inventory_data.json");
const WASTE_LOG_FILE = path.join(process.cwd(), "waste_logs.json");

// Helper to format Date relative to now, returning YYYY-MM-DD
function getRelativeDateStr(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}

// Initial seed data
const DEFAULT_INVENTORY = [
  {
    id: "prod-001",
    sku: "PRD-STRW-01",
    name: "Organic Fresh Strawberries 250g",
    category: "Produce",
    quantity: 42,
    unit: "packs",
    unitPrice: 4.99,
    costPrice: 2.20,
    expirationDate: getRelativeDateStr(1), // Expires tomorrow
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Initial batch arrival" }],
  },
  {
    id: "prod-002",
    sku: "MT-RIBEYE-02",
    name: "Premium Beef Ribeye Steak 400g",
    category: "Meat & Seafood",
    quantity: 15,
    unit: "packs",
    unitPrice: 16.50,
    costPrice: 8.80,
    expirationDate: getRelativeDateStr(1), // Expires tomorrow
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Cold chain received" }],
  },
  {
    id: "prod-003",
    sku: "DY-GREK-03",
    name: "Premium Greek Yogurt Plain 1kg",
    category: "Dairy",
    quantity: 28,
    unit: "tubs",
    unitPrice: 6.25,
    costPrice: 3.10,
    expirationDate: getRelativeDateStr(2), // Expires in 2 days
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Pallet stock shelf-mounted" }],
  },
  {
    id: "prod-004",
    sku: "BK-CROIS-04",
    name: "Butter Croissant Pack of 4",
    category: "Bakery",
    quantity: 18,
    unit: "packs",
    unitPrice: 3.99,
    costPrice: 1.20,
    expirationDate: getRelativeDateStr(0), // Expires TODAY
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Baked fresh in-store" }],
  },
  {
    id: "prod-005",
    sku: "PRD-SPIN-05",
    name: "Organic Baby Spinach 150g Bag",
    category: "Produce",
    quantity: 25,
    unit: "bags",
    unitPrice: 3.49,
    costPrice: 1.40,
    expirationDate: getRelativeDateStr(-1), // Expired yesterday
    status: "Active", // Will be flagged as Expired by code
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Salad bar shelf-mounted" }],
  },
  {
    id: "prod-006",
    sku: "DY-WHOLE-06",
    name: "Organic Whole Milk 2L",
    category: "Dairy",
    quantity: 35,
    unit: "bottles",
    unitPrice: 4.80,
    costPrice: 2.30,
    expirationDate: getRelativeDateStr(-2), // Expired 2 days ago
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Cooler display stocked" }],
  },
  {
    id: "prod-007",
    sku: "DL-ROAST-07",
    name: "In-Store Roasted Rotisserie Chicken",
    category: "Deli",
    quantity: 12,
    unit: "items",
    unitPrice: 9.99,
    costPrice: 4.50,
    expirationDate: getRelativeDateStr(0), // Expires today
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Hot case mounted" }],
  },
  {
    id: "prod-008",
    sku: "PN-PTAS-08",
    name: "Classic Marinara Pasta Sauce Glass Jar",
    category: "Pantry",
    quantity: 80,
    unit: "jars",
    unitPrice: 3.20,
    costPrice: 1.50,
    expirationDate: getRelativeDateStr(180), // Long life
    status: "Active",
    appliedDiscount: 0,
    history: [{ timestamp: new Date().toISOString(), action: "Stocked", comment: "Ambient shelf filled" }],
  },
  {
    id: "prod-009",
    sku: "MT-SALM-09",
    name: "Fresh Atlantic Salmon Fillet 350g",
    category: "Meat & Seafood",
    quantity: 14,
    unit: "packs",
    unitPrice: 12.99,
    costPrice: 6.80,
    expirationDate: getRelativeDateStr(1), // Expires tomorrow
    status: "Discounted",
    appliedDiscount: 30, // 30% discount applied
    history: [
      { timestamp: new Date().toISOString(), action: "Stocked", comment: "Fresh counter stocked" },
      { timestamp: new Date().toISOString(), action: "Discounted", comment: "Applied 30% markdown due to expiry match" },
    ],
  },
];

const DEFAULT_WASTE_LOGS = [
  {
    id: "log-001",
    productId: "prod-005",
    sku: "PRD-SPIN-05",
    productName: "Organic Baby Spinach 150g Bag",
    category: "Produce",
    quantity: 8, // part of the batch
    unit: "bags",
    lossAmount: 11.20, // cost value or retail value lost
    potentialLossSaved: 0,
    action: "Composted", // Composted, Donated, Deli Repurposed, Discarded
    date: getRelativeDateStr(-1),
    comment: "Turned yellow/liquicty on shelf; sent to organic waste partner.",
  },
  {
    id: "log-002",
    productId: "prod-004",
    sku: "BK-CROIS-04",
    productName: "Butter Croissant Pack of 4",
    category: "Bakery",
    quantity: 6,
    unit: "packs",
    lossAmount: 7.20,
    potentialLossSaved: 16.74,
    action: "Donated",
    date: getRelativeDateStr(0),
    comment: "Donated remaining surplus batch to local soup kitchen.",
  },
];

// Read File Database helpers
function readInventory(): any[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_INVENTORY, null, 2));
      return DEFAULT_INVENTORY;
    }
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(data);
    
    // Automatically flag past-due items to expired status if active
    let modified = false;
    const nowStr = new Date().toISOString().split("T")[0];
    const updated = parsed.map((item: any) => {
      if (item.expirationDate < nowStr && item.status !== "Expired" && item.status !== "Sold" && item.status !== "Repurposed" && item.status !== "Donated" && item.status !== "Discarded") {
        item.status = "Expired";
        item.history.push({
          timestamp: new Date().toISOString(),
          action: "Expired",
          comment: "System marked expired automatically based on date."
        });
        modified = true;
      }
      return item;
    });

    if (modified) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
    }
    return updated;
  } catch (error) {
    console.error("Error reading inventory file: ", error);
    return DEFAULT_INVENTORY;
  }
}

function writeInventory(data: any[]) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing inventory file: ", error);
  }
}

function readWasteLogs(): any[] {
  try {
    if (!fs.existsSync(WASTE_LOG_FILE)) {
      fs.writeFileSync(WASTE_LOG_FILE, JSON.stringify(DEFAULT_WASTE_LOGS, null, 2));
      return DEFAULT_WASTE_LOGS;
    }
    const data = fs.readFileSync(WASTE_LOG_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading waste logs: ", error);
    return DEFAULT_WASTE_LOGS;
  }
}

function writeWasteLogs(data: any[]) {
  try {
    fs.writeFileSync(WASTE_LOG_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing waste logs: ", error);
  }
}

// REST Endpoints
app.get("/api/inventory", (req, res) => {
  const items = readInventory();
  res.json(items);
});

app.post("/api/inventory", (req, res) => {
  const items = readInventory();
  const newItem = {
    id: `prod-${Date.now()}`,
    sku: req.body.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    name: req.body.name,
    category: req.body.category || "Produce",
    quantity: Number(req.body.quantity) || 1,
    unit: req.body.unit || "items",
    unitPrice: Number(req.body.unitPrice) || 0,
    costPrice: Number(req.body.costPrice) || 0,
    expirationDate: req.body.expirationDate,
    status: req.body.status || "Active",
    appliedDiscount: Number(req.body.appliedDiscount) || 0,
    history: [{
      timestamp: new Date().toISOString(),
      action: "Stocked",
      comment: req.body.comment || "Manual merchandise entry added."
    }],
  };

  const nowStr = new Date().toISOString().split("T")[0];
  if (newItem.expirationDate < nowStr && newItem.status === "Active") {
    newItem.status = "Expired";
  }

  items.unshift(newItem);
  writeInventory(items);
  res.status(201).json(newItem);
});

app.put("/api/inventory/:id", (req, res) => {
  const items = readInventory();
  const index = items.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Preserve history
  const existing = items[index];
  const history = existing.history || [];
  
  if (req.body.actionTaken) {
    history.push({
      timestamp: new Date().toISOString(),
      action: req.body.actionTaken,
      comment: req.body.actionComment || `State updated to ${req.body.status}`
    });
  }

  const updatedItem = {
    ...existing,
    sku: req.body.sku !== undefined ? req.body.sku : existing.sku,
    name: req.body.name !== undefined ? req.body.name : existing.name,
    category: req.body.category !== undefined ? req.body.category : existing.category,
    quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity,
    unit: req.body.unit !== undefined ? req.body.unit : existing.unit,
    unitPrice: req.body.unitPrice !== undefined ? Number(req.body.unitPrice) : existing.unitPrice,
    costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : existing.costPrice,
    expirationDate: req.body.expirationDate !== undefined ? req.body.expirationDate : existing.expirationDate,
    status: req.body.status !== undefined ? req.body.status : existing.status,
    appliedDiscount: req.body.appliedDiscount !== undefined ? Number(req.body.appliedDiscount) : existing.appliedDiscount,
    history: history
  };

  items[index] = updatedItem;
  writeInventory(items);
  res.json(updatedItem);
});

app.delete("/api/inventory/:id", (req, res) => {
  const items = readInventory();
  const filtered = items.filter((item) => item.id !== req.params.id);
  writeInventory(filtered);
  res.json({ success: true });
});

// Waste Logs
app.get("/api/waste-logs", (req, res) => {
  const logs = readWasteLogs();
  res.json(logs);
});

app.post("/api/waste-logs", (req, res) => {
  const logs = readWasteLogs();
  const items = readInventory();

  const { productId, quantity, action, comment, lossAmount, potentialLossSaved } = req.body;
  const itemIndex = items.findIndex((i) => i.id === productId);

  let productName = "Unknown Product";
  let category = "Produce";
  let unit = "items";
  let sku = "";

  if (itemIndex !== -1) {
    const item = items[itemIndex];
    productName = item.name;
    category = item.category;
    unit = item.unit;
    sku = item.sku;

    // Deduct quantity or update status if fully logged
    const quantityToRemove = Number(quantity);
    if (quantityToRemove >= item.quantity) {
      item.quantity = 0;
      item.status = action === "Deli Repurposed" ? "Repurposed" : (action === "Donated" ? "Donated" : (action === "Composted" ? "Composted" : "Discarded"));
      item.history.push({
        timestamp: new Date().toISOString(),
        action: action,
        comment: `Waste action taken: ${action}. ${comment}`
      });
    } else {
      item.quantity -= quantityToRemove;
      item.history.push({
        timestamp: new Date().toISOString(),
        action: `Partial ${action}`,
        comment: `Logged ${quantityToRemove} ${unit} for ${action}. Remaining: ${item.quantity}.`
      });
    }
    writeInventory(items);
  }

  const newLog = {
    id: `log-${Date.now()}`,
    productId: productId || "custom",
    sku: sku || "N/A",
    productName,
    category,
    quantity: Number(quantity) || 1,
    unit,
    lossAmount: Number(lossAmount) || 0,
    potentialLossSaved: Number(potentialLossSaved) || 0,
    action, // "Composted", "Donated", "Deli Repurposed", "Discarded"
    date: new Date().toISOString().split("T")[0],
    comment: comment || "",
  };

  logs.unshift(newLog);
  writeWasteLogs(logs);
  res.status(201).json(newLog);
});

app.post("/api/discount/suggest", async (req, res) => {
  if (!ai) {
    return res.status(400).json({
      error: "Gemini API Client is not initialized. Please verify your GEMINI_API_KEY inside the Secrets Panel.",
      fallback: {
        suggestedDiscount: 30,
        suggestedRetailPrice: Number((req.body.unitPrice * 0.70).toFixed(2)),
        reasoning: "Democratized default discount of 30% suggested due to offline local estimation mode.",
        wasteImpactDescription: "Expected clearance rate: High. Helps save items before final waste window.",
        repurposeIdea: {
          title: "Promotional Markdown Shelf Placement",
          description: "Relocate item immediately to the Flash Discount section near checkout to maximize visual traction.",
          deliUpsellTitle: "Flash Sale Shelf"
        }
      }
    });
  }

  try {
    const { name, category, quantity, unit, unitPrice, costPrice, expirationDate } = req.body;
    
    // Calculate days to expiration
    const expiry = new Date(expirationDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const prompt = `You are a professional retail supermarket pricing optimization system analyzing surplus stock.
Analyze this item and suggest an optimized, dynamic markdown discount rate (0% to 90%) to clear the stock before expiration and minimize financial/food waste loss.

Item Profile:
- Product Name: ${name}
- Category: ${category}
- Inventory On Hand: ${quantity} ${unit}
- Original Price: $${unitPrice}
- Wholesale Cost: $${costPrice}
- Expiration Date: ${expirationDate} (${diffDays <= 0 ? "EXPIRES TODAY or already expired" : `expires in ${diffDays} days`})

Generate the optimum discount pricing decision considering:
1. Category-specific perishability (fresh produce/bakery/meat require urgent discounts, pantry can have milder discounts).
2. Cost margin buffer (retail price vs cost price). Keep some margins if possible, but prioritize clearing stock over discarding if time is critical.
3. Quantity urgency (larger stocks require deeper discounts to shift completely).
4. Creative Repurposing options in the deli/bakery kitchen to salvage the raw ingredients.

Provide your decision strictly conforming to the JSON schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional supermarket merchandiser, visual pricing analyst, and zero-waste champion.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedDiscount: {
              type: Type.INTEGER,
              description: "A recommended discount percentage between 10 and 90. Higher values for shorter days left and high volume."
            },
            suggestedRetailPrice: {
              type: Type.NUMBER,
              description: "Optimized new selling retail price matching unitPrice multiplied by (1 - discount/100)."
            },
            reasoning: {
              type: Type.STRING,
              description: "High-quality merchandising rationale for the discount based on perishability, store margin, and stock size."
            },
            wasteImpactDescription: {
              type: Type.STRING,
              description: "Ecological and inventory saving statement regarding landfill emission mitigation or waste saved in kg/units."
            },
            repurposeIdea: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Repurposing category (e.g., Deli Smoothie Prep, Stew Starter, Bakery Repack)" },
                description: { type: Type.STRING, description: "Detailed kitchen instructions for reusing this food in the supermarket's own food/deli section." },
                deliUpsellTitle: { type: Type.STRING, description: "Deli or Bakery finished product name (e.g. 'Flash Marinara Mix' or 'Sustainable Banana Muffin Pack')" }
              },
              required: ["title", "description", "deliUpsellTitle"]
            }
          },
          required: ["suggestedDiscount", "suggestedRetailPrice", "reasoning", "wasteImpactDescription", "repurposeIdea"]
        }
      }
    });

    const bodyText = response.text?.trim() || "";
    const resultObj = JSON.parse(bodyText);
    res.json(resultObj);
  } catch (error) {
    console.error("Gemini suggestion error: ", error);
    res.status(500).json({
      error: "Failed to generate recommendation via Gemini model.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Setup Vite Dev server or Serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
