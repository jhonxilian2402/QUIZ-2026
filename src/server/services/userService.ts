import {
  findUserByEmail,
  findUserById,
  findUserByUsername,
  toSessionUser,
  updateUser,
} from "../repositories/userRepository";
import { ConflictError, NotFoundError } from "../errors";
import type { ProfileUpdateInput } from "@/lib/api/schemas";
import type { SessionUser, UserResponse } from "@/lib/api/contracts";
import type { UserRow } from "../repositories/userRepository";

/**
 * User service. Exposes only serialized, safe profile shapes; the password hash
 * and status transitions never leave this layer.
 */

export function toUserResponse(row: UserRow): UserResponse {
  return {
    ...toSessionUser(row),
    bio: row.bio,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}

export async function getProfile(userId: string): Promise<UserResponse> {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("Account not found.");
  return toUserResponse(user);
}

/**
 * Updates the user's own profile. Only the fields present in the validated
 * schema can change: id, createdAt, status and role are unreachable from here,
 * so a generic profile update cannot escalate anything.
 */
export async function updateProfile(
  userId: string,
  patch: ProfileUpdateInput
): Promise<UserResponse> {
  if (patch.username) {
    const existing = await findUserByUsername(patch.username);
    if (existing && existing.id !== userId) {
      throw new ConflictError("That username is already taken.");
    }
  }

  const updated = await updateUser(userId, {
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    ...(patch.username !== undefined ? { username: patch.username } : {}),
    ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
    ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
  });

  if (!updated) throw new NotFoundError("Account not found.");
  return toUserResponse(updated);
}

export async function emailIsRegistered(email: string): Promise<boolean> {
  const user = await findUserByEmail(email);
  return Boolean(user);
}

export function currentUserOrThrow(user: SessionUser | null): SessionUser {
  if (!user) throw new NotFoundError("Account not found.");
  return user;
}