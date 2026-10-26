const DATABASE_NAME = "daily-worklog-drafts";
const DATABASE_VERSION = 2;
const STORE_NAME = "reports";
const TEMPLATE_STORE_NAME = "templates";

let databasePromise;

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Penyimpanan draft tidak tersedia di browser ini."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
        if (!request.result.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
          request.result.createObjectStore(TEMPLATE_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function transact(mode, run, storeName = STORE_NAME) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    let result;

    if (request) {
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
    }
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Penyimpanan draft dibatalkan."));
  }));
}

export function getSavedDrafts() {
  return transact("readonly", (store) => store.getAll());
}

export function saveDraft(draft) {
  return transact("readwrite", (store) => store.put(draft));
}

export function deleteDraft(id) {
  return transact("readwrite", (store) => store.delete(id));
}

export function deleteDrafts(ids) {
  return transact("readwrite", (store) => {
    ids.forEach((id) => store.delete(id));
    return null;
  });
}

export function getSavedTemplates() {
  return transact("readonly", (store) => store.getAll(), TEMPLATE_STORE_NAME);
}

export function saveTemplate(template) {
  return transact("readwrite", (store) => store.put(template), TEMPLATE_STORE_NAME);
}

export function deleteTemplate(id) {
  return transact("readwrite", (store) => store.delete(id), TEMPLATE_STORE_NAME);
}
