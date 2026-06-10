# GreenLens – Track, Earn, and Give Back to the Planet 

GreenLens is a modular, smart sustainability platform that helps users understand, track, and offset their carbon footprint. By logging daily activities like travel and energy conservation, users earn **Green Tokens** minted via smart contracts on the Ethereum Sepolia Testnet.

---

## Live Deployments

* **Frontend Client (Vercel)**: [greenlens-spuk.vercel.com](https://greenlens-spuk.vercel.com)
* **Express Gateway Backend (Render)**: [greenlens-express-backend.onrender.com](https://greenlens-express-backend.onrender.com)
* **AI/ML FastAPI Backend (Render)**: [greenlens-s4q8.onrender.com](https://greenlens-s4q8.onrender.com)
* **Solidity Smart Contract (Sepolia)**: `0xe193Ab4CE56C329AB295ef3fC79a2bc6aBcf0dD8`

---

## Core Features

* **Activity Carbon Tracking**: Log travel distances, electricity units, and plant counts.
* **AI OCR Invoice Scanning**: Auto-parse utility bills (PDFs/Images) using `pytesseract` and `fitz` OCR to extract data like Customer ID and usage.
* **ML Footprint Verification**: Verify consumption savings against expected baseline benchmarks derived from a trained XGBoost ML model.
* **On-Chain Blockchain Rewards**: Verified actions mint ERC-20 utility tokens on the Sepolia Testnet, which can be spent on green merchandise or burned to donate to registered NGOs.
* **Cinematic Dashboard**: A premium, interactive dashboard showing carbon statistics, charts, badges, and real-time simulator predictions.

---

## Tech Stack

* **Frontend**: Next.js (React), TailwindCSS, Framer Motion, Recharts
* **API Gateway**: Node.js + Express + MongoDB (Mongoose)
* **AI / ML Engine**: Python (FastAPI), XGBoost, PyMuPDF, Pytesseract OCR
* **Blockchain**: Solidity (ERC-20), Ethers.js, Sepolia Testnet (via Alchemy RPC)
* **Authentication**: Clerk Auth Service
* **File Uploads**: Cloudinary Storage Integration

---

## Environment Checklist

Ensure the environment files are configured prior to running the applications.

### 1. Frontend (`frontend-temp/.env`)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth
NEXT_PUBLIC_API_URL=https://greenlens-express-backend.onrender.com/api/v1
NEXT_PUBLIC_ML_API_URL=https://greenlens-s4q8.onrender.com
```

### 2. Backend (`Backend/.env`)
```env
MONGODB_URI=mongodb+srv://...
PORT=8080
CORS_ORIGIN=https://greenlens-spuk.vercel.com
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/...
PRIVATE_KEY=...
CONTRACT_ADDRESS=0xe193Ab4CE56C329AB295ef3fC79a2bc6aBcf0dD8
BLOCKCHAIN_PORT=5001
BLOCKCHAIN_API_URL=http://localhost:5001
ML_API_URL=https://greenlens-s4q8.onrender.com
CLERK_SECRET_KEY=sk_test_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## ⚙️ Developer Execution

### 1. Run the Express & Blockchain Backend
```bash
cd Backend
npm install
npm run dev      # Runs Express Gateway on Port 8080 (via nodemon)
npm start        # Launches Express Gateway & Blockchain Daemon (Port 5001) Concurrently
```

### 2. Run the Python FastAPI Engine
```bash
cd Backend
pip install -r requirements.txt
python main.py   # Starts FastAPI on http://localhost:8000
```

### 3. Run the Next.js Frontend
```bash
cd frontend-temp
npm install
npm run dev      # Launches dev server on http://localhost:3000
```
