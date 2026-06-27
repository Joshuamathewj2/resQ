import { IncidentLog } from '../types';

const DB_NAME = 'ResQ_Database';
const DB_VERSION = 1;
const STORE_NAME = 'incidents';

let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error');
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export interface IncidentRecord {
  id: string;
  timestamp: string;
  logs: IncidentLog[];
}

export const saveIncident = async (incidentId: string, logs: IncidentLog[]): Promise<void> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const record: IncidentRecord = {
      id: incidentId,
      timestamp: new Date().toISOString(),
      logs
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('Failed to save incident record:', error);
  }
};

export const getAllIncidents = async (): Promise<IncidentRecord[]> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return await new Promise<IncidentRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        // Sort incidents newest first
        const sorted = (req.result || []).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('Failed to query incidents:', error);
    return [];
  }
};

export const deleteIncident = async (incidentId: string): Promise<void> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(incidentId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error('Failed to delete incident:', error);
  }
};
