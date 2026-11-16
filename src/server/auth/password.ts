import bcrypt from "bcryptjs";

/**
 * Number of salt rounds for bcrypt hashing
 * Higher = more secure but slower
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plain text password using bcrypt
 * @param password - The plain text password to hash
 * @returns Promise resolving to the hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        return hash;
    } catch (error) {
        throw new Error(
            `Failed to hash password: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Verifies a plain text password against a hash
 * @param password - The plain text password to verify
 * @param hash - The hashed password to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        const isValid = await bcrypt.compare(password, hash);
        return isValid;
    } catch (error) {
        // Log error but don't expose details to caller
        console.error("Password verification error:", error);
        return false;
    }
}
