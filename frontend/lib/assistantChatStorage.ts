type ImageMessage = { id: string; images?: string[] };
type StoredImageMessage = { accountKey: string; messageId: string; images: Blob[] };

const DATABASE_NAME = "metratc-assistant-chat";
const DATABASE_VERSION = 1;
const IMAGE_STORE = "images";

let writeQueue = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(IMAGE_STORE, { keyPath: ["accountKey", "messageId"] });
      store.createIndex("accountKey", "accountKey", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open assistant image storage."));
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const match = /^data:([^;,]+);base64$/i.exec(dataUrl.slice(0, comma));
  if (comma < 0 || !match) throw new Error("Invalid image data URL.");

  const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read stored assistant image."));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read stored assistant image."));
    reader.readAsDataURL(blob);
  });
}

export async function loadAssistantImages(accountKey: string): Promise<Record<string, string[]>> {
  const database = await openDatabase();
  try {
    const records = await new Promise<StoredImageMessage[]>((resolve, reject) => {
      const request = database
        .transaction(IMAGE_STORE, "readonly")
        .objectStore(IMAGE_STORE)
        .index("accountKey")
        .getAll(IDBKeyRange.only(accountKey));
      request.onsuccess = () => resolve(request.result as StoredImageMessage[]);
      request.onerror = () => reject(request.error ?? new Error("Unable to load assistant images."));
    });

    const entries = await Promise.all(records.map(async ({ messageId, images }) => [
      messageId,
      await Promise.all(images.map(blobToDataUrl)),
    ] as const));
    return Object.fromEntries(entries);
  } finally {
    database.close();
  }
}

export function saveAssistantImages(accountKey: string, messages: readonly ImageMessage[]): Promise<void> {
  const write = writeQueue.then(async () => {
    const records = await Promise.all(messages
      .filter((message) => typeof message.id === "string" && message.images?.length)
      .map(async (message) => ({
        accountKey,
        messageId: message.id,
        images: await Promise.all(message.images!.map(dataUrlToBlob)),
      })));
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE, "readwrite");
        const store = transaction.objectStore(IMAGE_STORE);
        const request = store.index("accountKey").openCursor(IDBKeyRange.only(accountKey));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save assistant images."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Unable to save assistant images."));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            records.forEach((record) => store.put(record));
          }
        };
      });
    } finally {
      database.close();
    }
  });
  writeQueue = write.then(() => undefined, () => undefined);
  return write;
}
