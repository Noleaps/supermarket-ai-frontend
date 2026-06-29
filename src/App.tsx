/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  DollarSign, 
  Search, 
  Sparkles, 
  RefreshCw, 
  FileText, 
  X, 
  Info,
  Clock,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check
} from 'lucide-react';

interface RealAIPrediction {
  risiko: string;
  diskon_rekomendasi: string;
  prediksi_demand: string;
  catatan: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
  price: number;
  expiryDate: string; // YYYY-MM-DD
  prediction?: RealAIPrediction;
}

interface AIReport {
  generalAssessment: string;
  topHighRiskItems: string[];
  totalEstimatedSavingsIDR: number;
  operationalRecommendations: string[];
}

const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Daging Sapi Premium 500g', stock: 24, price: 85000, expiryDate: '2026-07-05' },
  { id: '2', name: 'Susu Pasteurisasi 1L', stock: 156, price: 22500, expiryDate: '2026-06-30' },
  { id: '3', name: 'Bayam Organik Pack', stock: 45, price: 12000, expiryDate: '2026-07-02' },
  { id: '4', name: 'Telur Ayam Kampung 10s', stock: 80, price: 32000, expiryDate: '2026-07-12' },
  { id: '5', name: 'Roti Tawar Gandum', stock: 15, price: 18000, expiryDate: '2026-06-28' }, // Expired yesterday
  { id: '6', name: 'Keju Cheddar Block 200g', stock: 35, price: 28000, expiryDate: '2026-07-20' },
  { id: '7', name: 'Yogurt Plain 500ml', stock: 18, price: 35000, expiryDate: '2026-07-01' }
];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'reports'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductStock, setNewProductStock] = useState<number | ''>('');
  const [newProductPrice, setNewProductPrice] = useState<number | ''>('');
  const [newProductExpiry, setNewProductExpiry] = useState('');

  // Selected Product for AI prediction
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [copiedTagline, setCopiedTagline] = useState(false);

  // Global Report State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [globalReport, setGlobalReport] = useState<AIReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load products from localStorage or use defaults
  useEffect(() => {
    const saved = localStorage.getItem('food_waste_inventory');
    if (saved) {
      try {
        setProducts(JSON.parse(saved));
      } catch (e) {
        setProducts(INITIAL_PRODUCTS);
      }
    } else {
      setProducts(INITIAL_PRODUCTS);
    }
  }, []);

  // Save products to localStorage on update
  const saveProducts = (updatedProducts: Product[]) => {
    setProducts(updatedProducts);
    localStorage.setItem('food_waste_inventory', JSON.stringify(updatedProducts));
  };

  // Date helper
  const getDaysLeft = (expiryDateStr: string) => {
    const current = new Date('2026-06-29'); // Mock current date from system metadata
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry.getTime() - current.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Formatter helper
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  // Add product handler
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductStock || !newProductPrice || !newProductExpiry) {
      alert('Please fill out all fields.');
      return;
    }

    const newProduct: Product = {
      id: Date.now().toString(),
      name: newProductName,
      stock: Number(newProductStock),
      price: Number(newProductPrice),
      expiryDate: newProductExpiry,
    };

    const updated = [newProduct, ...products];
    saveProducts(updated);
    
    // Reset form
    setNewProductName('');
    setNewProductStock('');
    setNewProductPrice('');
    setNewProductExpiry('');
    setIsAddModalOpen(false);
  };

  // Delete product handler
  const handleDeleteProduct = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this product from inventory?')) {
      const updated = products.filter(p => p.id !== id);
      saveProducts(updated);
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
      }
    }
  };

  // Quick edit stock
  const handleUpdateStock = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = products.map(p => {
      if (p.id === id) {
        const newStock = Math.max(0, p.stock + delta);
        // Sync selected product if updated
        if (selectedProduct?.id === id) {
          setSelectedProduct({ ...p, stock: newStock });
        }
        return { ...p, stock: newStock };
      }
      return p;
    });
    saveProducts(updated);
  };

  // Select product for prediction
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setPredictError(null);
  };

  // Run AI prediction call
  const handleRunPrediction = async () => {
    if (!selectedProduct) return;

    setIsLoading(true);
    setPredictError(null);

    // Hitung sisa_hari_expired dengan cara: (Tanggal Expired Produk - Tanggal Hari Ini)
    const expiryDate = new Date(selectedProduct.expiryDate);
    const today = new Date();
    // Clear hours to represent accurate day countdown
    expiryDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const sisa_hari_expired = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Data payload: { "nama": string, "harga_idr": number, "stok": number, "sisa_hari_expired": number }
    const payload = {
      nama: selectedProduct.name,
      harga_idr: selectedProduct.price,
      stok: selectedProduct.stock,
      sisa_hari_expired: sisa_hari_expired
    };

    try {
      const res = await fetch('https://food-waste-ai-625899891226.asia-southeast1.run.app/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Gagal menghubungi API Backend AI (' + res.status + ')');
      }

      const data: RealAIPrediction = await res.json();
      
      // Update predictions in the product list to show inside product card/row
      const updatedProducts = products.map(p => {
        if (p.id === selectedProduct.id) {
          return { ...p, prediction: data };
        }
        return p;
      });
      saveProducts(updatedProducts);

      // Sync selected product to display prediction results
      setSelectedProduct({
        ...selectedProduct,
        prediction: data
      });
    } catch (err: any) {
      console.error(err);
      setPredictError(err.message || 'Gagal menghubungi server backend AI.');
    } finally {
      setIsLoading(false);
    }
  };

  // Run global reports call
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    setGlobalReport(null);

    const productsPayload = products.map(p => ({
      ...p,
      daysLeft: getDaysLeft(p.expiryDate)
    }));

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsPayload }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Report generation failed');
      }

      const data = await res.json();
      setGlobalReport(data);
    } catch (err: any) {
      console.error(err);
      setReportError(err.message || 'Unable to generate store analysis report.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Copy tagline helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTagline(true);
    setTimeout(() => setCopiedTagline(false), 2000);
  };

  // Calculations for KPI cards
  const totalSKU = products.length;
  
  // Calculate average waste risk
  // Expired -> 100%, Expiring today/tomorrow -> 85%, Expiring in 3 days -> 60%, Expiring in 7 days -> 30%, rest -> 5%
  const calculateAverageWasteRisk = () => {
    if (products.length === 0) return '0%';
    const totalRisk = products.reduce((acc, p) => {
      const days = getDaysLeft(p.expiryDate);
      if (days < 0) return acc + 100;
      if (days <= 1) return acc + 85;
      if (days <= 3) return acc + 60;
      if (days <= 7) return acc + 30;
      return acc + 5;
    }, 0);
    return (totalRisk / products.length).toFixed(1) + '%';
  };

  // Estimated Savings potential (expired or high risk products value that could have been saved)
  const calculateSavingsPotential = () => {
    const potential = products.reduce((acc, p) => {
      const days = getDaysLeft(p.expiryDate);
      // If expired or expiring in less than 3 days, there is a risk, we estimate savings by dynamic discounting
      if (days <= 3) {
        return acc + (p.stock * p.price * 0.4); // Estimating 40% value recovered via AI recommended sales
      }
      return acc;
    }, 0);
    return formatIDR(potential);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="app-container" className="flex h-screen w-full bg-[#f8fafc] font-sans overflow-hidden text-slate-800">
      
      {/* Sidebar Navigation */}
      <aside id="sidebar" className="w-64 bg-[#0f172a] flex flex-col text-white shadow-2xl z-10">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-slate-900 shadow-md">
              F
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              FoodWaste<span className="text-emerald-400">AI</span>
            </h1>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-4 space-y-2">
          <button 
            id="nav-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 font-medium transition-all text-left ${
              activeTab === 'dashboard' 
                ? 'bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-500' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>

          <button 
            id="nav-inventory"
            onClick={() => setActiveTab('inventory')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 font-medium transition-all text-left ${
              activeTab === 'inventory' 
                ? 'bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-500' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Search className="w-5 h-5" />
            Inventory List
          </button>

          <button 
            id="nav-reports"
            onClick={() => setActiveTab('reports')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 font-medium transition-all text-left ${
              activeTab === 'reports' 
                ? 'bg-emerald-500/15 text-emerald-400 border-l-4 border-emerald-500' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-5 h-5" />
            AI Store Reports
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 flex flex-col gap-1 bg-slate-950/30">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>AI Core: <span className="text-emerald-400 font-mono">v1.4.2-live</span></span>
          </div>
          <div>Current Date: <span className="text-slate-400">June 29, 2026</span></div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header Bar */}
        <header id="app-header" className="h-16 bg-white border-b px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span>FoodWasteAI</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 capitalize">{activeTab === 'inventory' ? 'Inventory Management' : activeTab}</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Predictor Status</p>
              <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> READY
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Store Manager Avatar" className="w-full h-full" />
            </div>
          </div>
        </header>

        {/* Main Fluid Viewport */}
        <div className="p-8 flex-1 flex flex-col gap-6 overflow-auto">
          
          {/* Top Dynamic Stats section */}
          <section id="stats-section" className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total SKU Items</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{totalSKU}</h3>
                <p className="text-xs text-emerald-600 font-medium">Active products tracked</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 rounded-lg">
                <Search className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Waste Risk</p>
                <h3 className="text-3xl font-extrabold text-orange-500">{calculateAverageWasteRisk()}</h3>
                <p className="text-xs text-slate-400 font-medium">Based on exp. countdown</p>
              </div>
              <div className="p-3 bg-orange-50 text-orange-500 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/50 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Potential Recoverable Value</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{calculateSavingsPotential()}</h3>
                <p className="text-xs text-emerald-600 font-semibold">AI marketing recovery potential</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div id="tab-dashboard-content" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Expiring Alert Panel */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    Immediate Expiry Warnings
                  </h2>
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-xs font-semibold">
                    {products.filter(p => getDaysLeft(p.expiryDate) <= 3).length} Items at Risk
                  </span>
                </div>
                
                <div className="p-4 flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[360px]">
                  {products.filter(p => getDaysLeft(p.expiryDate) <= 3).length === 0 ? (
                    <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                      <p className="font-medium text-slate-700">All set! No items expiring within 3 days.</p>
                      <p className="text-xs">Any new expiring items added will show warnings here.</p>
                    </div>
                  ) : (
                    products
                      .filter(p => getDaysLeft(p.expiryDate) <= 3)
                      .sort((a, b) => getDaysLeft(a.expiryDate) - getDaysLeft(b.expiryDate))
                      .map(product => {
                        const days = getDaysLeft(product.expiryDate);
                        const isExpired = days < 0;
                        return (
                          <div key={product.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 text-sm">{product.name}</span>
                              <span className="text-xs text-slate-400">Stock: {product.stock} units • Unit Price: {formatIDR(product.price)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {isExpired ? (
                                <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                                  Expired ({Math.abs(days)}d ago)
                                </span>
                              ) : days === 0 ? (
                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                                  Expires Today
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                                  {days} day{days > 1 ? 's' : ''} left
                                </span>
                              )}
                              
                              <button 
                                onClick={() => {
                                  setActiveTab('inventory');
                                  handleSelectProduct(product);
                                }}
                                className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                              >
                                Analyze <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Quick AI Welcome Box */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">Welcome to FoodWasteAI</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    This platform uses advanced AI models to analyze your food stock shelf life vs historical retail velocities. 
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Run predictive evaluations to get dynamic discount plans, bundling tags, and targeted taglines that minimize store spoilage costs.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className="w-full py-2 bg-slate-900 text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    View & Manage Inventory
                  </button>
                  <button 
                    onClick={() => setActiveTab('reports')}
                    className="w-full py-2 bg-emerald-50 text-emerald-700 font-semibold text-sm rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                  >
                    Generate Store Audit Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY LIST & AI PANEL */}
          {activeTab === 'inventory' && (
            <div id="tab-inventory-content" className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
              
              {/* Product Inventory Table (Left 2/3) */}
              <div className="flex-[2] bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                
                {/* Table Header Controls */}
                <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row gap-3 justify-between items-center">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search product inventory..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </div>

                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Product
                  </button>
                </div>

                {/* Table Layout */}
                <div className="overflow-auto flex-1">
                  {filteredProducts.length === 0 ? (
                    <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
                      <Info className="w-10 h-10 text-slate-300" />
                      <p className="font-semibold text-slate-700">No items found</p>
                      <p className="text-xs">Try adjusting your search query or add a new product.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                        <tr className="text-slate-500">
                          <th className="p-4 font-semibold">Product Name</th>
                          <th className="p-4 font-semibold">Stock Level</th>
                          <th className="p-4 font-semibold">Price (IDR)</th>
                          <th className="p-4 font-semibold">Exp. Date</th>
                          <th className="p-4 font-semibold text-center">Prediction Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((product) => {
                          const days = getDaysLeft(product.expiryDate);
                          const isExpired = days < 0;
                          const isExpiringUrgent = days >= 0 && days <= 3;
                          
                          let bgClass = 'hover:bg-slate-50/50';
                          if (isExpired) bgClass = 'bg-red-50/30 hover:bg-red-50/50';
                          else if (isExpiringUrgent) bgClass = 'bg-orange-50/30 hover:bg-orange-50/50';

                          const isSelected = selectedProduct?.id === product.id;

                          return (
                            <tr 
                              key={product.id} 
                              onClick={() => handleSelectProduct(product)}
                              className={`cursor-pointer transition-colors ${bgClass} ${
                                isSelected ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/10' : ''
                              }`}
                            >
                              <td className="p-4">
                                <div className="font-semibold text-slate-900">{product.name}</div>
                                {product.prediction ? (
                                  <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      product.prediction.risiko === 'Tinggi' || product.prediction.risiko === 'High' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                                      product.prediction.risiko === 'Sedang' || product.prediction.risiko === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                                      'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    }`}>
                                      Risiko: {product.prediction.risiko}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[10px] font-bold">
                                      Diskon: {product.prediction.diskon_rekomendasi}
                                    </span>
                                  </div>
                                ) : isSelected ? (
                                  <span className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase">Currently Selected</span>
                                ) : null}
                              </td>
                              
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={(e) => handleUpdateStock(product.id, -1, e)}
                                    className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-medium text-slate-800 min-w-[24px] text-center">
                                    {product.stock}
                                  </span>
                                  <button 
                                    onClick={(e) => handleUpdateStock(product.id, 1, e)}
                                    className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold text-xs"
                                  >
                                    +
                                  </button>
                                  <span className="text-xs text-slate-400">units</span>
                                </div>
                              </td>

                              <td className="p-4 text-slate-600 font-mono">
                                {product.price.toLocaleString('id-ID')}
                              </td>

                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-700">{product.expiryDate}</span>
                                  {isExpired ? (
                                    <span className="text-xs text-red-600 font-bold">Expired ({Math.abs(days)}d ago)</span>
                                  ) : isExpiringUrgent ? (
                                    <span className="text-xs text-orange-600 font-bold">{days === 0 ? 'Expires today!' : `${days} days left!`}</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">{days} days left</span>
                                  )}
                                </div>
                              </td>

                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectProduct(product);
                                    }}
                                    className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-all"
                                  >
                                    Select
                                  </button>
                                  <button 
                                    onClick={(e) => handleDeleteProduct(product.id, e)}
                                    className="p-1 text-slate-300 hover:text-red-500 rounded transition-all"
                                    title="Delete product"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Dynamic AI Prediction Panel (Right 1/3) */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[600px] overflow-hidden">
                
                {/* Header title */}
                <div className="p-4 border-b bg-emerald-600 text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  <h2 className="font-bold text-sm tracking-wide uppercase">AI prediction Engine</h2>
                </div>

                {/* Body depending on state */}
                {!selectedProduct ? (
                  <div className="p-6 flex flex-col items-center justify-center flex-1 text-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-slate-700 text-base">Select a product</h4>
                    <p className="text-slate-400 text-xs px-6 leading-relaxed">
                      Select a product from the inventory grid on the left to activate waste risk analysis and optimization recommendations.
                    </p>
                    <div className="w-full space-y-2 text-left pt-2 border-t border-dashed border-slate-100">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>Algorithm</span>
                        <span>sisa_hari_expired vs sales_velocity</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>LLM Node</span>
                        <span className="text-emerald-600">/predict</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Selected product overview */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Target Product</span>
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{selectedProduct.name}</h4>
                      <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                        <span>Stock: {selectedProduct.stock} units</span>
                        <span>Days Left: <strong className={getDaysLeft(selectedProduct.expiryDate) <= 3 ? 'text-rose-500' : 'text-slate-700'}>{getDaysLeft(selectedProduct.expiryDate)}d</strong></span>
                      </div>
                    </div>

                    {/* Result Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      {isLoading ? (
                        <div className="space-y-4 animate-pulse">
                          {/* Shimmer for Risk Card */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                            <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                            <div className="flex justify-between items-center">
                              <div className="h-5 bg-slate-200 rounded w-2/5 animate-pulse"></div>
                              <div className="h-5 bg-slate-200 rounded w-1/4 animate-pulse"></div>
                            </div>
                          </div>
                          {/* Shimmer for Demand Card */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                            <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                            <div className="h-3 bg-slate-200 rounded w-full animate-pulse"></div>
                          </div>
                          {/* Shimmer for Notes Card */}
                          <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2">
                            <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                            <div className="h-3 bg-slate-200 rounded w-5/6 animate-pulse"></div>
                          </div>
                        </div>
                      ) : predictError ? (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-xs flex flex-col gap-2">
                          <p className="font-bold">Gagal Menganalisis</p>
                          <p>{predictError}</p>
                          <button 
                            onClick={handleRunPrediction}
                            className="mt-2 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors"
                          >
                            Coba Lagi
                          </button>
                        </div>
                      ) : selectedProduct.prediction ? (
                        <div className="space-y-4">
                          
                          {/* Risk and Discount Card */}
                          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tingkat Risiko</p>
                                <span className={`text-sm font-extrabold flex items-center gap-1.5 mt-1 ${
                                  selectedProduct.prediction.risiko === 'Tinggi' || selectedProduct.prediction.risiko === 'High' ? 'text-rose-600' :
                                  selectedProduct.prediction.risiko === 'Sedang' || selectedProduct.prediction.risiko === 'Medium' ? 'text-amber-500' :
                                  'text-emerald-600'
                                }`}>
                                  <AlertTriangle className="w-4 h-4 shrink-0" />
                                  {selectedProduct.prediction.risiko}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Diskon Rekomendasi</p>
                                <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-lg mt-1 border border-emerald-200">
                                  {selectedProduct.prediction.diskon_rekomendasi}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Demand Prediction Card */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Prediksi Demand
                            </p>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">
                              {selectedProduct.prediction.prediksi_demand}
                            </p>
                          </div>

                          {/* Notes/Catatan Card */}
                          <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl space-y-1">
                            <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" /> Catatan Rekomendasi
                            </p>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              {selectedProduct.prediction.catatan}
                            </p>
                          </div>

                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                          <Sparkles className="w-8 h-8 text-emerald-500/50" />
                          <p className="text-xs px-6 leading-relaxed">
                            Klik "Mulai Analisis AI" untuk menghubungi Backend AI guna menghitung tingkat risiko, diskon, dan prediksi permintaan.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-4 border-t bg-slate-50">
                      <button 
                        onClick={handleRunPrediction}
                        disabled={isLoading}
                        className={`w-full py-2 font-bold text-sm rounded-lg transition-all shadow-sm ${
                          isLoading 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                        }`}
                      >
                        {isLoading ? 'Menganalisis...' : 'Mulai Analisis AI'}
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: AI STORE REPORTS */}
          {activeTab === 'reports' && (
            <div id="tab-reports-content" className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-6 space-y-6">
              
              {/* Report Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    AI Inventory Audit & Spoilage Forecast
                  </h2>
                  <p className="text-xs text-slate-400">
                    Analyze store-wide inventory parameters using AI and discover optimization strategies.
                  </p>
                </div>
                
                <button 
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  {isGeneratingReport ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Store Audit
                    </>
                  )}
                </button>
              </div>

              {/* Report Body */}
              {isGeneratingReport ? (
                <div className="py-24 text-center flex flex-col items-center gap-4">
                  <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800">Processing Full Store Inventory...</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      AI Engine is compiling expiry dates, product quantities, pricing values, and determining bulk store-wide recommendations.
                    </p>
                  </div>
                </div>
              ) : reportError ? (
                <div className="p-6 bg-red-50 text-red-700 rounded-lg flex flex-col gap-3 max-w-lg mx-auto">
                  <h4 className="font-bold">Unable to Generate Report</h4>
                  <p className="text-xs">{reportError}</p>
                  <button 
                    onClick={handleGenerateReport}
                    className="py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all text-xs"
                  >
                    Try Again
                  </button>
                </div>
              ) : globalReport ? (
                <div className="space-y-6">
                  
                  {/* General Overview and metrics cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1 md:col-span-2">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">General Store Assessment</h4>
                      <p className="text-sm text-slate-700 leading-relaxed font-medium">{globalReport.generalAssessment}</p>
                    </div>

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 flex flex-col justify-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calculated Savings Potential</p>
                      <h3 className="text-2xl font-black text-slate-900">{formatIDR(globalReport.totalEstimatedSavingsIDR)}</h3>
                      <p className="text-xs text-slate-500">Value restorable by active strategies</p>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* High Risk Items identified by AI */}
                    <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        Immediate Action Needed For:
                      </h4>
                      <ul className="space-y-2">
                        {globalReport.topHighRiskItems.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-2 p-2 bg-rose-50/50 rounded-lg border border-rose-100/30 text-slate-700 text-sm font-medium">
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Operational Recommendations */}
                    <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        AI Store-Wide Operational Rules:
                      </h4>
                      <ul className="space-y-2">
                        {globalReport.operationalRecommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-slate-600 text-xs leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">{idx + 1}</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800">No Store Audit Generated Yet</h4>
                  <p className="text-slate-400 text-xs max-w-sm">
                    Click the "Generate Store Audit" button at the top right to analyze your current catalog for spoilage threats and operational plans.
                  </p>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* MODAL: ADD PRODUCT FORM */}
      {isAddModalOpen && (
        <div id="add-modal" className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 w-full max-w-md mx-4 overflow-hidden">
            
            {/* Header bar */}
            <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                Add New Inventory Item
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Product Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Apel Fuji Premium Box"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock (units)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50"
                    value={newProductStock}
                    onChange={e => setNewProductStock(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono"
                    min="1"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price (IDR)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 15000"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono"
                    min="100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiration Date</label>
                <input 
                  type="date" 
                  value={newProductExpiry}
                  onChange={e => setNewProductExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400">Current system relative date is June 29, 2026</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md"
                >
                  Add to Catalog
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
