// lib/activity.ts - Rewritten for Supabase
import { supabase } from '@/lib/supabase';

import { auth, limit } from '@/lib/firebase';
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
 * Log an administrative action to Supabase activity_logs table
 */
export const logActivity = async (params: {
  type: ActivityType;
  targetId?: string;
  targetName?: string;
  description: string;
  metadata?: Record<string, any>;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('activity_logs').insert({
      type: params.type,
      admin_id: user.id,
      admin_name: user.user_metadata?.full_name || 'Admin',
      target_id: params.targetId,
      target_name: params.targetName,
      description: params.description,
      metadata: params.metadata,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Get recent activity logs
 */
export const getRecentActivities = async (n = 20) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(n);

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      type: row.type,
      adminId: row.admin_id,
      adminName: row.admin_name,
      targetId: row.target_id,
      targetName: row.target_name,
      description: row.description,
      metadata: row.metadata,
      timestamp: row.created_at,
    })) as ActivityLog[];
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
};
