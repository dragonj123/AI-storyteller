import bcrypt from "bcrypt";
import { SignJWT, jwtVerify } from "jose";
import { users, type InsertUser } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production"
);

const SALT_ROUNDS = 10;

export interface TokenPayload {
  userId: number;
  email: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as number,
      email: payload.email as string,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; userId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Email already registered" };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db.insert(users).values({
      email,
      password: hashedPassword,
      name: name || null,
      loginMethod: "local",
      role: "user",
    });

    return { success: true, userId: Number((result as any).insertId) };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Registration failed" };
  }
}

/**
 * Login a user
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Find user
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "Invalid email or password" };
    }

    const user = result[0];

    // Verify password
    if (!user.password) {
      return { success: false, error: "Invalid email or password" };
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return { success: false, error: "Invalid email or password" };
    }

    // Update last signed in
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, user.id));

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return { success: true, token, user: userWithoutPassword };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Login failed" };
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const { password: _, ...userWithoutPassword } = result[0];
  return userWithoutPassword;
}
