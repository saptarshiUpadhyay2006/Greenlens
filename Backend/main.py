import pandas as pd
import joblib
import uvicorn
from fastapi import FastAPI, UploadFile, File
import re
import io
import fitz
from PIL import Image
import pytesseract

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

# --- 1. Define Constants ---

# Emission factors (in kg CO2)
ELECTRICITY_FACTOR_KWH = 0.384
VEHICLE_FACTORS_PER_KM = {
    'Car': 0.248,
    'Motorcycle': 0.114,
    'Scooter': 0.114,
    'E-Bike': 0.077,
    'Bicycle': 0.0,
    'Three-Wheeler': 0.150,
    'Other': 0.248
}
# This is our benchmark for the travel module
AVERAGE_MONTHLY_TRAVEL_CO2 = 150  # (kg)


# --- 2. Define Pydantic Models for Inputs ---

class ElectricityData(BaseModel):
    # Features for the ML model
    homeType: str
    carpetArea_sqft: float
    # Features for the calculation
    monthly_unitsUsed_kwh: float
    monthly_solarUsed_kwh: float

    class Config:
        json_schema_extra = {
            "example": {
                "homeType": "Apartment",
                "carpetArea_sqft": 900.0,
                "monthly_unitsUsed_kwh": 300.0,
                "monthly_solarUsed_kwh": 0.0
            }
        }


class TravelData(BaseModel):
    vehicle_type: str
    kmCovered: float  # Your Node.js backend calculates this

    class Config:
        json_schema_extra = {
            "example": {
                "vehicle_type": "Car",
                "kmCovered": 250.0
            }
        }


# --- 3. Create App State & Lifespan Event ---
app_state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the new ML model
    print("Loading *electricity benchmark* ML model...")
    # Make sure your new model file is named this:
    app_state["electricity_model"] = joblib.load("electricity_benchmark_model.pkl")
    print("Model loaded successfully.")
    yield
    print("Clearing application state...")
    app_state.clear()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 4. Define API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "GreenLens Modular AI Engine is running!"}


def parse_extracted_text(text: str):
    text_lower = text.lower()
    
    # Try to find Customer ID
    customer_id = None
    cust_patterns = [
        r"(?:customer|consumer|account|ca|bill|utility)\s*(?:id|number|no|num|#)?\s*[:\-=]?\s*([a-zA-Z0-9\-]{4,20})",
        r"cust\s*id\s*[:\-=]?\s*([a-zA-Z0-9\-]{4,20})",
    ]
    for pattern in cust_patterns:
        match = re.search(pattern, text_lower)
        if match:
            customer_id = match.group(1).upper()
            break
            
    # Try to find Units Consumed
    units_consumed = None
    units_patterns = [
        r"(?:units|consumption|usage|kwh|power\s*used)\s*(?:consumed|used)?\s*[:\-=]?\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*(?:units|kwh)",
    ]
    for pattern in units_patterns:
        match = re.search(pattern, text_lower)
        if match:
            units_consumed = float(match.group(1))
            break
            
    # Try to find Carpet Area
    carpet_area = None
    area_patterns = [
        r"(?:carpet)?\s*area\s*[:\-=]?\s*(\d+(?:\.\d+)?)\s*(?:sqft|sq\s*ft|sq\.ft|square\s*feet|sq\s*meters)?",
        r"(\d+(?:\.\d+)?)\s*(?:sqft|sq\s*ft|sq\.ft|square\s*feet)"
    ]
    for pattern in area_patterns:
        match = re.search(pattern, text_lower)
        if match:
            carpet_area = float(match.group(1))
            break
            
    return customer_id, units_consumed, carpet_area


