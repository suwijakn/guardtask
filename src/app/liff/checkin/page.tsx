"use client";

import { useEffect, useState, useRef } from "react";
import liff from "@line/liff";

interface Site {
  id: string;
  name: string;
}

interface Guard {
  id: string;
  fullName: string;
  employeeCode: string;
  photoUrl: string | null;
  isPrimary: boolean;
}

type PathType = "A" | "B";

export default function CheckinPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [pathType, setPathType] = useState<PathType | null>(null);

  // Path A states
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");

  // Path B states
  const [sitePassword, setSitePassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifiedSite, setVerifiedSite] = useState<Site | null>(null);

  // Common states
  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializeLiff();
  }, []);

  const initializeLiff = async () => {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setError("LIFF ID not configured");
        setLoading(false);
        return;
      }

      await liff.init({ liffId });

      if (!liff.isInClient()) {
        setError("กรุณาเปิดผ่าน LINE");
        setLoading(false);
        return;
      }

      const profile = await liff.getProfile();
      setLineUserId(profile.userId);

      // Check identity
      await checkIdentity(profile.userId);
    } catch (err) {
      console.error("LIFF initialization error:", err);
      setError("ไม่สามารถเชื่อมต่อ LINE ได้");
      setLoading(false);
    }
  };

  const checkIdentity = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/checkin/identity?lineUserId=${userId}`,
      );
      const data = await response.json();

      if (data.status === "verified") {
        // Path A
        setPathType("A");
        setSites(data.sites || []);
      } else {
        // Path B
        setPathType("B");
      }
      setLoading(false);
    } catch (err) {
      console.error("Identity check error:", err);
      setError("ไม่สามารถตรวจสอบข้อมูลได้");
      setLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    if (sitePassword.length !== 6) {
      alert("กรุณาใส่รหัสผ่าน 6 หลัก");
      return;
    }

    setVerifyingPassword(true);
    try {
      const response = await fetch("/api/checkin/verify-site-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sitePassword,
          lineUserId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPasswordVerified(true);
        setVerifiedSite({
          id: data.site_id,
          name: data.site_name,
        });
        setSelectedSiteId(data.site_id);

        // Fetch guards for this site
        await fetchGuards(data.site_id);
      } else {
        const data = await response.json();
        alert(data.error || "รหัสผ่านไม่ถูกต้อง");
      }
    } catch (err) {
      console.error("Password verification error:", err);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setVerifyingPassword(false);
    }
  };

  const fetchGuards = async (siteId: string) => {
    try {
      const response = await fetch(
        `/api/checkin/guards-by-site?siteId=${siteId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setGuards(data.guards || []);
      }
    } catch (err) {
      console.error("Error fetching guards:", err);
    }
  };

  const handleSiteChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedGuardId("");
    setGuards([]);

    if (siteId) {
      await fetchGuards(siteId);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPhoto(result);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const openCamera = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedGuardId) {
      alert("กรุณาเลือก รปภ.");
      return;
    }

    if (!photo) {
      alert("กรุณาถ่ายรูป");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: selectedGuardId,
          siteId: selectedSiteId,
          photo,
          lineUserId,
          pathType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert("เช็คอินสำเร็จ!");

        // Close LIFF
        if (liff.isInClient()) {
          liff.closeWindow();
        }
      } else {
        const data = await response.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      console.error("Check-in error:", err);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-xl">กำลังโหลด...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-xl text-red-600">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">เช็คอิน</h1>

        {/* Path A: Verified User */}
        {pathType === "A" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                เลือกไซต์ *
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- เลือกไซต์ --</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Path B: Unverified User */}
        {pathType === "B" && !passwordVerified && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                รหัสผ่านไซต์ (6 หลัก) *
              </label>
              <input
                type="number"
                inputMode="numeric"
                maxLength={6}
                value={sitePassword}
                onChange={(e) => setSitePassword(e.target.value.slice(0, 6))}
                className="w-full px-3 py-2 border rounded-lg text-center text-2xl"
                placeholder="000000"
              />
            </div>
            <button
              onClick={handleVerifyPassword}
              disabled={verifyingPassword || sitePassword.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300"
            >
              {verifyingPassword ? "กำลังตรวจสอบ..." : "ยืนยันรหัสผ่าน"}
            </button>
          </div>
        )}

        {/* Path B: After password verified */}
        {pathType === "B" && passwordVerified && verifiedSite && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-800">
              ✅ ยืนยันรหัสผ่านสำเร็จ
            </div>
            <div className="font-medium">{verifiedSite.name}</div>
          </div>
        )}

        {/* Guard Selection (shown after site selected in Path A or password verified in Path B) */}
        {selectedSiteId && guards.length > 0 && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                เลือก รปภ. *
              </label>
              <select
                value={selectedGuardId}
                onChange={(e) => setSelectedGuardId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- เลือก รปภ. --</option>
                {guards.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.fullName} ({guard.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Camera */}
            <div>
              <label className="block text-sm font-medium mb-2">
                ถ่ายรูป *
              </label>

              {/* Hidden file input - opens camera directly on mobile */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              {!photo && (
                <button
                  onClick={openCamera}
                  className="w-full bg-gray-600 text-white py-4 rounded-lg font-bold text-lg active:bg-gray-700"
                >
                  � ถ่ายรูป
                </button>
              )}

              {photo && (
                <div className="space-y-2">
                  <img
                    src={photo}
                    alt="Captured"
                    className="w-full rounded-lg border"
                  />
                  <button
                    onClick={() => {
                      setPhoto(null);
                    }}
                    className="w-full bg-gray-600 text-white py-2 rounded-lg"
                  >
                    ถ่ายใหม่
                  </button>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!selectedGuardId || !photo || submitting}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg disabled:bg-gray-300"
            >
              {submitting ? "กำลังบันทึก..." : "✅ เช็คอิน"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
