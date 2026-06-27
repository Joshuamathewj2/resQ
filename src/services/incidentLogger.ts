/**
 * @file src/services/incidentLogger.ts
 * @description IndexedDB persistence service for incident records.
 *
 * Provides CRUD operations on the ResQ_Database IndexedDB store.
 * Each incident record contains the full incident log timeline, metadata,
 * and timestamps for post-incident review in the Incident History UI.
 *
 * The database is lazily initialized on first access and cached as a singleton.
 */

import { IncidentLog } from '../types';
import {
  DB_NAME,
  DB_VERSION,
  DB_STORE_NAME,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('IncidentLogger');

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/** Cached database connection, reused across calls to avoid repeated opens. */
let dbInstance: IDBDatabase | null = null;

/**
 * Opens (or returns the cached) IndexedDB connection.
 * Creates the object store schema on first run or version upgrade.
 *
 * @returns Promise resolving to the IDBDatabase instance
 * @throws {Error} If IndexedDB is unavailable or the open request fails
 */
const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      log.error('IndexedDB open failed', request.error);
      reject(request.error ?? new Error('IndexedDB open request failed'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE_NAME)) {
        // keyPath 'id' must match the IncidentRecord.id field
        db.createObjectStore(DB_STORE_NAME, { keyPath: 'id' });
        log.info(`Created IndexedDB object store: "${DB_STORE_NAME}"`);
      }
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A persisted incident record stored in IndexedDB.
 * Contains the full log timeline for post-incident review and export.
 */
export interface IncidentRecord {
  /** Unique incident identifier matching the in-memory currentIncidentId */
  id: string;
  /** ISO 8601 timestamp of when the incident was saved */
  timestamp: string;
  /** Complete ordered list of log entries from the incident */
  logs: IncidentLog[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves (upserts) an incident record to IndexedDB.
 * Uses `put` semantics — existing records with the same ID are overwritten.
 *
 * @param incidentId - Unique incident identifier (e.g. "INCIDENT-1704067200000")
 * @param logs - Complete list of incident log entries to persist
 * @returns Promise that resolves when the write is confirmed
 *
 * @example
 * ```ts
 * await saveIncident('INCIDENT-123', store.logs);
 * ```
 */
export const saveIncident = async (incidentId: string, logs: IncidentLog[]): Promise<void> => {
  if (!incidentId) {
    log.warn('saveIncident called with empty incidentId — skipping write');
    return;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction(DB_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DB_STORE_NAME);

    const record: IncidentRecord = {
      id: incidentId,
      timestamp: new Date().toISOString(),
      logs,
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IDBObjectStore.put failed'));
    });

    log.info(`Incident saved to IndexedDB: ${incidentId} (${logs.length} log entries)`);
  } catch (error) {
    log.error(`Failed to save incident "${incidentId}"`, error);
  }
};

/**
 * Retrieves all stored incident records, sorted newest-first by timestamp.
 *
 * @returns Array of IncidentRecord objects, or empty array on failure
 *
 * @example
 * ```ts
 * const history = await getAllIncidents();
 * history.forEach(incident => console.log(incident.id));
 * ```
 */
export const getAllIncidents = async (): Promise<IncidentRecord[]> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(DB_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DB_STORE_NAME);

    return await new Promise<IncidentRecord[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result as IncidentRecord[]).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error ?? new Error('IDBObjectStore.getAll failed'));
    });
  } catch (error) {
    log.error('Failed to retrieve incidents from IndexedDB', error);
    return [];
  }
};

/**
 * Retrieves a single incident record by its ID.
 *
 * @param incidentId - The ID of the incident to retrieve
 * @returns The matching IncidentRecord, or null if not found
 */
export const getIncident = async (incidentId: string): Promise<IncidentRecord | null> => {
  if (!incidentId) return null;

  try {
    const db = await getDB();
    const transaction = db.transaction(DB_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DB_STORE_NAME);

    return await new Promise<IncidentRecord | null>((resolve, reject) => {
      const req = store.get(incidentId);
      req.onsuccess = () => resolve((req.result as IncidentRecord) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IDBObjectStore.get failed'));
    });
  } catch (error) {
    log.error(`Failed to retrieve incident "${incidentId}"`, error);
    return null;
  }
};

/**
 * Permanently deletes an incident record from IndexedDB.
 *
 * @param incidentId - The ID of the incident to delete
 * @returns Promise that resolves when deletion is confirmed
 */
export const deleteIncident = async (incidentId: string): Promise<void> => {
  if (!incidentId) return;

  try {
    const db = await getDB();
    const transaction = db.transaction(DB_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DB_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(incidentId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('IDBObjectStore.delete failed'));
    });

    log.info(`Incident deleted from IndexedDB: ${incidentId}`);
  } catch (error) {
    log.error(`Failed to delete incident "${incidentId}"`, error);
  }
};
