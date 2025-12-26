import express from "express";
import { registerUser, loginUser } from "./localAuth";
import { COOKIE_NAME } from "../shared/const";

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await registerUser(email, password, name);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, userId: result.userId });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * Login a user
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await loginUser(email, password);

    if (!result.success) {
      res.status(401).json({ error: result.error });
      return;
    }

    // Set HTTP-only cookie with JWT token
    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: req.protocol === "https",
      sameSite: req.protocol === "https" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.json({ success: true, user: result.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
