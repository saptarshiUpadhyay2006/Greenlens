'use client';
import { motion } from 'framer-motion';
import { ShoppingCart, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Footer from '../../components/Footer.jsx';

export default function PurchaseForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [purchaseType, setPurchaseType] = useState('');
  const [formData, setFormData] = useState({
    // Solar Panel fields
    solarCompany: '',
    panelCapacity: '',
    numberOfPanels: '',
    installationDate: '',
    
    // EV fields
    evBrand: '',
    evModel: '',
    batteryCapacity: '',
    purchaseDate: '',
    vehicleNumber: '',
    
    // Common
    invoiceFile: null,
    proofFile: null
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e, fileType) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, [fileType]: e.target.files[0] });
    }
  };

  const calculateTokens = () => {
    let tokens = 50; // base reward
    let co2Saved = 100; // base co2 saved in kg
    
    if (purchaseType === 'solar') {
      const cap = parseFloat(formData.panelCapacity) || 0;
      const panels = parseInt(formData.numberOfPanels) || 0;
      tokens = 100 + Math.floor(cap * panels * 10);
      co2Saved = parseFloat((cap * panels * 40).toFixed(2));
    } else if (purchaseType === 'ev') {
      const bat = parseFloat(formData.batteryCapacity) || 0;
      tokens = 150 + Math.floor(bat * 2);
      co2Saved = parseFloat((bat * 15).toFixed(2));
    }

    return { tokensEarned: tokens, co2Saved };
  };

  const validateForm = () => {
    if (!purchaseType) {
      alert("⚠️ Please select a purchase type");
      return false;
    }

    if (purchaseType === 'solar') {
      if (!formData.solarCompany || !formData.panelCapacity || 
          !formData.numberOfPanels || !formData.installationDate) {
        alert("⚠️ Please fill in all solar panel fields");
        return false;
      }
    }

    if (purchaseType === 'ev') {
      if (!formData.evBrand || !formData.evModel || !formData.batteryCapacity || 
          !formData.purchaseDate || !formData.vehicleNumber) {
        alert("⚠️ Please fill in all EV fields");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    console.log('Purchase Data Submitted:', { purchaseType, ...formData });

    // Calculate tokens and co2 saved
    const { tokensEarned, co2Saved } = calculateTokens();

    // Sync with Express backend
    try {
      const token = await getToken();
      if (token) {
        await fetch('http://localhost:8080/api/v1/form/purchase', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            purchaseType,
            details: formData
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

      if (purchaseType === 'solar') {
        const currentCategory = parseFloat(localStorage.getItem('simulatedTokens_Solar') || '0');
        localStorage.setItem('simulatedTokens_Solar', (currentCategory + tokensEarned).toString());
      } else {
        const currentCategory = parseFloat(localStorage.getItem('simulatedTokens_Transport') || '0');
        localStorage.setItem('simulatedTokens_Transport', (currentCategory + tokensEarned).toString());
      }

      const currentCo2 = parseFloat(localStorage.getItem('simulatedCo2Saved') || '0');
      localStorage.setItem('simulatedCo2Saved', (currentCo2 + co2Saved).toString());

      const currentSubmissions = parseInt(localStorage.getItem('simulatedSubmissions') || '0');
      localStorage.setItem('simulatedSubmissions', (currentSubmissions + 1).toString());
    }

    alert(`✅ Data submitted successfully!\n🌿 Est. CO2 Reduction: ${co2Saved} kg\n🪙 Green Tokens Earned: ${tokensEarned}`);

    setSubmitted(true);
    
    setTimeout(() => {
      setSubmitted(false);
      setIsSubmitting(false);
      router.push('/home');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-200 py-12 px-4 text-purple-700 flex flex-col justify-between">
      <div className="flex-grow mb-12">
        <motion.div
          className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-purple-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-purple-900">Eco Purchase</h1>
            <p className="text-purple-700">Earn tokens for sustainable purchases</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Purchase Type Selection */}
          <div>
            <label className="block text-sm font-medium text-purple-900 mb-3">
              Purchase Type *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPurchaseType('solar')}
                className={`py-4 rounded-xl font-medium transition-all cursor-pointer ${
                  purchaseType === 'solar'
                    ? 'bg-purple-700 text-white shadow-lg'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                ☀️ Solar Panel
              </button>
              <button
                type="button"
                onClick={() => setPurchaseType('ev')}
                className={`py-4 rounded-xl font-medium transition-all cursor-pointer ${
                  purchaseType === 'ev'
                    ? 'bg-purple-700 text-white shadow-lg'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                🚗 Electric Vehicle
              </button>
            </div>
          </div>

          {/* Solar Panel Form */}
          {purchaseType === 'solar' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Solar Company/Brand *
                </label>
                <input
                  type="text"
                  required
                  value={formData.solarCompany}
                  onChange={(e) => setFormData({ ...formData, solarCompany: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                  placeholder="e.g., Tata Solar, Adani Solar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Panel Capacity (kW) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={formData.panelCapacity}
                    onChange={(e) => setFormData({ ...formData, panelCapacity: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                    placeholder="e.g., 5.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Number of Panels *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.numberOfPanels}
                    onChange={(e) => setFormData({ ...formData, numberOfPanels: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                    placeholder="e.g., 12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Installation Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.installationDate}
                  onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                />
              </div>
            </motion.div>
          )}

          {/* EV Form */}
          {purchaseType === 'ev' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    EV Brand *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.evBrand}
                    onChange={(e) => setFormData({ ...formData, evBrand: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                    placeholder="e.g., Tesla, Tata"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.evModel}
                    onChange={(e) => setFormData({ ...formData, evModel: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                    placeholder="e.g., Model 3, Nexon EV"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Battery Capacity (kWh) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.1"
                  value={formData.batteryCapacity}
                  onChange={(e) => setFormData({ ...formData, batteryCapacity: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                  placeholder="e.g., 40.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                  placeholder="e.g., MH12AB1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Purchase Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:border-purple-700 transition-colors"
                />
              </div>
            </motion.div>
          )}

          {/* Common File Uploads */}
          {purchaseType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Upload Invoice/Bill (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(e, 'invoiceFile')}
                  className="hidden"
                  id="invoice-upload"
                />
                <label
                  htmlFor="invoice-upload"
                  className="w-full px-4 py-6 border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-700 transition-colors"
                >
                  <Upload className="w-8 h-8 text-purple-650 mb-2" />
                  <span className="text-sm text-purple-750">
                    {formData.invoiceFile ? formData.invoiceFile.name : 'Click to upload invoice (PDF, JPG, PNG)'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-900 mb-2">
                  Upload Proof Photo (Optional)
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(e, 'proofFile')}
                  className="hidden"
                  id="proof-upload"
                />
                <label
                  htmlFor="proof-upload"
                  className="w-full px-4 py-6 border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-700 transition-colors"
                >
                  <Upload className="w-8 h-8 text-purple-650 mb-2" />
                  <span className="text-sm text-purple-750">
                    {formData.proofFile ? formData.proofFile.name : 'Click to upload proof photo (JPG, PNG)'}
                  </span>
                  <span className="text-xs text-purple-650 mt-1">
                    {purchaseType === 'solar' ? 'Photo of installed solar panels' : 'Photo of your EV'}
                  </span>
                </label>
              </div>
            </motion.div>
          )}

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!purchaseType || isSubmitting || submitted}
            whileHover={{ scale: purchaseType && !isSubmitting ? 1.02 : 1 }}
            whileTap={{ scale: purchaseType && !isSubmitting ? 0.98 : 1 }}
            className={`w-full py-4 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 transition-all ${
              purchaseType && !isSubmitting && !submitted
                ? 'bg-gradient-to-r from-purple-700 to-indigo-800 text-white cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
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

        <div className="mt-6 p-4 bg-purple-50 rounded-xl">
          <p className="text-sm text-purple-900">
            🎁 <strong>Token Reward:</strong> Earn Green Tokens calculated dynamically based on your eco-friendly technology purchases.
          </p>
        </div>
      </motion.div>
      </div>
      <Footer />
    </div>
  );
}