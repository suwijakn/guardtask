// CompreFace helpers — enrollFace, verifyFace, classifyVerification

const COMPREFACE_URL = process.env.COMPREFACE_URL;
const COMPREFACE_API_KEY = process.env.COMPREFACE_API_KEY;

export async function enrollFace(guardId: string, photoBuffer: Buffer): Promise<boolean> {
  if (!COMPREFACE_URL || !COMPREFACE_API_KEY) {
    console.warn('CompreFace not configured');
    return false;
  }
  
  // TODO: Implement face enrollment
  return false;
}

export async function verifyFace(
  checkinPhotoUrl: string,
  profilePhotoUrl: string
): Promise<{ similarity: number; verified: boolean }> {
  if (!COMPREFACE_URL || !COMPREFACE_API_KEY) {
    console.warn('CompreFace not configured');
    return { similarity: 0, verified: false };
  }
  
  // TODO: Implement face verification
  return { similarity: 0, verified: false };
}

export function classifyVerification(similarity: number): 'auto_verified' | 'uncertain' | 'mismatch' {
  if (similarity >= 0.85) return 'auto_verified';
  if (similarity >= 0.60) return 'uncertain';
  return 'mismatch';
}
