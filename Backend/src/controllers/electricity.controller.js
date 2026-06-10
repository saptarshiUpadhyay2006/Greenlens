import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/models.js";
import { Address } from "../models/models.js";
import { ElectricityUsage } from "../models/models.js";
import axios from "axios";

export const logElectricityBill = asyncHandler(async (req, res) => {
  // 1. Get data from request body
  const { bill, month, unitsUsed, solarUsed, homeType, carpetArea } = req.body;
  const clerkId = req.auth.userId;

  if (!month || unitsUsed === undefined) {
    throw new ApiError(400, "Month and Units Used are required");
  }

  // 2. Find User and their Address 
  const user = await User.findOne({ clerkId });
  if (!user) throw new ApiError(404, "User not found");

  let address = await Address.findById(user.addressId);
  const finalHomeType = homeType || (address ? address.homeType : null);
  const finalCarpetArea = carpetArea || (address ? address.carpetArea : null);

  if (!finalHomeType || !finalCarpetArea) {
    throw new ApiError(
      400,
      "Home Type and Carpet Area are required (either in request body or user profile)"
    );
  }

  // Save new values to the address model if they were provided
  if (address) {
    if (homeType && address.homeType !== homeType) address.homeType = homeType;
    if (carpetArea && address.carpetArea !== carpetArea) address.carpetArea = carpetArea;
    await address.save();
  }

  // 3. Call the FastAPI ML Service
  let mlResponse;
  try {
    const payload = {
      homeType: finalHomeType,
      carpetArea_sqft: parseFloat(finalCarpetArea),
      monthly_unitsUsed_kwh: parseFloat(unitsUsed),
      monthly_solarUsed_kwh: parseFloat(solarUsed) || 0,
    };
    mlResponse = await axios.post(
      `${process.env.ML_API_URL}/calculate-electricity`,
      payload
    );
  } catch (error) {
    console.error("ML API Error:", error.message);
    throw new ApiError(500, "ML service is unavailable");
  }

  // 4. Process ML Response
  const { user_co2_footprint_kg, tokens_awarded } = mlResponse.data;

  // 5. Save the data
  await ElectricityUsage.create({
    userID: user._id,
    bill,
    month,
    unitsUsed,
    solarUsed: solarUsed || 0,
  });

  // Update user's profile
  user.greenTokens += tokens_awarded;
  user.carbonFootprint = user_co2_footprint_kg;
  await user.save({ validateBeforeSave: false });

  // 6. Return success
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        tokensEarned: tokens_awarded,
        newCarbonFootprint: user_co2_footprint_kg,
        newTotalTokens: user.greenTokens,
      },
      "Electricity bill logged successfully"
    )
  );
});
