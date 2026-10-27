
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import DraftQueue from "@/components/DraftQueue";
import ImageLightbox from "@/components/ImageLightbox";
import { ActionToast, ConfirmationDialog, useConfirmation } from "@/components/ActionFeedback";
import WorkStatusToggle from "@/components/WorkStatusToggle";
import { readGoogleSettings } from "@/lib/googleSettings";
import {
  deleteDraft as deleteStoredDraft,
  deleteDrafts as deleteStoredDrafts,
  deleteTemplate as deleteStoredTemplate,
  getSavedDrafts,
  getSavedTemplates,
  saveDraft as saveStoredDraft,
  saveTemplate as saveStoredTemplate,
} from "@/lib/draftStorage";

function todayAsInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyForm() {
  const today = todayAsInputValue();
  return {
    namaAplikasiDaerah: "",
    menu: "",
    tglMulai: today,
    permasalahan: "",
    solusi: "",
    tglSelesai: today,
    keterangan: "",
  };
}

const emptyForm = createEmptyForm();

const monthFormatter = new Intl.DateTimeFormat("id-ID", { month: "long" });
const displayDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

function toDisplayDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function dateFromInputValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getMonthSheetName(value) {
  if (!value) return "Pilih tanggal mulai";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const monthName = monthFormatter.format(date);
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}_${year}`;
}

function getTemplateApplicationName(template) {
  return typeof template.fields?.namaAplikasiDaerah === "string"
    ? template.fields.namaAplikasiDaerah.trim()
    : "";
}

export default function LogForm() {
  const { data: session } = useSession();
  const [form, setForm] = useState(createEmptyForm);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState("");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [worklogs, setWorklogs] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState({ loading: false, error: "" });
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [images, setImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const { confirm, confirmation, acceptConfirmation, cancelConfirmation } = useConfirmation();
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingDrafts, setSendingDrafts] = useState(false);
  const [sendProgress, setSendProgress] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [hourlySchedule, setHourlySchedule] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState(["12:00", "18:00", "00:00"]);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [batchMessage, setBatchMessage] = useState(null);
  const dropRef = useRef(null);
  const imageInputRef = useRef(null);
  const sendingRef = useRef(false);

  async function addImageFiles(files) {
    const acceptedTypes = ["image/png", "image/jpeg", "image/webp"];
    const nextImages = [];
    const errors = [];

    for (const file of files) {
      if (!acceptedTypes.includes(file.type)) {
        errors.push(`${file.name}: gunakan gambar PNG, JPEG, atau WebP.`);
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        errors.push(`${file.name}: ukuran gambar maksimal 8 MB.`);
        continue;
      }

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error(`Gagal membaca gambar ${file.name}.`));
        reader.readAsDataURL(file);
      }).catch((error) => {
        errors.push(error.message || `Gagal membaca gambar ${file.name}.`);
        return null;
      });

      if (dataUrl) {
        nextImages.push({
          id: crypto.randomUUID(),
          dataUrl,
          previewUrl: dataUrl,
          fileName: file.name,
        });
      }
    }

    if (nextImages.length) {
      setImages((current) => [...current, ...nextImages]);
    }
    setMessage(errors.length
      ? { type: "error", text: errors.join(" ") }
      : nextImages.length
        ? { type: "success", text: `${nextImages.length} gambar siap dilampirkan.` }
        : null);
  }

  useEffect(() => {
    getSavedDrafts()
      .then((savedDrafts) => {
        setDrafts(savedDrafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      })
      .catch((error) => {
        setBatchMessage({ type: "error", text: error.message || "Draft tidak dapat dibaca." });
      })
      .finally(() => setDraftsLoaded(true));
  }, []);

  useEffect(() => {
    const email = session?.user?.email;
    setScheduleLoaded(false);
    if (!email) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`daily-worklog-auto-send:${email.toLowerCase()}`) || "null");
      if (saved) {
        setScheduleEnabled(saved.version >= 2 ? Boolean(saved.enabled) : true);
        setHourlySchedule(Boolean(saved.hourly));
        setScheduleTimes(Array.isArray(saved.times) ? saved.times.filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) : ["12:00", "18:00", "00:00"]);
      }
    } catch (error) {
      console.error("Gagal membaca jadwal pengiriman lokal.", error);
    }
    setScheduleLoaded(true);
  }, [session?.user?.email]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!scheduleLoaded || !email) return;
    localStorage.setItem(`daily-worklog-auto-send:${email.toLowerCase()}`, JSON.stringify({
      version: 2,
      enabled: scheduleEnabled,
      hourly: hourlySchedule,
      times: scheduleTimes,
    }));
  }, [hourlySchedule, scheduleEnabled, scheduleLoaded, scheduleTimes, session?.user?.email]);

  useEffect(() => {
    let cancelled = false;
    getSavedTemplates()
      .then((savedTemplates) => {
        if (!cancelled) {
          setTemplates(savedTemplates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
        }
      })
      .catch((error) => {
        if (!cancelled) setTemplateError(error.message || "Template tidak dapat dibaca.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const settings = readGoogleSettings(session?.user?.email);
    if (!settings?.spreadsheetId) {
      setWorklogs([]);
      setRecommendationStatus({ loading: false, error: "Selesaikan setup Google untuk memakai rekomendasi spreadsheet." });
      return () => { cancelled = true; };
    }

    setRecommendationStatus({ loading: true, error: "" });
    apiFetch(`/api/dashboard?spreadsheetId=${encodeURIComponent(settings.spreadsheetId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Rekomendasi spreadsheet gagal dimuat.");
        if (!Array.isArray(data.worklogs)) throw new Error("Format data rekomendasi spreadsheet tidak valid.");
        return data.worklogs;
      })
      .then((loadedWorklogs) => {
        if (!cancelled) {
          setWorklogs(loadedWorklogs);
          setRecommendationStatus({ loading: false, error: "" });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorklogs([]);
          setRecommendationStatus({
            loading: false,
            error: error.message || "Rekomendasi spreadsheet gagal dimuat.",
          });
        }
      });

    return () => { cancelled = true; };
  }, [session?.user?.email]);

  useEffect(() => {
    function handlePaste(event) {
      const items = event.clipboardData?.items || [];
      const pastedFiles = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length) {
        event.preventDefault();
        void addImageFiles(pastedFiles);
      }
    }

    const node = dropRef.current;
    node?.addEventListener("paste", handlePaste);
    return () => node?.removeEventListener("paste", handlePaste);
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function hasFormContent() {
    return Object.values(form).some(Boolean) || images.length > 0;
  }

  async function handleClearForm() {
    if (hasFormContent() && !(await confirm({
      title: "Kosongkan form?",
      message: "Semua isian dan gambar dari form saat ini akan dihapus. Draft yang sudah tersimpan tetap aman.",
      confirmLabel: "Kosongkan form",
      danger: true,
    }))) return;
    setForm(createEmptyForm());
    setImages([]);
    setEditingDraftId(null);
    setEditingTemplateId(null);
    setTemplateName("");
    setShowTemplateForm(false);
    setMessage({ type: "success", text: "Form berhasil dikosongkan." });
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  const spreadsheetSuggestions = useMemo(() => ({
    namaAplikasiDaerah: [...new Set(worklogs.map((item) => item.aplikasi).filter(Boolean))],
    menu: [...new Set(worklogs.map((item) => item.menu).filter(Boolean))],
    permasalahan: [...new Set(worklogs.map((item) => item.permasalahan).filter(Boolean))],
    solusi: [...new Set(worklogs.map((item) => item.solusi).filter(Boolean))],
    keterangan: [...new Set(worklogs.map((item) => item.keterangan).filter(Boolean))],
  }), [worklogs]);
  async function handleSaveTemplate() {
    const name = templateName.trim();
    const fields = {
      namaAplikasiDaerah: form.namaAplikasiDaerah,
      menu: form.menu,
      permasalahan: form.permasalahan,
      solusi: form.solusi,
      keterangan: form.keterangan,
    };
    if (!name) {
      setMessage({ type: "error", text: "Beri nama template terlebih dahulu." });
      return;
    }
    if (!Object.values(fields).some((value) => value.trim())) {
      setMessage({ type: "error", text: "Isi setidaknya satu informasi pekerjaan sebelum menyimpan template." });
      return;
    }

    setSavingTemplate(true);
    setTemplateError("");
    try {
      const now = new Date().toISOString();
      const existingTemplate = templates.find((item) => item.id === editingTemplateId);
      const template = {
        id: editingTemplateId || crypto.randomUUID(),
        name,
        fields,
        createdAt: existingTemplate?.createdAt || now,
        updatedAt: now,
      };
      await saveStoredTemplate(template);
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      setSelectedTemplateId(template.id);
      setEditingTemplateId(null);
      setTemplateName("");
      setShowTemplateForm(false);
      setMessage({
        type: "success",
        text: `Template “${name}” ${existingTemplate ? "berhasil diperbarui" : "tersimpan"} di browser ini.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Template gagal disimpan." });
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleLoadTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    const formHasContent = hasFormContent();
    if (formHasContent && !(await confirm({
      title: "Ganti isi form?",
      message: "Form saat ini belum disimpan. Isinya akan diganti dengan template yang dipilih.",
      confirmLabel: "Muat template",
    }))) return;

    setForm({
      ...createEmptyForm(),
      ...template.fields,
    });
    setImages([]);
    setEditingDraftId(null);
    setEditingTemplateId(null);
    setTemplateName("");
    setShowTemplateForm(false);
    setMessage({ type: "success", text: `Template “${template.name}” dimuat. Tanggal otomatis diisi hari ini dan tetap dapat diubah.` });
  }

  async function handleEditTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    if (hasFormContent() && !(await confirm({
      title: "Ganti isi form?",
      message: "Form saat ini belum disimpan. Isinya akan diganti dengan template yang akan diedit.",
      confirmLabel: "Edit template",
    }))) return;

    setForm({ ...createEmptyForm(), ...template.fields });
    setImages([]);
    setEditingDraftId(null);
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setShowTemplateForm(true);
    setMessage({ type: "info", text: "Ubah nama template di panel ini dan isinya pada kolom aktivitas, lalu simpan perubahan." });
  }

  function handleCancelTemplateEdit() {
    setEditingTemplateId(null);
    setTemplateName("");
    setShowTemplateForm(false);
  }

  async function handleDeleteTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template || !(await confirm({
      title: "Hapus template?",
      message: `Template “${template.name}” akan dihapus dari browser ini.`,
      confirmLabel: "Hapus template",
      danger: true,
    }))) return;
    setMessage({ type: "progress", text: `Menghapus template “${template.name}”...` });
    try {
      await deleteStoredTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setSelectedTemplateId("");
      if (editingTemplateId === template.id) handleCancelTemplateEdit();
      setMessage({ type: "success", text: `Template “${template.name}” berhasil dihapus.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Template gagal dihapus." });
    }
  }

  const requiredFields = [
    form.namaAplikasiDaerah,
    form.menu,
    form.tglMulai,
    form.permasalahan,
    form.solusi,
  ];
  const requiredCount = requiredFields.filter((value) => String(value).trim()).length;
  const progress = (requiredCount / requiredFields.length) * 100;
  const dateError = form.tglMulai && form.tglSelesai && form.tglSelesai < form.tglMulai
    ? "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
    : "";
  const monthSheetName = getMonthSheetName(form.tglMulai);
  const startDate = dateFromInputValue(form.tglMulai);
  const endDate = dateFromInputValue(form.tglSelesai);
  const formReady = requiredCount === requiredFields.length && !dateError;

  async function handleSaveDraft(event) {
    event.preventDefault();
    if (editingTemplateId) {
      setMessage({ type: "error", text: "Simpan atau batalkan perubahan template terlebih dahulu." });
      return;
    }
    if (!formReady) {
      setMessage({
        type: "error",
        text: dateError || "Semua kolom wajib diisi kecuali Keterangan.",
      });
      return;
    }
    if (dateError) {
      setMessage({ type: "error", text: dateError });
      return;
    }

    setSavingDraft(true);
    setMessage(null);

    try {
      const previousDraft = drafts.find((draft) => draft.id === editingDraftId);
      const now = new Date().toISOString();
      const draft = {
        ...form,
        id: editingDraftId || crypto.randomUUID(),
        createdAt: previousDraft?.createdAt || now,
        updatedAt: now,
        images: images.map(({ dataUrl, fileName }) => ({ dataUrl, fileName })),
      };
      await saveStoredDraft(draft);
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setMessage({
        type: "success",
        text: editingDraftId ? "Perubahan draft tersimpan di browser ini." : "Draft tersimpan di browser ini; spreadsheet belum berubah.",
      });
      setForm(createEmptyForm());
      setImages([]);
      setEditingDraftId(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Draft gagal disimpan." });
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleEditDraft(draft) {
    const formHasContent = hasFormContent();
    if (formHasContent && !(await confirm({
      title: "Ganti isi form?",
      message: "Form saat ini belum disimpan. Isinya akan diganti dengan draft yang dipilih.",
      confirmLabel: "Muat draft",
    }))) return;
    setForm(Object.fromEntries(Object.keys(emptyForm).map((field) => [field, draft[field] || ""])));
    const savedImages = draft.images || (draft.imageDataUrl ? [draft.imageDataUrl] : []);
    setImages(savedImages.map((image) => {
      const dataUrl = typeof image === "string" ? image : image.dataUrl;
      return {
        id: crypto.randomUUID(),
        dataUrl,
        previewUrl: dataUrl,
        fileName: typeof image === "string" ? "bukti.png" : image.fileName,
      };
    }));
    setEditingDraftId(draft.id);
    setEditingTemplateId(null);
    setTemplateName("");
    setShowTemplateForm(false);
    setMessage({ type: "success", text: "Draft dimuat untuk diedit. Simpan perubahan untuk memperbaruinya." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteDraft(id) {
    setBatchMessage({ type: "progress", text: "Menghapus draft dari penyimpanan browser..." });
    try {
      await deleteStoredDraft(id);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setSelectedDraftIds((current) => current.filter((selectedId) => selectedId !== id));
      setBatchMessage({ type: "success", text: "Draft berhasil dihapus." });
      if (editingDraftId === id) {
        setEditingDraftId(null);
        setForm(createEmptyForm());
        setImages([]);
        setMessage(null);
      }
    } catch (error) {
      setBatchMessage({ type: "error", text: error.message || "Draft gagal dihapus." });
    }
  }

  function toggleDraftSelection(id) {
    setSelectedDraftIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
    setBatchMessage(null);
  }

  function toggleAllDrafts() {
    setSelectedDraftIds(selectedDraftIds.length === drafts.length ? [] : drafts.map((draft) => draft.id));
    setBatchMessage(null);
  }

  async function handleSendSelected(draftIds = selectedDraftIds) {
    const requestedDraftIds = Array.isArray(draftIds) ? draftIds : selectedDraftIds;
    const selectedDrafts = drafts.filter((draft) => requestedDraftIds.includes(draft.id));
    if (!selectedDrafts.length) return;
    const googleSettings = readGoogleSettings(session?.user?.email);
    if (!googleSettings?.spreadsheetId) {
      setBatchMessage({
        type: "error",
        text: "Atur link spreadsheet terlebih dahulu di menu Setup Google.",
      });
      return;
    }
    const hasImages = selectedDrafts.some((draft) =>
      (draft.images || (draft.imageDataUrl ? [draft.imageDataUrl] : [])).length > 0
    );
    if (hasImages && !googleSettings.folderId) {
      setBatchMessage({
        type: "error",
        text: "Atur link folder Drive di menu Setup Google untuk mengirim laporan yang memiliki bukti gambar.",
      });
      return;
    }
    if (selectedDrafts.length > 100) {
      setBatchMessage({ type: "error", text: "Kirim maksimal 100 laporan dalam satu batch." });
      return;
    }

    const invalidDraft = selectedDrafts.find((draft) =>
      !draft.namaAplikasiDaerah?.trim() || !draft.menu?.trim() ||
      !draft.tglMulai ||
      !draft.permasalahan?.trim() || !draft.solusi?.trim() ||
      (draft.tglSelesai && draft.tglSelesai < draft.tglMulai)
    );
    if (invalidDraft) {
      setBatchMessage({
        type: "error",
        text: `Draft “${invalidDraft.namaAplikasiDaerah || "Tanpa nama"}” belum lengkap. Semua kolom wajib diisi kecuali Keterangan.`,
      });
      return;
    }

    if (sendingRef.current) return;
    sendingRef.current = true;
    setSendingDrafts(true);
    setBatchMessage(null);
    let preparedCount = 0;

    try {
      setSendProgress(`Menyiapkan 0 dari ${selectedDrafts.length} laporan...`);
      const entries = await mapWithConcurrency(selectedDrafts, 3, async (draft) => {
        const draftImages = draft.images || (draft.imageDataUrl ? [draft.imageDataUrl] : []);
        const imageUrls = await mapWithConcurrency(draftImages, 1, async (image) => {
          const dataUrl = typeof image === "string" ? image : image.dataUrl;
          const uploadResponse = await apiFetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl,
              fileName: typeof image === "string" ? "bukti.png" : image.fileName || "bukti.png",
              folderId: googleSettings.folderId,
            }),
          });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(uploadData.error || "Bukti gagal diunggah.");
          if (!uploadData.url) throw new Error("Upload berhasil tetapi tautan gambar tidak diterima.");
          return uploadData.url;
        });
        preparedCount += 1;
        setSendProgress(`Menyiapkan ${preparedCount} dari ${selectedDrafts.length} laporan...`);
        return {
          namaAplikasiDaerah: draft.namaAplikasiDaerah,
          menu: draft.menu,
          tglMulai: toDisplayDate(draft.tglMulai),
          permasalahan: draft.permasalahan,
          solusi: draft.solusi,
          tglSelesai: toDisplayDate(draft.tglSelesai),
          keterangan: draft.keterangan,
          imageUrls,
        };
      });

      setSendProgress(`Mengirim ${entries.length} laporan ke spreadsheet...`);
      const response = await apiFetch("/api/log/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, spreadsheetId: googleSettings.spreadsheetId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pengiriman batch gagal.");

      const sentIds = selectedDrafts.map((draft) => draft.id);
      await deleteStoredDrafts(sentIds);
      setDrafts((current) => current.filter((draft) => !sentIds.includes(draft.id)));
      window.dispatchEvent(new Event("daily-worklog:counts-updated"));
      setSelectedDraftIds((current) => current.filter((id) => !sentIds.includes(id)));
      setBatchMessage({
        type: "success",
        text: `${data.count} laporan berhasil dikirim ke ${data.sheets.map((sheet) => sheet.sheetName).join(", ")}.${data.borderWarning ? ` ${data.borderWarning}` : ""}`,
      });
    } catch (error) {
      setBatchMessage({ type: "error", text: error.message || "Gagal mengirim laporan." });
    } finally {
      setSendingDrafts(false);
      setSendProgress("");
      sendingRef.current = false;
    }
  }

  useEffect(() => {
    const email = session?.user?.email;
    if (!email || !scheduleEnabled || !scheduleLoaded || !draftsLoaded) return;

    function checkSchedule() {
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const timeKey = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const due = scheduleTimes.includes(timeKey) || (hourlySchedule && now.getMinutes() === 0);
      if (!due || !drafts.length || sendingRef.current) return;

      const lastRunKey = `daily-worklog-auto-send:last:${email.toLowerCase()}`;
      const slotKey = `${dateKey}T${timeKey}`;
      if (localStorage.getItem(lastRunKey) === slotKey) return;
      localStorage.setItem(lastRunKey, slotKey);
      setBatchMessage({ type: "progress", text: `Jadwal ${timeKey}: menyiapkan seluruh antrean lokal...` });
      void handleSendSelected(drafts.map((draft) => draft.id));
    }

    checkSchedule();
    const timer = window.setInterval(checkSchedule, 15000);
    return () => window.clearInterval(timer);
  }, [drafts, draftsLoaded, hourlySchedule, scheduleEnabled, scheduleLoaded, scheduleTimes, session?.user?.email]);

  const normalizedTemplateSearch = templateSearch.trim().toLocaleLowerCase("id-ID");
  const filteredTemplates = templates.filter((template) => {
    const applicationName = getTemplateApplicationName(template);
    const searchableText = `${template.name} ${applicationName}`.toLocaleLowerCase("id-ID");
    return searchableText.includes(normalizedTemplateSearch) || template.id === editingTemplateId;
  });
  const templatesByApplication = filteredTemplates.reduce((groups, template) => {
    const applicationName = getTemplateApplicationName(template);
    const groupName = applicationName || "Tanpa nama aplikasi";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(template);
    return groups;
  }, new Map());
  const sortedTemplateGroups = [...templatesByApplication.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "id-ID"));

  return (
    <>
      <div className="worklog-layout">
      <form ref={dropRef} tabIndex={0} onSubmit={handleSaveDraft} className="worklog-form">
        <div className="form-heading">
          <div>
            <div className="form-kicker"><span>01</span> {editingDraftId ? "Edit draft" : "Laporan baru"}</div>
            <h2>{editingDraftId ? "Perbarui laporan" : "Catat aktivitas"}</h2>
          </div>
          <div className="completion-count" aria-live="polite">
            <strong>{requiredCount}/{requiredFields.length}</strong>
            <span>data wajib</span>
          </div>
        </div>

        <div className="progress-track" aria-label={`${requiredCount} dari ${requiredFields.length} data wajib terisi`}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <section className="template-panel" aria-labelledby="template-heading">
          <div className="template-panel-heading">
            <div>
              <h3 id="template-heading">Template pekerjaan</h3>
              <p>Simpan dan gunakan kembali isi pekerjaan yang sering berulang.</p>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                if (editingTemplateId) {
                  handleCancelTemplateEdit();
                  return;
                }
                setTemplateName([form.namaAplikasiDaerah, form.menu].filter(Boolean).join(" - "));
                setShowTemplateForm((visible) => !visible);
              }}
            >
              {editingTemplateId ? "Batal edit" : showTemplateForm ? "Tutup" : "Simpan form"}
            </button>
          </div>
          <div className="template-search">
            <input
              className="field-control"
              type="search"
              value={templateSearch}
              onChange={(event) => {
                const nextSearch = event.target.value;
                setTemplateSearch(nextSearch);
                const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
                if (selectedTemplate) {
                  const searchText = `${selectedTemplate.name} ${getTemplateApplicationName(selectedTemplate)}`.toLocaleLowerCase("id-ID");
                  if (!searchText.includes(nextSearch.trim().toLocaleLowerCase("id-ID"))) {
                    setSelectedTemplateId("");
                  }
                }
              }}
              aria-label="Cari template berdasarkan nama template atau aplikasi"
              placeholder="Cari nama template atau aplikasi..."
              disabled={Boolean(editingTemplateId)}
            />
            <p role="status">
              {normalizedTemplateSearch
                ? `${filteredTemplates.length} template ditemukan`
                : `${templates.length} template tersimpan`}
            </p>
          </div>
          <div className="template-controls">
            <select
              className="field-control"
              aria-label="Pilih template pekerjaan"
              value={selectedTemplateId}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                if (editingTemplateId) handleCancelTemplateEdit();
              }}
            >
              <option value="">
                {filteredTemplates.length
                  ? `Pilih template (${filteredTemplates.length})`
                  : normalizedTemplateSearch
                    ? "Tidak ada template yang cocok"
                    : "Belum ada template tersimpan"}
              </option>
              {sortedTemplateGroups.map(([applicationName, groupTemplates]) => (
                <optgroup key={applicationName} label={applicationName}>
                  {groupTemplates
                    .sort((left, right) => left.name.localeCompare(right.name, "id-ID"))
                    .map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
            <button className="text-button" type="button" onClick={handleLoadTemplate} disabled={!selectedTemplateId}>
              Gunakan
            </button>
            <button className="text-button" type="button" onClick={() => void handleEditTemplate()} disabled={!selectedTemplateId}>
              Edit
            </button>
            <button
              className="remove-button"
              type="button"
              onClick={() => void handleDeleteTemplate()}
              disabled={!selectedTemplateId}
            >
              Hapus
            </button>
          </div>
          {showTemplateForm && (
            <div className="template-save-form">
              <input
                className="field-control"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                aria-label="Nama template"
                placeholder="Nama template, misalnya Pemeliharaan aplikasi"
                maxLength={100}
              />
              <button
                className="text-button"
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate}
              >
                {savingTemplate ? "Menyimpan..." : editingTemplateId ? "Simpan perubahan" : "Simpan template"}
              </button>
            </div>
          )}
          {editingTemplateId && <p className="template-edit-hint">Edit isi template melalui kolom aktivitas di bawah.</p>}
          {templateError && <p className="field-error" role="alert">{templateError}</p>}
        </section>

        <section className="form-section">
          <div className="section-heading">
            <span className="section-index">01</span>
            <div>
              <h3>Aktivitas</h3>
              <p>Informasi inti laporan{recommendationStatus.loading ? " · memuat rekomendasi..." : ""}</p>
            </div>
          </div>

          <div className="field-grid">
            <SpreadsheetField
              id="application-field"
              label="Nama Aplikasi & Daerah"
              required
              value={form.namaAplikasiDaerah}
              suggestions={spreadsheetSuggestions.namaAplikasiDaerah}
              onChange={(value) => update("namaAplikasiDaerah", value)}
              placeholder="Contoh: Siskeudes TNT Persepsi"
            />
            <SpreadsheetField
              id="menu-field"
              label="Menu"
              required
              value={form.menu}
              suggestions={spreadsheetSuggestions.menu}
              onChange={(value) => update("menu", value)}
              placeholder="Menu atau modul yang ditangani"
            />
          </div>
          {recommendationStatus.error && (
            <p className="recommendation-note" role="status">{recommendationStatus.error}</p>
          )}
        </section>

        <section className="form-section">
          <div className="section-heading section-heading-spread">
            <div className="section-title-group">
              <span className="section-index">02</span>
              <div>
                <h3>Waktu pekerjaan</h3>
                <p>Tanggal otomatis diisi hari ini dan dapat diubah</p>
              </div>
            </div>
          </div>

          <WorkStatusToggle
            value={form.tglSelesai ? "completed" : "pending"}
            onChange={(status) => {
              const today = todayAsInputValue();
              update(
                "tglSelesai",
                status === "pending"
                  ? ""
                  : form.tglSelesai || (form.tglMulai > today ? form.tglMulai : today)
              );
            }}
          />
          <div className="field-grid">
            <Field label="Tanggal mulai" required>
              <input
                className="field-control"
                type="date"
                value={form.tglMulai}
                onChange={(event) => update("tglMulai", event.target.value)}
                required
              />
            </Field>
            <Field label="Tanggal selesai">
              <input
                className="field-control"
                type="date"
                value={form.tglSelesai}
                onChange={(event) => update("tglSelesai", event.target.value)}
                min={form.tglMulai || undefined}
                aria-invalid={Boolean(dateError)}
              />
            </Field>
          </div>
          {!form.tglSelesai && <p className="recommendation-note">Laporan berstatus Tertunda sampai tanggal selesai diisi.</p>}
          {dateError && <p className="field-error" role="alert">{dateError}</p>}
        </section>

        <section className="form-section">
          <div className="section-heading">
            <span className="section-index">03</span>
            <div>
              <h3>Catatan pekerjaan</h3>
              <p>Masalah, tindak lanjut, dan bukti</p>
            </div>
          </div>

          <div className="field-grid">
            <SpreadsheetField
              id="issue-field"
              label="Permasalahan yang dihadapi"
              required
              multiline
              rows={3}
              value={form.permasalahan}
              suggestions={spreadsheetSuggestions.permasalahan}
              onChange={(value) => update("permasalahan", value)}
              placeholder="Ceritakan kendala atau kebutuhan yang ditemukan"
            />
            <SpreadsheetField
              id="solution-field"
              label="Solusi / tindak lanjut"
              required
              multiline
              rows={3}
              value={form.solusi}
              suggestions={spreadsheetSuggestions.solusi}
              onChange={(value) => update("solusi", value)}
              placeholder="Tuliskan tindakan yang dilakukan"
            />
          </div>

          <SpreadsheetField
            id="notes-field"
            label="Keterangan"
            multiline
            rows={2}
            value={form.keterangan}
            suggestions={spreadsheetSuggestions.keterangan}
            onChange={(value) => update("keterangan", value)}
            placeholder="Catatan tambahan"
          />

          <div className="image-attachments">
            <input
              ref={imageInputRef}
              className="image-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => {
                void addImageFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
            <button type="button" className="text-button" onClick={() => imageInputRef.current?.click()}>
              Tambah gambar
            </button>
            <span className="attachment-hint">Bisa pilih beberapa file atau paste gambar berulang kali.</span>
            {images.map((image, index) => (
              <div className="attachment-preview" key={image.id}>
                <button
                  type="button"
                  className="image-preview-trigger"
                  onClick={() => setPreviewImage({
                    src: image.previewUrl,
                    alt: `Pratinjau bukti pekerjaan ${index + 1}`,
                  })}
                  aria-label={`Perbesar bukti pekerjaan ${index + 1}`}
                >
                  <img src={image.previewUrl} alt={`Pratinjau bukti pekerjaan ${index + 1}`} />
                </button>
                <span>{image.fileName || `Bukti ${index + 1}`} siap dilampirkan</span>
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => setImages((current) => current.filter((item) => item.id !== image.id))}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </section>

        <ActionToast
          message={savingDraft
            ? { type: "progress", text: editingDraftId ? "Menyimpan perubahan draft..." : "Menyimpan draft..." }
            : savingTemplate
              ? { type: "progress", text: "Menyimpan template..." }
              : message || (templateError ? { type: "error", text: templateError } : null)}
          onClose={() => {
            setMessage(null);
            setTemplateError("");
          }}
        />

        <div className="form-footer">
          <span className="save-hint">
            {formReady ? "Siap disimpan" : "Lengkapi semua kolom wajib; tanggal selesai dan Keterangan opsional"}
          </span>
          <div className="form-footer-actions">
            <button type="button" className="clear-form-button" onClick={handleClearForm} disabled={savingDraft}>
              Clear all
            </button>
            <button className="submit-button" type="submit" disabled={!formReady || savingDraft} aria-busy={savingDraft}>
              {savingDraft ? "Menyimpan draft..." : editingDraftId ? "Perbarui draft" : "Simpan sementara"}
            </button>
          </div>
        </div>
      </form>

      <aside className="entry-summary" aria-live="polite">
        <div className="summary-head">
          <div>
            <span className="summary-eyebrow">Pratinjau</span>
            <h2>Pratinjau lengkap</h2>
          </div>
          <span className="summary-symbol" aria-hidden="true">WL</span>
        </div>

        <div className="target-sheet">
          <span>Sheet tujuan</span>
          <strong>{monthSheetName}</strong>
          <span className="sheet-service"><i /> Google Sheets</span>
        </div>

        <dl className="summary-details">
          <div>
            <dt>Aplikasi & daerah</dt>
            <dd>{form.namaAplikasiDaerah || "Belum diisi"}</dd>
          </div>
          <div>
            <dt>Menu</dt>
            <dd>{form.menu || "Belum diisi"}</dd>
          </div>
          <div>
            <dt>Rentang tanggal</dt>
            <dd>
              {startDate ? displayDateFormatter.format(startDate) : "Belum dipilih"}
              {endDate ? ` – ${displayDateFormatter.format(endDate)}` : " – Tertunda"}
            </dd>
          </div>
        </dl>

        <div className="summary-long-field">
          <span>Permasalahan</span>
          <p>{form.permasalahan || "Belum diisi"}</p>
        </div>
        <div className="summary-long-field">
          <span>Solusi</span>
          <p>{form.solusi || "Belum diisi"}</p>
        </div>
        <div className="summary-long-field">
          <span>Keterangan</span>
          <p>{form.keterangan || "Belum diisi"}</p>
        </div>
        {images.length > 0 && (
          <div className="summary-image">
            <span>{images.length} bukti terlampir</span>
            <div className="summary-image-list">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className="image-preview-trigger"
                  onClick={() => setPreviewImage({
                    src: image.previewUrl,
                    alt: `Pratinjau bukti laporan ${index + 1}`,
                  })}
                  aria-label={`Perbesar bukti laporan ${index + 1}`}
                >
                  <img src={image.previewUrl} alt={`Pratinjau bukti laporan ${index + 1}`} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="summary-progress">
          <div className="summary-progress-label">
            <span>Kelengkapan</span>
            <strong>{requiredCount} dari {requiredFields.length}</strong>
          </div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="summary-note">
          <span className="note-indicator" />
          {dateError || (formReady ? "Lengkap dan siap disimpan sebagai draft." : "Lengkapi data wajib untuk menyimpan draft.")}
        </div>
      </aside>
      </div>
      <DraftQueue
        drafts={drafts}
        draftsLoaded={draftsLoaded}
        selectedDraftIds={selectedDraftIds}
        sendingDrafts={sendingDrafts}
        sendProgress={sendProgress}
        batchMessage={batchMessage}
        onToggleDraft={toggleDraftSelection}
        onToggleAll={toggleAllDrafts}
        onSendSelected={handleSendSelected}
        scheduleEnabled={scheduleEnabled}
        hourlySchedule={hourlySchedule}
        scheduleTimes={scheduleTimes}
        onScheduleEnabledChange={setScheduleEnabled}
        onHourlyScheduleChange={setHourlySchedule}
        onScheduleTimesChange={setScheduleTimes}
        scheduleLoaded={scheduleLoaded}
        onEditDraft={handleEditDraft}
        onDeleteDraft={handleDeleteDraft}
      />
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
      <ConfirmationDialog
        {...confirmation}
        onConfirm={acceptConfirmation}
        onCancel={cancelConfirmation}
      />
    </>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {required && <span className="required-mark">*</span>}
      </span>
      {children}
    </label>
  );
}

function SpreadsheetField({
  id,
  label,
  required = false,
  multiline = false,
  rows,
  value,
  suggestions,
  onChange,
  placeholder,
}) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matchingSuggestions = value.trim().length < 2
    ? []
    : [...new Set(suggestions.filter((suggestion) =>
      suggestion.toLocaleLowerCase("id-ID").includes(value.trim().toLocaleLowerCase("id-ID")) &&
      suggestion.toLocaleLowerCase("id-ID") !== value.trim().toLocaleLowerCase("id-ID")
    ))].slice(0, 5);
  const showSuggestions = focused && matchingSuggestions.length > 0;

  function selectSuggestion(suggestion) {
    onChange(suggestion);
    setFocused(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (!showSuggestions) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matchingSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? matchingSuggestions.length - 1 : current - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(matchingSuggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      <div className="suggestion-anchor">
        {multiline ? (
          <textarea
            id={id}
            className="field-control field-textarea"
            rows={rows}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={`${id}-suggestions`}
            aria-activedescendant={activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined}
          />
        ) : (
          <input
            id={id}
            className="field-control"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required={required}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={`${id}-suggestions`}
            aria-activedescendant={activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined}
          />
        )}
        {showSuggestions && (
          <div className="suggestion-list" id={`${id}-suggestions`} role="listbox" aria-label={`Saran ${label}`}>
            {matchingSuggestions.map((suggestion, index) => (
              <button
                className={`suggestion-option${index === activeIndex ? " is-active" : ""}`}
                id={`${id}-suggestion-${index}`}
                key={suggestion}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}