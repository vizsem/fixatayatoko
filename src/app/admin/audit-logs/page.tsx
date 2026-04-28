'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Activity, User, Clock, Shield, 
  Search, Filter, ChevronRight, AlertCircle,
  FileText, Settings, UserPlus, Trash2, Database, RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ActivityLog } from '@/lib/activity';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';

const TYPE_ICONS: Record<string, any> = {
  PRODUCT_CREATE: FileText,
  PRODUCT_UPDATE: Settings,
  PRODUCT_DELETE: Trash2,
  SETTING_UPDATE: Settings,
  USER_ROLE_CHANGE: Shield,
  BACKUP_CREATED: Database,
  RESTORE_PERFORMED: RotateCcw,
};

const TYPE_COLORS: Record<string, string> = {
  PRODUCT_CREATE: 'text-green-600 bg-green-50',
  PRODUCT_UPDATE: 'text-blue-600 bg-blue-50',
  PRODUCT_DELETE: 'text-red-600 bg-red-50',
  SETTING_UPDATE: 'text-purple-600 bg-purple-50',
  USER_ROLE_CHANGE: 'text-amber-600 bg-amber-50',
  BACKUP_CREATED: 'text-indigo-600 bg-indigo-50',
  RESTORE_PERFORMED: 'text-rose-600 bg-rose-50',
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        router.push('/profil');
        return;
      }
    });

    const q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsub();
    };
  }, [router]);

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-[#FBFBFE] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
              <Shield className="text-blue-600" size={28} /> Audit Trails
            </h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
              Admin Activity & System Logs
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search activity..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold shadow-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={10} />
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 border border-gray-100 text-center flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-50 rounded-full">
              <AlertCircle size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No Activity Logs Found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const Icon = TYPE_ICONS[log.type] || Activity;
              return (
                <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                  <div className={`p-3 rounded-xl shrink-0 ${TYPE_COLORS[log.type] || 'bg-gray-50 text-gray-400'}`}>
                    <Icon size={18} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-gray-800 uppercase tracking-tight">{log.adminName}</span>
                      <span className="h-1 w-1 bg-gray-200 rounded-full" />
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm • d MMM yyyy', { locale: id }) : 'Just now'}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-gray-600 line-clamp-1">{log.description}</p>
                  </div>

                  <div className="hidden md:flex flex-col items-end shrink-0">
                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">TYPE</span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${TYPE_COLORS[log.type] || 'bg-gray-100 text-gray-400'}`}>
                      {log.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="p-2 bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
