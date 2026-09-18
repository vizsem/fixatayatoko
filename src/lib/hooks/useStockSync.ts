/**
 * Hook untuk Stock Sync Service
 * Memudahkan integrasi sinkronisasi stok di komponen React
 */

import { useEffect, useState, useCallback } from 'react';
import { stockSyncService } from '@/lib/stockSyncService';
import { type StockSyncLog, type StockValidation, type SyncConfig } from '@/lib/types';
import { supabase } from '@/lib/supabase';

import { limit } from '@/lib/firebase';
export function useStockSync(productId?: string, warehouseId?: string) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncLogs, setSyncLogs] = useState<StockSyncLog[]>([]);
  const [config, setConfig] = useState<SyncConfig>(stockSyncService.getConfig());

  // Auto-sync effect
  useEffect(() => {
    if (!productId || !warehouseId) return;

    const unsubscribe = stockSyncService.startAutoSync(productId, warehouseId);
    
    return () => {
      stockSyncService.stopAutoSync(productId, warehouseId);
    };
  }, [productId, warehouseId]);

  // Listen to sync logs
  useEffect(() => {
    if (!productId) return;

    const fetchLogs = async () => {
      const { data } = await supabase
        .from('stockSyncLogs')
        .select('*')
        .eq('productId', productId)
        .order('timestamp', { ascending: false })
        .limit(10);
      if (data) setSyncLogs(data as StockSyncLog[]);
    };

    fetchLogs();

    const channel = supabase
      .channel(`stockSyncLogs:${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stockSyncLogs', filter: `productId=eq.${productId}` },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const syncStock = useCallback(async () => {
    if (!productId || !warehouseId) return false;
    
    setIsSyncing(true);
    try {
      const result = await stockSyncService.syncWarehouseToProduct(productId, warehouseId);
      if (result) {
        setLastSync(new Date());
      }
      return result;
    } catch (error) {
      console.error('Error syncing stock:', error);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [productId, warehouseId]);

  const validateStock = useCallback(async (physicalStock: number) => {
    if (!productId || !warehouseId) return null;
    
    try {
      const validation = await stockSyncService.validateStock(productId, warehouseId, physicalStock);
      return validation;
    } catch (error) {
      console.error('Error validating stock:', error);
      return null;
    }
  }, [productId, warehouseId]);

  const updateConfig = useCallback((newConfig: Partial<SyncConfig>) => {
    stockSyncService.updateConfig(newConfig);
    setConfig(stockSyncService.getConfig());
  }, []);

  return {
    isSyncing,
    lastSync,
    syncLogs,
    config,
    syncStock,
    validateStock,
    updateConfig
  };
}

export function useBatchStockSync(productIds: string[], warehouseIds: string[]) {
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchResult, setBatchResult] = useState<{ success: number; failed: number } | null>(null);

  const batchSync = useCallback(async () => {
    if (productIds.length === 0 || warehouseIds.length === 0) return;
    
    setIsBatchSyncing(true);
    try {
      const result = await stockSyncService.batchSync(productIds, warehouseIds);
      setBatchResult(result);
      return result;
    } catch (error) {
      console.error('Error batch syncing:', error);
      return { success: 0, failed: productIds.length * warehouseIds.length };
    } finally {
      setIsBatchSyncing(false);
    }
  }, [productIds, warehouseIds]);

  return {
    isBatchSyncing,
    batchResult,
    batchSync
  };
}

export function useSyncLogs(limitCount: number = 50) {
  const [logs, setLogs] = useState<StockSyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('stockSyncLogs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limitCount);
      if (data) setLogs(data as StockSyncLog[]);
      setLoading(false);
    };

    fetchLogs();

    const channel = supabase
      .channel('stockSyncLogs:all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stockSyncLogs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limitCount]);

  return { logs, loading };
}