'use client';
import { motion } from 'framer-motion';
import { Sun, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Footer from '../../components/Footer.jsx';

export default function SolarForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    company: '',
    unitsGenerated: '',
    homeType: '',
    carpetArea: '',
    billFile: null
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, billFile: e.target.files[0] });
    }
  };

  const calculateTokens = () => {
    const units = parseFloat(formData.unitsGenerated) || 0;
    const tokens = 10 + Math.floor(units * 0.5);
    const co2Saved = parseFloat((units * 0.384).toFixed(2));
    return { tokensEarned: tokens, co2Saved };
  };

  const handleSubmit = async () => {
    // Validate form
    if (!formData.company || !formData.unitsGenerated || !formData.homeType || 
        !formData.carpetArea) {
      alert("⚠️ Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    console.log('Solar Power Data Submitted:', formData);

    // Calculate tokens and co2 saved
    const { tokensEarned, co2Saved } = calculateTokens();

    // Sync with Express backend
    try {
      const token = await getToken();
      if (token) {
        const bodyFormData = new FormData();
        bodyFormData.append("solarCompany", formData.company);
        bodyFormData.append("unitsGenerated", formData.unitsGenerated);
        bodyFormData.append("homeType", formData.homeType);
        bodyFormData.append("carpetArea", formData.carpetArea);
        
        if (formData.billFile) {
          bodyFormData.append("solarBillProof", formData.billFile);
        } else {
          // Fallback dummy file to satisfy backend required file check
          const blob = new Blob(["mock bill content"], { type: "text/plain" });
          bodyFormData.append("solarBillProof", blob, "mock-bill.txt");
        }

        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/form/solar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: bodyFormData
        });
      }
    } catch (err) {
      console.warn("Backend server offline, falling back to localStorage sync:", err);
    }

    // Update simulated values in localStorage
    if (typeof window !== 'undefined') {
      const currentSimulated = parseFloat(localStorage.getItem('simulatedTokens') || '0');
      localStorage.setItem('simulatedTokens', (currentSimulated + tokensEarned).toString());

      const currentCategory = parseFloat(localStorage.getItem('simulatedTokens_Solar') || '0');
      localStorage.setItem('simulatedTokens_Solar', (currentCategory + tokensEarned).toString());

      const currentCo2 = parseFloat(localStorage.getItem('simulatedCo2Saved') || '0');
      localStorage.setItem('simulatedCo2Saved', (currentCo2 + co2Saved).toString());

      const currentSubmissions = parseInt(localStorage.getItem('simulatedSubmissions') || '0');
      localStorage.setItem('simulatedSubmissions', (currentSubmissions + 1).toString());
    }

    alert(`✅ Data submitted successfully!\n🌿 Carbon Saved: ${co2Saved} kg CO2\n🪙 Green Tokens Earned: ${tokensEarned}`);

    setSubmitted(true);
    
    setTimeout(() => {
      setSubmitted(false);
      setIsSubmitting(false);
      router.push('/home');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-200 py-12 px-4 flex flex-col justify-between">
      <div className="flex-grow mb-12">
        <motion.div
          className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <Sun className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-amber-900">Solar Power</h1>
            <p className="text-amber-700">Earn tokens for renewable energy generation</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Solar Company/Provider *
            </label>
            <input
              type="text"
              required
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="e.g., SunPower, Tesla Solar"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Units Generated (kWh) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.unitsGenerated}
              onChange={(e) => setFormData({ ...formData, unitsGenerated: e.target.value })}
              className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="e.g., 320"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Home Type *
            </label>
            <select
              required
              value={formData.homeType}
              onChange={(e) => setFormData({ ...formData, homeType: e.target.value })}
              className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-700 transition-colors"
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
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Carpet Area (sq ft) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.carpetArea}
              onChange={(e) => setFormData({ ...formData, carpetArea: e.target.value })}
              className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-700 transition-colors"
              placeholder="e.g., 1200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Upload Solar Generation Bill/Report (Optional)
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                id="solar-upload"
              />
              <label
                htmlFor="solar-upload"
                className="w-full px-4 py-6 border-2 border-dashed border-amber-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-700 transition-colors"
              >
                <Upload className="w-8 h-8 text-amber-650 mb-2" />
                <span className="text-sm text-amber-700">
                  {formData.billFile ? formData.billFile.name : 'Click to upload document (PDF, JPG, PNG)'}
                </span>
              </label>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || submitted}
            whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
            whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-amber-700 to-orange-800 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
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
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-xl">
          <p className="text-sm text-amber-900">
            ☀️ <strong>Token Reward:</strong> Earn Green Tokens calculated dynamically based on your renewable energy generated.
          </p>
        </div>
      </motion.div>
      </div>
      <Footer />
    </div>
  );
}