@app.post("/parse-bill")
async def parse_bill(file: UploadFile = File(...)):
    filename = file.filename
    file_bytes = await file.read()
    
    text = ""
    error_log = []
    
    # Check if PDF
    if filename.lower().endswith(".pdf"):
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text()
        except Exception as e:
            error_log.append(f"PDF text extraction failed: {str(e)}")
    else:
        # Try image OCR using pytesseract
        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
        except Exception as e:
            error_log.append(f"pytesseract OCR failed: {str(e)}")
            
    # Extract info using regex
    customer_id, units_consumed, carpet_area = None, None, None
    home_type = None
    
    if text:
        # Regex search
        customer_id, units_consumed, carpet_area = parse_extracted_text(text)
        
        # Look for homeType
        text_lower = text.lower()
        for htype in ["apartment", "bungalow", "villa", "independent-house", "independent house", "farmhouse"]:
            if htype in text_lower:
                home_type = htype.replace(" ", "-")
                break
                
    # Fallback simulation if parsing didn't find the fields (e.g. image OCR failed or dummy file uploaded)
    is_mock = False
    if not customer_id or not units_consumed or not carpet_area:
        is_mock = True
        if not customer_id:
            # Try to grab digits from filename, else default
            fn_digits = "".join(filter(str.isdigit, filename))
            customer_id = f"CUST-{fn_digits}" if fn_digits else "CUST-987456"
        if not units_consumed:
            units_consumed = 350.0  # reasonable fallback
        if not carpet_area:
            carpet_area = 1100.0  # reasonable fallback
        if not home_type:
            home_type = "apartment"
            
    return {
        "status": "success",
        "customer_id": customer_id,
        "units_consumed": units_consumed,
        "carpet_area": carpet_area,
        "home_type": home_type,
        "is_mock": is_mock,
        "error_log": error_log
    }



@app.post("/calculate-electricity")
def calculate_electricity_footprint(data: ElectricityData):
    """
    Calculates CO2 from electricity use and awards tokens by
    comparing against a personalized, ML-generated benchmark.
    """

    # 1. Calculate user's *actual* CO2 footprint
    net_kwh_used = data.monthly_unitsUsed_kwh - data.monthly_solarUsed_kwh
    actual_co2 = max(0, net_kwh_used * ELECTRICITY_FACTOR_KWH)

    # 2. Get the *expected* CO2 benchmark from the ML model
    model = app_state["electricity_model"]

    # Create DataFrame for model prediction
    features_df = pd.DataFrame({
        'homeType': [data.homeType],
        'carpetArea_sqft': [data.carpetArea_sqft]
    })

    expected_co2 = model.predict(features_df).item()

    # 3. Calculate tokens
    tokens_to_award = 0
    if actual_co2 < expected_co2:
        co2_saved = expected_co2 - actual_co2
        # Award 10 base tokens + bonus for savings
        tokens_to_award = 10 + int(co2_saved * 0.1)

    return {
        "status": "success",
        "user_co2_footprint_kg": round(actual_co2, 2),
        "tokens_awarded": tokens_to_award
    }


@app.post("/calculate-travel")
def calculate_travel_footprint(data: TravelData):
    """
    Calculates CO2 from travel and awards tokens by
    comparing against a fixed global benchmark.
    """

    # 1. Calculate user's *actual* CO2 footprint
    vehicle_factor = VEHICLE_FACTORS_PER_KM.get(data.vehicle_type, VEHICLE_FACTORS_PER_KM['Other'])
    actual_co2 = data.kmCovered * vehicle_factor

    # 2. Get the *expected* CO2 benchmark (fixed value)
    expected_co2 = AVERAGE_MONTHLY_TRAVEL_CO2

    # 3. Calculate tokens
    tokens_to_award = 0
    if actual_co2 < expected_co2:
        co2_saved = expected_co2 - actual_co2
        tokens_to_award = 10 + int(co2_saved * 0.1)

    return {
        "status": "success",
        "user_co2_footprint_kg": round(actual_co2, 2),
        "tokens_awarded": tokens_to_award
    }


# --- 5. Main entry point to run the app ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)