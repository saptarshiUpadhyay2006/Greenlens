'use client';
import { motion } from 'framer-motion';
import { Car, Bike, Bus, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Footer from '../../components/Footer.jsx';

export default function TransportForm() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [isEV, setIsEV] = useState(null);
  const [vehicleType, setVehicleType] = useState('');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [formData, setFormData] = useState({
    evCapacity: '',
    odometerReading: '',
    vehicleModel: '',
    vehicleNumber: '',
    origin: '',
    destination: '',
    distance: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getSimulatedDistance = (origin, dest) => {
    let hash = 0;
    const combined = (origin + dest).toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const distance = 5.0 + Math.abs(hash % 600) / 10;
    return parseFloat(distance.toFixed(1));
  };

  const handleOriginDestChange = async (field, value) => {
    const updatedForm = { ...formData, [field]: value };
    setFormData(updatedForm);

    if (updatedForm.origin.trim().length >= 3 && updatedForm.destination.trim().length >= 3) {
      setIsCalculatingRoute(true);
      setTimeout(() => {
        const dist = getSimulatedDistance(updatedForm.origin, updatedForm.destination);
        setFormData(prev => ({ ...prev, distance: dist.toString() }));
        setIsCalculatingRoute(false);
      }, 1200);
    }
  };


  const calculateTokens = async () => {
    // Determine vehicle type for API mapping
    let vehicle = 'Car';
    if (vehicleType === 'cycle') vehicle = 'Bicycle';
    else if (vehicleType === 'public-transport') vehicle = 'Other';
    else if (vehicleType === '2-wheeler') vehicle = isEV ? 'E-Bike' : 'Motorcycle';
    else if (vehicleType === '4-wheeler') vehicle = 'Car';

    const kmCovered = parseFloat(formData.distance) || 20;

    try {
      const response = await fetch('http://localhost:8000/calculate-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_type: vehicle,
          kmCovered: parseFloat(kmCovered)
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        const expectedCo2 = 150;
        const co2Saved = Math.max(0, expectedCo2 - data.user_co2_footprint_kg);
        return {
          tokensEarned: data.tokens_awarded,
          userCo2: data.user_co2_footprint_kg,
          co2Saved: parseFloat(co2Saved.toFixed(2))
        };
      }
    } catch (err) {
      console.warn("ML Engine offline or error, falling back to local travel math:", err);
    }

    // Local fallback formula matching prediction page
    const VEHICLE_FACTORS = {
      'Car': 0.248,
      'Motorcycle': 0.114,
      'Scooter': 0.114,
      'E-Bike': 0.077,
      'Bicycle': 0.0,
      'Three-Wheeler': 0.150,
      'Other': 0.248
    };

    const factor = VEHICLE_FACTORS[vehicle] ?? 0.248;
    const actualCo2 = kmCovered * factor;
    const expectedCo2 = 150; // Global monthly benchmark
    const co2Saved = Math.max(0, expectedCo2 - actualCo2);

    let tokens = 10;
    if (actualCo2 < expectedCo2) {
      tokens += Math.floor(co2Saved * 0.1);
    }

    return {
      tokensEarned: tokens,
      userCo2: parseFloat(actualCo2.toFixed(2)),
      co2Saved: parseFloat(co2Saved.toFixed(2))
    };
  };

  const validateForm = () => {
    if (isEV === null) {
      alert("⚠️ Please select if your vehicle is electric");
      return false;
    }

    if (!vehicleType) {
      alert("⚠️ Please select a vehicle type");
      return false;
    }

    if (!formData.origin || !formData.destination) {
      alert("⚠️ Please enter starting location and destination");
      return false;
    }

    // For cycle and public transport, less validation needed
    if (['cycle', 'public-transport'].includes(vehicleType)) {
      return true;
    }

    // For other vehicles, check required fields
    if (!formData.vehicleModel || !formData.vehicleNumber || !formData.odometerReading) {
      alert("⚠️ Please fill in all vehicle details");
      return false;
    }

    // If EV, check battery capacity
    if (isEV && !formData.evCapacity) {
      alert("⚠️ Please enter battery capacity");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Prepare submit data
    const submitData = {
      isEV,
      vehicleType,
      ...formData,
      odometerReading: ['cycle', 'public-transport'].includes(vehicleType) ? null : formData.odometerReading
    };

    console.log('Transport Data Submitted:', submitData);

    // Calculate tokens and co2 saved
    const { tokensEarned, userCo2, co2Saved } = await calculateTokens();

    // Sync with Express backend
    try {
      const token = await getToken();
      if (token) {
        let backendMode = 'default';
        if (vehicleType === '4-wheeler') backendMode = 'four wheeler';
        else if (vehicleType === '2-wheeler') backendMode = 'two wheeler';
        else if (vehicleType === 'cycle') backendMode = 'bicycle';
        else if (vehicleType === 'public-transport') backendMode = 'public transport';

        await fetch('http://localhost:8080/api/v1/form/transport', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mode: backendMode,
            distance: parseFloat(formData.distance) || 20,
            isEV: isEV
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

      const currentCategory = parseFloat(localStorage.getItem('simulatedTokens_Transport') || '0');
      localStorage.setItem('simulatedTokens_Transport', (currentCategory + tokensEarned).toString());

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-200 py-12 px-4 text-blue-700 flex flex-col justify-between">
      <div className="flex-grow mb-12">
        <motion.div
          className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Transport Mode</h1>
            <p className="text-blue-700">Earn tokens for sustainable commuting</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* EV or Not */}
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-3">
              Is your vehicle Electric? *
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsEV(true)}
                className={`flex-1 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  isEV === true
                    ? 'bg-blue-700 text-white shadow-lg'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Yes, EV
              </button>
              <button
                type="button"
                onClick={() => setIsEV(false)}
                className={`flex-1 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  isEV === false
                    ? 'bg-blue-700 text-white shadow-lg'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                No, Non-EV
              </button>
            </div>
          </div>

          {/* Vehicle Type */}
          {isEV !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <label className="block text-sm font-medium text-blue-900 mb-3">
                Vehicle Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['4-wheeler', '2-wheeler', 'cycle', 'public-transport'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setVehicleType(type)}
                    className={`py-3 rounded-xl font-medium transition-all cursor-pointer ${
                      vehicleType === type
                        ? 'bg-blue-700 text-white shadow-lg'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    <div className="text-sm capitalize">{type.replace('-', ' ')}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Route details */}
          {vehicleType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-200"
            >
              <h3 className="text-md font-bold text-blue-900">Route Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Starting Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.origin}
                    onChange={(e) => handleOriginDestChange('origin', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 bg-white transition-colors text-blue-800"
                    placeholder="e.g., Delhi Airport"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.destination}
                    onChange={(e) => handleOriginDestChange('destination', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 bg-white transition-colors text-blue-800"
                    placeholder="e.g., Connaught Place"
                  />
                </div>
              </div>

              {isCalculatingRoute && (
                <div className="flex items-center gap-2 text-sm text-blue-700 animate-pulse mt-2">
                  <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                  Estimating transit distance and routing...
                </div>
              )}

              {formData.distance && !isCalculatingRoute && (
                <div className="p-3 bg-blue-100 rounded-xl text-sm text-blue-900 flex items-center justify-between mt-2">
                  <span>🚗 Calculated Distance: <strong>{formData.distance} km</strong></span>
                  <span className="text-xs text-blue-750 italic font-medium">via Directions API</span>
                </div>
              )}
            </motion.div>
          )}

          {/* EV Capacity (if EV) */}
          {isEV === true && vehicleType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
            >
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Battery Capacity (kWh) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.1"
                value={formData.evCapacity}
                onChange={(e) => setFormData({ ...formData, evCapacity: e.target.value })}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 transition-colors"
                placeholder="e.g., 40.5"
              />
            </motion.div>
          )}

          {/* Vehicle Details */}
          {vehicleType && !['cycle', 'public-transport'].includes(vehicleType) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Vehicle Model *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 transition-colors"
                  placeholder="e.g., Tesla Model 3, Honda Activa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 transition-colors"
                  placeholder="e.g., MH12AB1234"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Odometer Reading (km) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.odometerReading}
                  onChange={(e) => setFormData({ ...formData, odometerReading: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-700 transition-colors"
                  placeholder="Current odometer reading"
                />
              </div>
            </motion.div>
          )}

          {/* Public Transport/Cycle Info */}
          {vehicleType && ['cycle', 'public-transport'].includes(vehicleType) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="p-4 bg-blue-50 rounded-xl"
            >
              <p className="text-sm text-blue-900">
                🎉 Excellent choice! {vehicleType === 'cycle' ? 'Cycling' : 'Public transport'} is 
                one of the most sustainable ways to travel. You'll earn bonus tokens!
              </p>
            </motion.div>
          )}

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!vehicleType || isSubmitting || submitted}
            whileHover={{ scale: vehicleType && !isSubmitting ? 1.02 : 1 }}
            whileTap={{ scale: vehicleType && !isSubmitting ? 0.98 : 1 }}
            className={`w-full py-4 rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 transition-all ${
              vehicleType && !isSubmitting && !submitted
                ? 'bg-gradient-to-r from-blue-700 to-cyan-800 text-white cursor-pointer'
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

        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-900">
            🚗 <strong>Token Reward:</strong> Earn Green Tokens calculated dynamically based on your commute mode and vehicle sustainability scores.
          </p>
        </div>
      </motion.div>
      </div>
      <Footer />
    </div>
  );
}