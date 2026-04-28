import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export type ActivityType = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'PRODUCT_CREATE' 
  | 'PRODUCT_UPDATE' 
  | 'PRODUCT_DELETE' 
  | 'SETTING_UPDATE' 
  | 'ORDER_CANCEL' 
  | 'ORDER_REFUND' 
  | 'USER_ROLE_CHANGE'
  | 'BACKUP_CREATED'
  | 'RESTORE_PERFORMED';

export interface ActivityLog {
  id?: string;
  type: ActivityType;
  adminId: string;
  adminName: string;
  targetId?: string;
  targetName?: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: any;
}

/**
 * Log an administrative action to Firestore
 */
export const logActivity = async (params: {
  type: ActivityType;
  targetId?: string;
  targetName?: string;
  description: string;
  metadata?: Record<string, any>;
}) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const log: Omit<ActivityLog, 'id'> = {
      type: params.type,
      adminId: user.uid,
      adminName: user.displayName || 'Admin',
      targetId: params.targetId,
      targetName: params.targetName,
      description: params.description,
      metadata: params.metadata,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, 'activity_logs'), log);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Get recent activity logs
 */
export const getRecentActivities = async (n = 20) => {
  try {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(n)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ActivityLog[];
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};
