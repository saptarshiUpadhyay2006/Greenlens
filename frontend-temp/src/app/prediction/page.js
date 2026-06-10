'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Zap, Car, Trees, Sun, HelpCircle, 
  RefreshCw, CheckCircle2, AlertCircle, Info, Sparkles, TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import Footer from '../components/Footer.jsx';

// Baseline calculations if FastAPI backend is offline
const VEHICLE_FACTORS = {
  'Car': 0.248,
  'Motorcycle': 0.114,
  'Scooter': 0.114,
  'E-Bike': 0.077,
  'Bicycle': 0.0,
  'Three-Wheeler': 0.150,
  'Other': 0.248
};

const getExpectedElectricityUnits = (homeType, carpetArea) => {
  const multipliers = {
    'apartment': 0.3,
    'bungalow': 0.45,
    'villa': 0.5,
    'independent-house': 0.4,
    'farmhouse': 0.48
  };
  const mult = multipliers[homeType?.toLowerCase()] || 0.35;
  return carpetArea * mult;
};

export default function PredictionPage() {
  const router = useRouter();

  // Active form tab
  const [activeTab, setActiveTab] = useState('electricity');

  // Backend connection status
  const [isApiConnected, setIsApiConnected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [electricityForm, setElectricityForm] = useState({
    homeType: 'apartment',
    carpetArea: 1000,
    unitsConsumed: 250,
    solarUsed: 0
  });

  const [travelForm, setTravelForm] = useState({
    vehicleType: 'Car',
    kmCovered: 200
  });

  const [customForm, setCustomForm] = useState({
    treesPlanted: 2,
    isNativeSpecies: true,
    solarUnitsGenerated: 100
  });

  // Results State
  const [results, setResults] = useState({
    electricity: {
      userCO2: 0,
      benchmarkCO2: 0,
      tokens: 0,
      source: 'local'
    },
    travel: {
      userCO2: 0,
      benchmarkCO2: 0,
      tokens: 0,
      source: 'local'
    },
    custom: {
      userCO2: 0,
      benchmarkCO2: 0,
      tokens: 0,
      source: 'local'
    },
    totals: {
      userCO2: 0,
      benchmarkCO2: 0,
      tokensEarned: 0
    }
  });

  // Check backend server connection on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000'}/`)
      .then(res => res.json())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  }, []);

  // Recalculate calculations whenever any inputs or the backend status changes
  useEffect(() => {
    calculateScores();
  }, [electricityForm, travelForm, customForm, isApiConnected]);

  const calculateScores = async () => {
    setIsLoading(true);

    let electResult = { userCO2: 0, benchmarkCO2: 0, tokens: 0, source: 'local' };
    let travResult = { userCO2: 0, benchmarkCO2: 0, tokens: 0, source: 'local' };
    let custResult = { userCO2: 0, benchmarkCO2: 0, tokens: 0, source: 'local' };

    // 1. Calculate Electricity
    if (isApiConnected) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000'}/calculate-electricity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeType: electricityForm.homeType.charAt(0).toUpperCase() + electricityForm.homeType.slice(1),
            carpetArea_sqft: parseFloat(electricityForm.carpetArea),
            monthly_unitsUsed_kwh: parseFloat(electricityForm.unitsConsumed),
            monthly_solarUsed_kwh: parseFloat(electricityForm.solarUsed)
          })
        });
        const data = await response.json();
        if (data.status === 'success') {
          // Estimate a benchmark from local formula since API only returns user footprint
          const expectedUnits = getExpectedElectricityUnits(electricityForm.homeType, electricityForm.carpetArea);
          electResult = {
            userCO2: data.user_co2_footprint_kg,
            benchmarkCO2: parseFloat((expectedUnits * 0.384).toFixed(2)),
            tokens: data.tokens_awarded,
            source: 'ml-api'
          };
        }
      } catch (err) {
        console.error("FastAPI Electricity request failed, using fallback:", err);
      }
    }

    // fallback electricity calculation if API failed or was skipped
    if (electResult.tokens === 0) {
      const ELECTRICITY_FACTOR_KWH = 0.384;
      const netKwh = electricityForm.unitsConsumed - electricityForm.solarUsed;
      const actualCo2 = Math.max(0, netKwh * ELECTRICITY_FACTOR_KWH);
      const expectedUnits = getExpectedElectricityUnits(electricityForm.homeType, electricityForm.carpetArea);
      const expectedCo2 = expectedUnits * ELECTRICITY_FACTOR_KWH;

      let tokens = 0;
      if (actualCo2 < expectedCo2) {
        const co2Saved = expectedCo2 - actualCo2;
        tokens = 10 + Math.floor(co2Saved * 0.1);
      }

      electResult = {
        userCO2: parseFloat(actualCo2.toFixed(2)),
        benchmarkCO2: parseFloat(expectedCo2.toFixed(2)),
        tokens: tokens,
        source: 'local-fallback'
      };
    }

    // 2. Calculate Travel
    if (isApiConnected) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000'}/calculate-travel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_type: travelForm.vehicleType,
            kmCovered: parseFloat(travelForm.kmCovered)
          })
        });
        const data = await response.json();
        if (data.status === 'success') {
          travResult = {
            userCO2: data.user_co2_footprint_kg,
            benchmarkCO2: 150, // Fixed benchmark in main.py
            tokens: data.tokens_awarded,
            source: 'ml-api'
          };
        }
      } catch (err) {
        console.error("FastAPI Travel request failed, using fallback:", err);
      }
    }

    // fallback travel calculation if API failed or was skipped
    if (travResult.tokens === 0) {
      const factor = VEHICLE_FACTORS[travelForm.vehicleType] ?? 0.248;
      const actualCo2 = travelForm.kmCovered * factor;
      const expectedCo2 = 150; // Global monthly travel benchmark

      let tokens = 0;
      if (actualCo2 < expectedCo2) {
        const co2Saved = expectedCo2 - actualCo2;
        tokens = 10 + Math.floor(co2Saved * 0.1);
      }

      travResult = {
        userCO2: parseFloat(actualCo2.toFixed(2)),
        benchmarkCO2: expectedCo2,
        tokens: tokens,
        source: 'local-fallback'
      };
    }

    // 3. Calculate Custom Habits (Trees & Solar Generation)
    // - Every tree planted absorbs 22 kg CO2 per year (approx 1.83 kg per month)
    // - Native species gets a +15 token bonus
    // - Solar units generated saves 0.384 kg CO2 per unit
    const monthlyTreeAbsorption = customForm.treesPlanted * 1.83;
    const solarSavedCO2 = customForm.solarUnitsGenerated * 0.384;
    const totalCustomCO2Saved = monthlyTreeAbsorption + solarSavedCO2;

    const baseTreeTokens = customForm.treesPlanted * 50;
    const bonusTreeTokens = customForm.isNativeSpecies ? customForm.treesPlanted * 15 : 0;
    const solarTokens = Math.floor(customForm.solarUnitsGenerated * 0.5);
    const customTokens = baseTreeTokens + bonusTreeTokens + solarTokens;

    custResult = {
      userCO2: 0, // Habits only save carbon, they don't produce it
      benchmarkCO2: parseFloat(totalCustomCO2Saved.toFixed(2)), // benchmark acts as savings here
      tokens: customTokens,
      source: 'local'
    };

    // Calculate totals
    const totalUserCO2 = parseFloat((electResult.userCO2 + travResult.userCO2).toFixed(2));
    const totalBenchmarkCO2 = parseFloat((electResult.benchmarkCO2 + travResult.benchmarkCO2 + custResult.benchmarkCO2).toFixed(2));
    const totalTokensEarned = electResult.tokens + travResult.tokens + custResult.tokens;

    setResults({
      electricity: electResult,
      travel: travResult,
      custom: custResult,
      totals: {
        userCO2: totalUserCO2,
        benchmarkCO2: totalBenchmarkCO2,
        tokensEarned: totalTokensEarned
      }
    });

    setIsLoading(false);
  };

  const retryApiConnection = () => {
    setIsApiConnected(null);
    fetch(`${process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000'}/`)
      .then(res => res.json())
      .then(() => setIsApiConnected(true))
      .catch(() => setIsApiConnected(false));
  };

  const chartData = [
    {
      name: 'Electricity',
      YourCO2: results.electricity.userCO2,
      Benchmark: results.electricity.benchmarkCO2
    },
    {
      name: 'Travel',
      YourCO2: results.travel.userCO2,
      Benchmark: results.travel.benchmarkCO2
    },
    {
      name: 'Combined Total',
      YourCO2: results.totals.userCO2,
      Benchmark: results.totals.benchmarkCO2
    }
  ];

  const totalCO2Saved = Math.max(0, results.totals.benchmarkCO2 - results.totals.userCO2);

  // Generate suggestions based on current simulations
  const getSuggestions = () => {
    const suggestions = [];
    if (electricityForm.unitsConsumed > 300) {
      suggestions.push({
        icon: <Zap className="w-5 h-5 text-yellow-500" />,
        title: "Energy Efficiency Action Required",
        desc: "Your electricity usage exceeds expected benchmark. Consider switching off idle appliances or installing smart meters to save up to 80 kWh and earn 15+ more tokens."
      });
    }
    if (travelForm.vehicleType === 'Car' && travelForm.kmCovered > 100) {
      suggestions.push({
        icon: <Car className="w-5 h-5 text-blue-500" />,
        title: "Ditch Single-Occupancy Drives",
        desc: "Switching just 50% of your car travels to an E-Bike or public transit would cut carbon by approximately 30 kg CO2, resulting in an additional 12 Green Tokens."
      });
    }
    if (electricityForm.solarUsed === 0) {
      suggestions.push({
        icon: <Sun className="w-5 h-5 text-orange-500" />,
        title: "Harness Clean Solar Energy",
        desc: "Integrating solar energy into your household mix significantly offsets your grid dependency and lowers your net CO2 to earn dynamic high-efficiency token rewards."
      });
    }
    if (customForm.treesPlanted === 0) {
      suggestions.push({
        icon: <Trees className="w-5 h-5 text-green-500" />,
        title: "Carbon Offset with Planting",
        desc: "Planting native trees is the most direct way to sink carbon. Each tree you plant rewards you 65 tokens and absorbs carbon permanently!"
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({
        icon: <Sparkles className="w-5 h-5 text-emerald-500" />,
        title: "Perfect Sustainability Score!",
        desc: "You are exceeding all benchmarks! Share your simulation parameters on the leaderboard to inspire other Green Warriors."
      });
    }
    return suggestions;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f2faf5] via-[#edf7f1] to-[#e4f2f0] py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Decorative Glow Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] bg-teal-400/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-[1250px] w-full mx-auto flex-grow relative z-10">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/home')}
            className="group flex items-center gap-2 text-sm font-bold text-emerald-950 bg-white/70 hover:bg-white border border-emerald-500/15 hover:border-emerald-500/30 px-4 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Back to Dashboard
          </button>

          {/* Connection Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 border border-emerald-500/15 text-xs font-bold shadow-sm">
            <span className={`w-2 h-2 rounded-full ${isApiConnected === null ? 'bg-amber-400 animate-pulse' : isApiConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-emerald-900/80">
              {isApiConnected === null ? 'Checking ML Engine...' : isApiConnected ? 'ML Verification Engine Online' : 'ML Verification Engine Offline (Local Fallback)'}
            </span>
            {isApiConnected === false && (
              <button 
                onClick={retryApiConnection}
                className="ml-1 text-emerald-600 hover:text-emerald-800 focus:outline-none transition-colors"
                title="Retry ML Connection"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-100/60 border border-emerald-200/50 px-4 py-1.5 rounded-full text-xs font-black text-emerald-850 mb-3 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            AI-Powered Simulation
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-emerald-950 tracking-tight leading-tight">
            Green Score & <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600">Token Earnings Predictor</span>
          </h1>
          <p className="text-sm sm:text-base text-emerald-950/70 font-semibold mt-3 max-w-2xl mx-auto">
            Simulate your energy choices and transport habits in real-time. Calculate carbon metrics and view potential tokens before signing transactions on the blockchain.
          </p>
        </div>

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          
          {/* Left Panel - Configurations (5 cols) */}
          <div className="lg:col-span-5 bg-white/60 backdrop-blur-xl border border-emerald-500/20 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_15px_50px_rgba(27,94,32,0.03)] space-y-6">
            
            {/* Form Tabs */}
            <div className="flex bg-emerald-100/40 p-1.5 rounded-2xl border border-emerald-500/10">
              <button
                onClick={() => setActiveTab('electricity')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${activeTab === 'electricity' ? 'bg-white text-emerald-950 shadow-md' : 'text-emerald-800/70 hover:text-emerald-950'}`}
              >
                <Zap className="w-4 h-4 text-yellow-500" />
                Electricity
              </button>
              <button
                onClick={() => setActiveTab('travel')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${activeTab === 'travel' ? 'bg-white text-emerald-950 shadow-md' : 'text-emerald-800/70 hover:text-emerald-950'}`}
              >
                <Car className="w-4 h-4 text-blue-500" />
                Transport
              </button>
              <button
                onClick={() => setActiveTab('habits')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer ${activeTab === 'habits' ? 'bg-white text-emerald-950 shadow-md' : 'text-emerald-800/70 hover:text-emerald-950'}`}
              >
                <Trees className="w-4 h-4 text-emerald-600" />
                Eco Habits
              </button>
            </div>

            {/* Config Fields */}
            <div className="min-h-[300px]">
              <AnimatePresence mode="wait">
                {activeTab === 'electricity' && (
                  <motion.div
                    key="electricity"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="block text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">Home Structure</label>
                      <select
                        value={electricityForm.homeType}
                        onChange={(e) => setElectricityForm({ ...electricityForm, homeType: e.target.value })}
                        className="w-full bg-white border border-emerald-500/15 rounded-2xl px-4 py-3.5 text-sm font-bold text-emerald-950 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
                      >
                        <option value="apartment">Apartment (Lower footprint baseline)</option>
                        <option value="bungalow">Bungalow</option>
                        <option value="villa">Villa (Higher footprint baseline)</option>
                        <option value="independent-house">Independent House</option>
                        <option value="farmhouse">Farmhouse</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Carpet Area</span>
                        <span className="text-emerald-600">{electricityForm.carpetArea} sq ft</span>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="5000"
                        step="50"
                        value={electricityForm.carpetArea}
                        onChange={(e) => setElectricityForm({ ...electricityForm, carpetArea: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Monthly Units Consumed</span>
                        <span className="text-emerald-600">{electricityForm.unitsConsumed} kWh</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="1500"
                        step="10"
                        value={electricityForm.unitsConsumed}
                        onChange={(e) => setElectricityForm({ ...electricityForm, unitsConsumed: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Off-Grid Solar Portion</span>
                        <span className="text-emerald-600">{electricityForm.solarUsed} kWh</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={electricityForm.unitsConsumed}
                        step="10"
                        value={electricityForm.solarUsed}
                        onChange={(e) => setElectricityForm({ ...electricityForm, solarUsed: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                      <p className="text-[10px] font-semibold text-emerald-900/60 mt-1">Solar power offsets direct power grid footprint.</p>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'travel' && (
                  <motion.div
                    key="travel"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div>
                      <label className="block text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">Primary Mode of Commute</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {Object.keys(VEHICLE_FACTORS).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setTravelForm({ ...travelForm, vehicleType: type })}
                            className={`py-3 px-3 rounded-2xl border text-xs font-bold transition-all duration-300 cursor-pointer flex items-center gap-2 ${travelForm.vehicleType === type ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-emerald-950 hover:bg-emerald-50/50 border-emerald-500/15'}`}
                          >
                            <span className="text-base">
                              {type === 'Car' && '🚗'}
                              {type === 'Motorcycle' && '🏍️'}
                              {type === 'Scooter' && '🛵'}
                              {type === 'E-Bike' && '⚡🚲'}
                              {type === 'Bicycle' && '🚲'}
                              {type === 'Three-Wheeler' && '🛺'}
                              {type === 'Other' && '🚌'}
                            </span>
                            <span>{type}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Distance Covered</span>
                        <span className="text-emerald-600">{travelForm.kmCovered} km / month</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3000"
                        step="50"
                        value={travelForm.kmCovered}
                        onChange={(e) => setTravelForm({ ...travelForm, kmCovered: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-emerald-900/60 font-semibold mt-1">
                        <span>CO2 emissions per km:</span>
                        <span>{VEHICLE_FACTORS[travelForm.vehicleType]} kg</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'habits' && (
                  <motion.div
                    key="habits"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Trees Planted This Month</span>
                        <span className="text-emerald-600">{customForm.treesPlanted} Trees</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        value={customForm.treesPlanted}
                        onChange={(e) => setCustomForm({ ...customForm, treesPlanted: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-500/10 rounded-2xl">
                      <div>
                        <span className="block text-xs font-bold text-emerald-950">Native Bio-species Bonus</span>
                        <span className="text-[10px] text-emerald-900/60 font-medium">Earn +15 bonus tokens per tree for local ecosystems</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={customForm.isNativeSpecies}
                        onChange={(e) => setCustomForm({ ...customForm, isNativeSpecies: e.target.checked })}
                        className="w-5 h-5 accent-emerald-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-black uppercase text-emerald-950 tracking-wider mb-2">
                        <span>Clean Solar Generation</span>
                        <span className="text-emerald-600">{customForm.solarUnitsGenerated} kWh / month</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="25"
                        value={customForm.solarUnitsGenerated}
                        onChange={(e) => setCustomForm({ ...customForm, solarUnitsGenerated: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-emerald-100 rounded-lg cursor-pointer"
                      />
                      <p className="text-[10px] font-semibold text-emerald-900/60 mt-1">Saves fossil fuels and provides 0.5 tokens per kWh.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Quick Action Info Banner */}
            <div className="p-4 bg-emerald-50/80 border border-emerald-500/10 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5 shadow-inner">
              <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">
                <strong>Simulated rewards</strong> are calculated using modular carbon mathematical formulas identical to contract code. Actual rewards are minted on-chain when files are verified.
              </div>
            </div>

          </div>

          {/* Right Panel - Outputs (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Scoreboard Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              
              {/* Predicted Token Rewards */}
              <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white rounded-[2rem] p-6 shadow-xl border border-emerald-900/10 flex flex-col justify-between group overflow-hidden relative min-h-[150px]">
                <div className="absolute top-[-20px] right-[-20px] w-20 h-20 bg-emerald-500/15 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all duration-300" />
                <div className="flex justify-between items-center z-10">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300/80">Est. Green Tokens</span>
                  <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div className="z-10 mt-4">
                  <span className="text-4xl sm:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-teal-200 tracking-tight">
                    +{results.totals.tokensEarned}
                  </span>
                  <span className="block text-[10px] text-emerald-300/60 font-bold mt-1 uppercase tracking-widest">Sepolia Tokens</span>
                </div>
              </div>

              {/* Carbon Footprint */}
              <div className="bg-white/70 backdrop-blur-xl border border-emerald-500/15 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[150px] transition-all duration-300 hover:shadow-md">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-950/70">Simulated Footprint</span>
                  <TrendingDown className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-950 tracking-tight">
                    {results.totals.userCO2} <span className="text-xs font-bold text-emerald-900/50">kg CO2</span>
                  </span>
                  <span className="block text-[10px] text-emerald-900/60 font-bold mt-1 uppercase tracking-wider">Your Monthly Total</span>
                </div>
              </div>

              {/* expected Benchmark comparison */}
              <div className="bg-white/70 backdrop-blur-xl border border-emerald-500/15 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[150px] transition-all duration-300 hover:shadow-md">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-950/70">Expected Baseline</span>
                  <HelpCircle className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl font-black text-emerald-950/80 tracking-tight">
                    {results.totals.benchmarkCO2} <span className="text-xs font-bold text-emerald-900/50">kg CO2</span>
                  </span>
                  <span className="block text-[10px] text-emerald-900/60 font-bold mt-1 uppercase tracking-wider">
                    {totalCO2Saved > 0 ? (
                      <span className="text-emerald-600 font-extrabold">-{totalCO2Saved.toFixed(1)} kg Saved! 🌱</span>
                    ) : (
                      <span className="text-red-500 font-extrabold">Exceeding Benchmark</span>
                    )}
                  </span>
                </div>
              </div>

            </div>

            {/* Visual Recharts Footprint Comparison Chart */}
            <div className="bg-white/70 backdrop-blur-xl border border-emerald-500/15 p-6 rounded-[2.5rem] shadow-sm">
              <h3 className="text-base font-extrabold text-emerald-950 mb-5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                CO2 Emissions vs. Expected Benchmarks (kg CO2)
              </h3>
              
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#0f172a', fontSize: 11, fontWeight: 'bold' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }} />
                    <Bar dataKey="YourCO2" name="Your Simulated Footprint" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-your-${index}`} fill={entry.YourCO2 > entry.Benchmark ? '#ef4444' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="Benchmark" name="Expected Benchmark" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-center gap-6 mt-4 text-xs font-semibold text-emerald-950 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>Within Benchmark Footprint</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full" />
                  <span>Exceeds Benchmark Footprint</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span>Expected Benchmark Baseline</span>
                </div>
              </div>

            </div>

            {/* Smart AI Suggestions */}
            <div className="bg-white/70 backdrop-blur-xl border border-emerald-500/15 p-6 rounded-[2.5rem] shadow-sm">
              <h3 className="text-base font-extrabold text-emerald-950 mb-5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Optimizations to Maximize Token Earnings
              </h3>

              <div className="space-y-4">
                {getSuggestions().map((suggestion, index) => (
                  <div key={index} className="flex gap-4 p-4 bg-emerald-50/20 border border-emerald-500/5 hover:border-emerald-500/15 rounded-2xl transition-all duration-300">
                    <div className="w-10 h-10 bg-white border border-emerald-500/10 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                      {suggestion.icon}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-emerald-950 text-sm">{suggestion.title}</h4>
                      <p className="text-xs font-semibold text-emerald-900/60 leading-relaxed mt-1">{suggestion.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
