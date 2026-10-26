import { apiFetch } from "@/lib/api";

export async function completeWorklog(worklog, spreadsheetId, completedAt) {
  if (!spreadsheetId) throw new Error("Spreadsheet belum diatur. Selesaikan setup Google terlebih dahulu.");
  if (worklog.tglMulai > completedAt) {
    throw new Error("Tanggal mulai laporan masih di masa depan. Edit tanggal mulai atau selesaikan laporan setelah tanggal tersebut.");
  }

  const response = await apiFetch(`/api/log/${encodeURIComponent(worklog.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      namaAplikasiDaerah: worklog.aplikasi || "",
      menu: worklog.menu || "",
      tglMulai: worklog.tglMulai,
      permasalahan: worklog.permasalahan || "",
      solusi: worklog.solusi || "",
      tglSelesai: completedAt,
      keterangan: worklog.keterangan || "",
      expected: worklog,
      spreadsheetId,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Laporan gagal diselesaikan.");
  return result;
}
