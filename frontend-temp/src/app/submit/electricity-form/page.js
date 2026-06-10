'use client';
import { motion } from 'framer-motion';
import { Zap, Upload, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Footer from '../../components/Footer.jsx';


export default function ElectricityForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    unitsConsumed: '',
    homeType: '',
    carpetArea: '',
    billFile: null
  });
  const [submitted, setSubmitted] = useState(false);

  const scanBill = async (file) => {
    if (!file) return;
    setIsScanning(true);
    try {
      const data = new FormData();
      data.append('file', file);
      
      const response = await fetch('http://localhost:8000/parse-bill', {
        method: 'POST',
        body: data,
      });
      const res = await response.json();
      if (res.status === 'success') {
        setFormData(prev => ({
          ...prev,
          customerId: res.customer_id || prev.customerId,
          unitsConsumed: res.units_consumed ? res.units_consumed.toString() : prev.unitsConsumed,
          carpetArea: res.carpet_area ? res.carpet_area.toString() : prev.carpetArea,
          homeType: res.home_type || prev.homeType
        }));
        alert(`⚡ Bill Analysed successfully!\n• Customer ID: ${res.customer_id}\n• Units: ${res.units_consumed} kWh\n• Area: ${res.carpet_area} sq ft\n• Type: ${res.home_type}`);
      } else {
        alert("⚠️ Failed to parse bill details.");
      }
    } catch (err) {
      console.error("Error scanning bill:", err);
      alert("⚠️ Error connecting to AI OCR Engine.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, billFile: file }));
      await scanBill(file);
    }
  };


  const calculateTokens = async () => {
    try {
      const response = await fetch('http://localhost:8000/calculate-electricity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeType: formData.homeType.charAt(0).toUpperCase() + formData.homeType.slice(1),
          carpetArea_sqft: parseFloat(formData.carpetArea),
          monthly_unitsUsed_kwh: parseFloat(formData.unitsConsumed),
          monthly_solarUsed_kwh: 0.0
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        const multipliers = {
          'apartment': 0.3,
          'bungalow': 0.45,
          'villa': 0.5,
          'independent-house': 0.4,
          'farmhouse': 0.48
        };
        const mult = multipliers[formData.homeType.toLowerCase()] || 0.35;
        const expectedUnits = parseFloat(formData.carpetArea) * mult;
        const expectedCo2 = expectedUnits * 0.384;
        const co2Saved = Math.max(0, expectedCo2 - data.user_co2_footprint_kg);

        return {
          tokensEarned: data.tokens_awarded,
          userCo2: data.user_co2_footprint_kg,
          co2Saved: parseFloat(co2Saved.toFixed(2))
        };
      }
    } catch (err) {
      console.warn("ML Engine offline or error, falling back to local math calculation:", err);
    }

    // Fallback formula matching prediction page:
    const ELECTRICITY_FACTOR_KWH = 0.384;
    const actualCo2 = parseFloat(formData.unitsConsumed) * ELECTRICITY_FACTOR_KWH;
    
    const multipliers = {
      'apartment': 0.3,
      'bungalow': 0.45,
      'villa': 0.5,
      'independent-house': 0.4,
      'farmhouse': 0.48
    };
    const mult = multipliers[formData.homeType.toLowerCase()] || 0.35;
    const expectedUnits = parseFloat(formData.carpetArea) * mult;
    const expectedCo2 = expectedUnits * ELECTRICITY_FACTOR_KWH;
    const co2Saved = Math.max(0, expectedCo2 - actualCo2);

    let tokens = 10; // base reward
    if (actualCo2 < expectedCo2) {
      tokens += Math.floor(co2Saved * 0.1);
    }

    return {
      tokensEarned: tokens,
      userCo2: parseFloat(actualCo2.toFixed(2)),
      co2Saved: parseFloat(co2Saved.toFixed(2))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.customerId || !formData.unitsConsumed || !formData.homeType || 
        !formData.carpetArea) {
      alert("⚠️ Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    console.log('Electricity Bill Submitted:', formData);
    
    // Calculate simulated/ML tokens
    const { tokensEarned, userCo2, co2Saved } = await calculateTokens();
    
    // Sync with Express backend
    try {
      const token = await getToken();
      if (token) {
        await fetch('http://localhost:8080/api/v1/form/electricity', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            unitsUsed: parseFloat(formData.unitsConsumed),
            solarUsed: 0.0,
            month: new Date().toLocaleString('default', { month: 'short' }),
            homeType: formData.homeType,
            carpetArea: parseFloat(formData.carpetArea)
          })
        });
      }
    } catch (err) {
      console.warn("Backend server offline, falling back to localStorage sync:", err);
    }

    // Update simulated values in localStorage
    if (typeof window !== 'undefined') {
      const currentSimulated = parseFloat(localStorage.getItem('simulatedTokens') || '0');
      localStorage.setItem('simulatedTokens', (currentSimulated + tokensEarned).toString());

      const currentCategory = parseFloat(localStorage.getItem('simulatedTokens_Electricity') || '0');
      localStorage.setItem('simulatedTokens_Electricity', (currentCategory + tokensEarned).toString());

      const currentCo2 = parseFloat(localStorage.getItem('simulatedCo2Saved') || '0');
      localStorage.setItem('simulatedCo2Saved', (currentCo2 + co2Saved).toString());

      const currentSubmissions = parseInt(localStorage.getItem('simulatedSubmissions') || '0');
      localStorage.setItem('simulatedSubmissions', (currentSubmissions + 1).toString());
    }

    alert(`✅ Data submitted successfully!\n🌿 Carbon Footprint: ${userCo2} kg CO2\n🌿 Carbon Saved: ${co2Saved} kg CO2\n🪙 Green Tokens Earned: ${tokensEarned}`);
    
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setIsSubmitting(false);
      router.push('/home');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-amber-200 py-12 px-4 flex flex-col justify-between">
      <div className="flex-grow mb-12">
        <motion.div
          className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-yellow-900">Electricity Bill</h1>
              <p className="text-yellow-700">Earn tokens for energy conservation</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 text-yellow-600">
          <div>
            <label className="block text-sm font-medium text-yellow-900 mb-2">
              Customer ID *
            </label>
            <input
              type="text"
              required
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:border-yellow-600 transition-colors"
              placeholder="Enter your electricity customer ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-900 mb-2">
              Units Consumed (kWh) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.unitsConsumed}
              onChange={(e) => setFormData({ ...formData, unitsConsumed: e.target.value })}
              className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:border-yellow-600 transition-colors"
              placeholder="e.g., 250"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-900 mb-2">
              Home Type *
            </label>
            <select
              required
              value={formData.homeType}
              onChange={(e) => setFormData({ ...formData, homeType: e.target.value })}
              className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:border-yellow-600 transition-colors"
            >
              <option value="">Select home type</option>
              <option value="apartment">Apartment</option>
              <option value="bungalow">Bungalow</option>
              <option value="villa">Villa</option>
              <option value="independent-house">Independent House</option>
              <option value="farmhouse">Farmhouse</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-900 mb-2">
              Carpet Area (sq ft) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.carpetArea}
              onChange={(e) => setFormData({ ...formData, carpetArea: e.target.value })}
              className="w-full px-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:border-yellow-600 transition-colors"
              placeholder="e.g., 1200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-yellow-900 mb-2">
              Upload Electricity Bill (Optional)
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                id="bill-upload"
              />
              <label
                htmlFor="bill-upload"
                className="w-full px-4 py-6 border-2 border-dashed border-yellow-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-yellow-600 transition-colors"
              >
                <Upload className="w-8 h-8 text-yellow-600 mb-2" />
                <span className="text-sm text-yellow-700 text-center">
                  {formData.billFile ? formData.billFile.name : 'Click to upload bill (PDF, JPG, PNG)'}
                </span>
              </label>
            </div>
            {isScanning && (
              <div className="mt-2 flex items-center justify-center gap-2 text-yellow-800 text-sm font-medium animate-pulse">
                <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin"></div>
                Analyzing bill details using AI OCR...
              </div>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting || submitted}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-yellow-600 to-amber-700 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Calculating & Submitting...
              </>
            ) : submitted ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Submitted Successfully!
              </>
            ) : (
              'Submit & Earn Tokens'
            )}
          </motion.button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 rounded-xl">
          <p className="text-sm text-yellow-900">
            💡 <strong>Token Reward:</strong> Earn Green Tokens calculated dynamically by our ML model based on your carbon conservation compared to expected local baselines.
          </p>
        </div>
      </motion.div>
      </div>
      <Footer />
    </div>
  );
}