/**
 * Authentication utilities and configuration
 *
 * This module exports all authentication-related functionality:
 * - NextAuth configuration and handlers
 * - Password hashing and verification utilities
 */

export { handlers, auth, signIn, signOut } from "./config";
export { hashPassword, verifyPassword } from "./password";
