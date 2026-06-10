import { Clerk } from "@clerk/clerk-sdk-node";
import { ApiError } from "../utils/apiError.js";

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

//Clerk authentication middleware
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized: No token provided"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await clerk.verifyToken(token);

    req.auth = { userId: decoded.sub };

    next();
  } catch (error) {
    console.error("Clerk auth error:", error);
    return next(new ApiError(401, "Unauthorized: Invalid token"));
  }
};
