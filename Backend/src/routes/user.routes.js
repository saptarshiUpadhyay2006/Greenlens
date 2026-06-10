import { Router } from "express";
import { getUserDashboard, syncUser, redeemTokens } from "../controllers/user.controller.js";
import { updateUserProfile } from "../controllers/profile.controller.js"; 
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

// Route to get all dashboard data
router.route("/dashboard").get(getUserDashboard);

// Route to sync Clerk user with local DB
router.route("/sync").post(syncUser);

// Route for updating the profile
router.route("/profile").patch(updateUserProfile);

// Route for token redemption/burn
router.route("/redeem").post(redeemTokens);

export default router;