import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User, Address, Solar } from "../models/models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import axios from "axios";

export const logSolarGeneration = asyncHandler(async (req, res) => {
  // 1. Get data from form and user
  const { solarCompany, unitsGenerated, homeType, carpetArea } = req.body;
  const clerkId = req.auth.userId;

  // 2. Validate form data
  const numUnitsGenerated = Number(unitsGenerated);
  if (!numUnitsGenerated || numUnitsGenerated <= 0) {
    throw new ApiError(400, "Valid 'Units Generated (kWh)' are required.");
  }
  if (!solarCompany) {
    throw new ApiError(400, "Solar Company/Provider is required.");
  }

  // 3. Find User and their Address
  const user = await User.findOne({ clerkId });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const address = await Address.findById(user.addressId);
  const finalHomeType = homeType || (address ? address.homeType : "Apartment");
  const finalCarpetArea = carpetArea || (address ? address.carpetArea : "1000");

  if (address) {
    if (homeType && address.homeType !== homeType) address.homeType = homeType;
    if (carpetArea && address.carpetArea !== carpetArea) address.carpetArea = carpetArea;
    await address.save();
  }

  // 4. Handle the image upload
  const imageLocalPath = req.file?.path;
  if (!imageLocalPath) {
    throw new ApiError(400, "A Solar Generation Bill/Report is required.");
  }

  const cloudinaryResponse = await uploadOnCloudinary(imageLocalPath);
  if (!cloudinaryResponse || !cloudinaryResponse.url) {
    throw new ApiError(500, "Failed to upload bill/report");
  }
  const billProofUrl = cloudinaryResponse.url;

  // 5. Call the FastAPI ML Service
  let mlResponse;
  try {
    const payload = {
      homeType: finalHomeType,
      carpetArea_sqft: parseFloat(finalCarpetArea),
      monthly_unitsUsed_kwh: 0, // Not provided on this form
      monthly_solarUsed_kwh: numUnitsGenerated, // This is our "Units Generated"
    };
    mlResponse = await axios.post(
      `${process.env.ML_API_URL}/calculate-electricity`,
      payload
    );
  } catch (error) {
    console.error("ML API Error:", error.message);
    throw new ApiError(500, "ML service is unavailable");
  }

  // 6. Process ML Response
  const { user_co2_footprint_kg, tokens_awarded } = mlResponse.data;

  // 7. Update the Solar document
  // This will find the user's Solar doc or create one if it doesn't exist.
  const solarData = await Solar.findOneAndUpdate(
    { userID: user._id },
    {
      $inc: { totalSolarUnitsUsed: numUnitsGenerated }, // Add to the lifetime total
      $set: {
        modelName: solarCompany, // Update the company name
        lastGenerationBill: billProofUrl, // Set the last bill URL
      },
    },
    { new: true, upsert: true } // `upsert: true` creates a new doc if none exists
  );

  // 8. Update the User's tokens
  user.greenTokens += tokens_awarded;
  // We also update the carbon footprint, as the ML model calculated it
  user.carbonFootprint = user_co2_footprint_kg;
  await user.save({ validateBeforeSave: false });

  // 9. Send response
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        unitsGenerated: numUnitsGenerated,
        tokensEarned: tokens_awarded,
        totalSolarUnits: solarData.totalSolarUnitsUsed,
        newTotalTokens: user.greenTokens,
        newCarbonFootprint: user.carbonFootprint,
      },
      "Solar generation logged successfully!"
    )
  );
});
