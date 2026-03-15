import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addStockTx, deductStockTx, transferStockTx, adjustStockTx } from '@/lib/inventory';
import { serverTimestamp } from 'firebase/firestore';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ path: `${collection}/${id}` })),
  collection: vi.fn((db, path) => ({ path })),
  serverTimestamp: vi.fn(() => 'mocked-timestamp')
}));

describe('Inventory Atomicity (Unit & Logic Check)', () => {
  let mockTx: any;
  
  beforeEach(() => {
    mockTx = {
      get: vi.fn(),
      update: vi.fn(),
      set: vi.fn()
    };
  });

  it('transferStockTx should move stock between warehouses without changing total stock', async () => {
    // Arrange
    const productId = 'prod-1';
    const mockDocSnap = {
      exists: () => true,
      data: () => ({
        stock: 100,
        stockByWarehouse: {
          'gudang-A': 60,
          'gudang-B': 40
        },
        name: 'Produk A'
      })
    };
    mockTx.get.mockResolvedValue(mockDocSnap);

    // Act
    await transferStockTx(mockTx, {
      productId,
      amount: 15,
      fromWarehouseId: 'gudang-A',
      toWarehouseId: 'gudang-B',
      adminId: 'admin-1',
      source: 'TRANSFER'
    });

    // Assert
    // Verify it read the product
    expect(mockTx.get).toHaveBeenCalledTimes(1);
    
    // Verify update was called with correct new distribution
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.anything(), // product ref
      {
        stockByWarehouse: {
          'gudang-A': 45, // 60 - 15
          'gudang-B': 55  // 40 + 15
        }
        // Total stock is NOT updated, it remains 100 implicitly
      }
    );

    // Verify log was written correctly
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.anything(), // log ref
      expect.objectContaining({
        type: 'MUTASI',
        amount: 15,
        prevStock: 100,
        nextStock: 100, // Total stock unchanged
        fromWarehouseId: 'gudang-A',
        toWarehouseId: 'gudang-B'
      })
    );
  });

  it('transferStockTx should fail if insufficient stock in source warehouse', async () => {
    // Arrange
    const mockDocSnap = {
      exists: () => true,
      data: () => ({
        stock: 100,
        stockByWarehouse: {
          'gudang-A': 10, // Only 10 available
          'gudang-B': 90
        }
      })
    };
    mockTx.get.mockResolvedValue(mockDocSnap);

    // Act & Assert
    await expect(
      transferStockTx(mockTx, {
        productId: 'prod-1',
        amount: 15, // Try to transfer 15
        fromWarehouseId: 'gudang-A',
        toWarehouseId: 'gudang-B',
        adminId: 'admin-1',
        source: 'TRANSFER'
      })
    ).rejects.toThrow(/Stok di gudang asal tidak cukup/);
    
    // Ensure no updates or sets were made
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('adjustStockTx (Opname) should calculate correct difference and update total stock', async () => {
    // Arrange
    const mockDocSnap = {
      exists: () => true,
      data: () => ({
        stock: 100,
        stockByWarehouse: {
          'gudang-A': 100
        }
      })
    };
    mockTx.get.mockResolvedValue(mockDocSnap);

    // Act: Adjust stock to 95 (Lost 5 items)
    await adjustStockTx(mockTx, {
      productId: 'prod-1',
      newStock: 95,
      warehouseId: 'gudang-A',
      adminId: 'admin-1',
      source: 'OPNAME'
    });

    // Assert
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.anything(),
      {
        stock: 95, // Total stock updated
        stockByWarehouse: {
          'gudang-A': 95
        }
      }
    );

    // Verify log
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'KELUAR', // Because diff is negative (-5)
        amount: 5,
        prevStock: 100,
        nextStock: 95
      })
    );
  });
});
