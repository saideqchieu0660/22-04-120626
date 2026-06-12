import { dbService } from "./firebase";

export interface SyncItem {
  id: string;
  type: "cardState" | "userProfile";
  uid: string;
  payload: any;
  cardId?: string; // only for cardState
  timestamp: number;
}

const STORAGE_KEY = "costudy_offline_sync_queue";

// Helper to load current queue from localStorage
function getQueue(): SyncItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("[OfflineSync] Error reading queue from localStorage:", e);
    return [];
  }
}

// Helper to save queue to localStorage
function saveQueue(queue: SyncItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    // Dispatch custom event to notify components about queue size changes
    window.dispatchEvent(
      new CustomEvent("offline-sync-queue-updated", {
        detail: { pendingCount: queue.length },
      })
    );
  } catch (e) {
    console.error("[OfflineSync] Error saving queue to localStorage:", e);
  }
}

let isProcessing = false;

export const OfflineSyncQueue = {
  // Enqueue a card state upgrade
  enqueueCardState(uid: string, cardId: string, state: any) {
    if (!uid) return;
    const queue = getQueue();

    // Deduplicate: If there is already an update for this cardId & uid, update or filter it out to avoid multiple writes
    const filtered = queue.filter(
      (item) => !(item.type === "cardState" && item.uid === uid && item.cardId === cardId)
    );

    const newItem: SyncItem = {
      id: `sync_card_${cardId}_${Date.now()}`,
      type: "cardState",
      uid,
      cardId,
      payload: state,
      timestamp: Date.now(),
    };

    filtered.push(newItem);
    saveQueue(filtered);
    
    // Attempt processing immediately
    this.processQueue();
  },

  // Enqueue a user profile sync
  enqueueUserProfile(uid: string, profileData: any) {
    if (!uid) return;
    const queue = getQueue();

    // Deduplicate: Only keep the latest profile update for this uid
    const filtered = queue.filter(
      (item) => !(item.type === "userProfile" && item.uid === uid)
    );

    const newItem: SyncItem = {
      id: `sync_prof_${uid}_${Date.now()}`,
      type: "userProfile",
      uid,
      payload: profileData,
      timestamp: Date.now(),
    };

    filtered.push(newItem);
    saveQueue(filtered);

    // Attempt processing immediately
    this.processQueue();
  },

  getPendingCount(): number {
    return getQueue().length;
  },

  // Process all items in the queue
  async processQueue() {
    if (isProcessing) return;
    
    const queue = getQueue();
    if (queue.length === 0) return;

    // Check if browser stands as strictly offline
    if (!navigator.onLine) {
      console.log(`[OfflineSync] Browser is currently offline. Retaining ${queue.length} tasks.`);
      return;
    }

    isProcessing = true;
    console.log(`[OfflineSync] Commencing syncing for ${queue.length} offline progress operations...`);
    
    const remainingTasks: SyncItem[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        if (item.type === "cardState") {
          await dbService.setCardState(item.uid, item.cardId!, item.payload);
        } else if (item.type === "userProfile") {
          await dbService.updateUserProfile(item.uid, item.payload);
        }
        syncedCount++;
        console.log(`[OfflineSync] Successfully synchronized offline action: ${item.id}`);
      } catch (error: any) {
        // If it's a network-related error or similar temporary error, keep it in the queue to try again
        console.error(`[OfflineSync] Failed to sync offline item ${item.type} (${item.id}):`, error);
        
        // However, if the error indicates a fatal business/permission logic error (e.g., unauthorized or missing profile),
        // we should not block the queue infinitely. General error strings from Firestore usually contain 'permission-denied'
        const errorMsg = String(error).toLowerCase();
        if (
          errorMsg.includes("permission-denied") || 
          errorMsg.includes("not-found") ||
          errorMsg.includes("invalid-argument")
        ) {
          console.warn(`[OfflineSync] Discarding unrecoverable task ${item.id} due to fatal Firestore error status.`);
        } else {
          // Keep temporary network loss errors to retry later
          remainingTasks.push(item);
        }
      }
    }

    saveQueue(remainingTasks);
    isProcessing = false;

    if (syncedCount > 0) {
      console.log(`[OfflineSync] Successfully dispatched ${syncedCount} offline updates to real-time Cloud Firestore.`);
      // Emit connection back status success with the number of successfully synchronized card sessions
      window.dispatchEvent(
        new CustomEvent("offline-sync-completed", {
          detail: { count: syncedCount },
        })
      );
    }
  },
};

// Initialize listeners to auto-reconnect and purge/process queue
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Small timeout to allow network streams/Auth to safely revive first
    setTimeout(() => {
      OfflineSyncQueue.processQueue();
    }, 1500);
  });

  window.addEventListener("app-network-reconnect", () => {
    setTimeout(() => {
      OfflineSyncQueue.processQueue();
    }, 1000);
  });
}
