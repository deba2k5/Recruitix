export function toUserDto(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id.toString(),
    email: userDoc.email,
    displayName: userDoc.displayName ?? null,
    year: userDoc.year ?? null,
    department: userDoc.department ?? null,
    enrollmentNo: userDoc.enrollmentNo ?? null,
    role: userDoc.role,
    faceEnrolled: Boolean(userDoc.faceEnrolled),
    enrollmentStatus: userDoc.enrollmentStatus ?? 'pending',
  };
}
