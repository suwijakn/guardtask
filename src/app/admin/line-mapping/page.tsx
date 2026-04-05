"use client";

import { useEffect, useState } from "react";

interface Guard {
  id: string;
  fullName: string;
  employeeCode: string;
}

interface LineMapping {
  id: string;
  lineUserId: string;
  displayName: string | null;
  guardId: string | null;
  isVerified: boolean;
  siteId: string | null;
  mappingMethod: string;
  createdAt: string;
  guard?: {
    id: string;
    fullName: string;
    employeeCode: string;
  } | null;
  site?: {
    id: string;
    name: string;
  } | null;
}

export default function LineMappingPage() {
  const [mappings, setMappings] = useState<LineMapping[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("all");
  const [selectedGuards, setSelectedGuards] = useState<Record<string, string>>(
    {},
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMappings();
    fetchGuards();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/line-mapping");
      if (response.ok) {
        const data = await response.json();
        setMappings(data.mappings || []);
      }
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuards = async () => {
    try {
      const response = await fetch("/api/guards");
      if (response.ok) {
        const data = await response.json();
        setGuards(data.guards || []);
      }
    } catch (error) {
      console.error("Failed to fetch guards:", error);
    }
  };

  const handleApprove = async (id: string, guardId?: string) => {
    const finalGuardId = guardId || selectedGuards[id];

    if (!finalGuardId) {
      alert("กรุณาเลือก Guard ก่อนอนุมัติ");
      return;
    }

    if (!confirm("ยืนยันการอนุมัติการผูก LINE account นี้?")) return;

    try {
      const response = await fetch(`/api/line-mapping/approve/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardId: finalGuardId }),
      });

      if (response.ok) {
        alert("อนุมัติสำเร็จ");
        fetchMappings();
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      alert("เกิดข้อผิดพลาดในการอนุมัติ");
    }
  };

  const handleEdit = async (id: string, newGuardId: string) => {
    if (!confirm("ยืนยันการเปลี่ยน Guard สำหรับ LINE account นี้?")) return;

    try {
      const response = await fetch(`/api/line-mapping/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardId: newGuardId }),
      });

      if (response.ok) {
        alert("แก้ไขสำเร็จ");
        setEditingId(null);
        fetchMappings();
      } else {
        const data = await response.json();
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to edit:", error);
      alert("เกิดข้อผิดพลาดในการแก้ไข");
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("ยืนยันการปฏิเสธการผูก LINE account นี้?")) return;

    try {
      const response = await fetch(`/api/line-mapping/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("ปฏิเสธสำเร็จ");
        fetchMappings();
      } else {
        alert("เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Failed to reject:", error);
      alert("เกิดข้อผิดพลาดในการปฏิเสธ");
    }
  };

  const filteredMappings = mappings.filter((m) => {
    if (filter === "pending") return !m.isVerified;
    if (filter === "verified") return m.isVerified;
    return true;
  });

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "auto_checkin":
        return "เช็คอิน (Path B)";
      case "line_message":
        return "ส่งข้อความ LINE";
      case "admin_link":
        return "ลิงก์จาก Admin";
      default:
        return method;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">ผูก LINE Account</h1>
        <p className="text-gray-600">
          จัดการการผูก LINE account กับข้อมูล รปภ ในระบบ
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded ${
            filter === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          ทั้งหมด ({mappings.length})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded ${
            filter === "pending"
              ? "bg-yellow-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          รอดำเนินการ ({mappings.filter((m) => !m.isVerified).length})
        </button>
        <button
          onClick={() => setFilter("verified")}
          className={`px-4 py-2 rounded ${
            filter === "verified"
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          อนุมัติแล้ว ({mappings.filter((m) => m.isVerified).length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">กำลังโหลด...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LINE Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guard
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  วิธีที่มา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    ไม่มีข้อมูล
                  </td>
                </tr>
              ) : (
                filteredMappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {mapping.displayName || "ไม่ระบุ"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {mapping.lineUserId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.guard ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {mapping.guard.fullName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {mapping.guard.employeeCode}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">รอเลือก</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mapping.site?.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {getMethodLabel(mapping.mappingMethod)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.isVerified ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          ✅ Verified
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          🟡 Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!mapping.isVerified ? (
                        <div className="space-y-2">
                          <select
                            className="w-full px-2 py-1 border rounded text-sm"
                            value={selectedGuards[mapping.id] || ""}
                            onChange={(e) =>
                              setSelectedGuards({
                                ...selectedGuards,
                                [mapping.id]: e.target.value,
                              })
                            }
                          >
                            <option value="" disabled>
                              เลือก Guard *
                            </option>
                            {guards.map((guard) => (
                              <option key={guard.id} value={guard.id}>
                                {guard.fullName} ({guard.employeeCode})
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(mapping.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleReject(mapping.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      ) : editingId === mapping.id ? (
                        <div className="space-y-2">
                          <select
                            className="w-full px-2 py-1 border rounded text-sm"
                            value={
                              selectedGuards[mapping.id] ||
                              mapping.guardId ||
                              ""
                            }
                            onChange={(e) =>
                              setSelectedGuards({
                                ...selectedGuards,
                                [mapping.id]: e.target.value,
                              })
                            }
                          >
                            {guards.map((guard) => (
                              <option key={guard.id} value={guard.id}>
                                {guard.fullName} ({guard.employeeCode})
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleEdit(
                                  mapping.id,
                                  selectedGuards[mapping.id] ||
                                    mapping.guardId ||
                                    "",
                                )
                              }
                              className="text-blue-600 hover:text-blue-900"
                            >
                              💾 Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              ❌ Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingId(mapping.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
