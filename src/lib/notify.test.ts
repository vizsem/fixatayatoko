import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as toastModule from 'react-hot-toast';
import { notify } from './notify';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('notify utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic notifications', () => {
    it('should call toast.success with correct parameters', () => {
      const message = 'Test success message';
      notify.success(message);
      
      expect(toastModule.default.success).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          position: 'top-center',
          style: expect.objectContaining({
            borderRadius: '1rem',
            padding: '12px',
          })
        })
      );
    });

    it('should call toast.error with correct parameters', () => {
      const message = 'Test error message';
      notify.error(message);
      
      expect(toastModule.default.error).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          position: 'top-center',
          style: expect.any(Object)
        })
      );
    });

    it('should call toast.loading with correct parameters', () => {
      const message = 'Loading...';
      notify.loading(message);
      
      expect(toastModule.default.loading).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          position: 'top-center',
          style: expect.any(Object)
        })
      );
    });
  });

  describe('custom notifications', () => {
    it('should show access denied message', () => {
      notify.aksesDitolakAdmin();
      
      expect(toastModule.default.error).toHaveBeenCalledWith(
        'Akses ditolak! Anda bukan admin.',
        expect.any(Object)
      );
    });

    it('should show success save message without entity', () => {
      notify.berhasilDisimpan();
      
      expect(toastModule.default.success).toHaveBeenCalledWith(
        'berhasil disimpan!',
        expect.any(Object)
      );
    });

    it('should show success save message with entity', () => {
      notify.berhasilDisimpan('produk');
      
      expect(toastModule.default.success).toHaveBeenCalledWith(
        'produk berhasil disimpan!',
        expect.any(Object)
      );
    });

    it('should show failed save message without entity', () => {
      notify.gagalDisimpan();
      
      expect(toastModule.default.error).toHaveBeenCalledWith(
        'Gagal menyimpan.',
        expect.any(Object)
      );
    });

    it('should show failed save message with entity', () => {
      notify.gagalDisimpan('produk');
      
      expect(toastModule.default.error).toHaveBeenCalledWith(
        'Gagal menyimpan produk.',
        expect.any(Object)
      );
    });
  });

  describe('dismiss functionality', () => {
    it('should call toast.dismiss without id', () => {
      notify.dismiss();
      expect(toastModule.default.dismiss).toHaveBeenCalledWith(undefined);
    });

    it('should call toast.dismiss with specific id', () => {
      const toastId = 'test-toast-id';
      notify.dismiss(toastId);
      expect(toastModule.default.dismiss).toHaveBeenCalledWith(toastId);
    });
  });
});