'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Plus, Search, Edit, Trash2,
  UserCog, Loader2, Clock, CheckCircle2,
  X, Save, ShieldCheck, Calendar, FileText, Download, Target, Briefcase, Wallet
} from 'lucide-react';

// import Link from 'next/link';
import {
  collection, getDocs, updateDoc, doc, query, orderBy,
  increment, addDoc, deleteDoc, serverTimestamp,
  arrayUnion, setDoc, getDoc, runTransaction, where
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

type Employee = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'AKTIF' | 'NON-AKTIF';
  manualSalary: number;
  workSchedule: string;
  totalAttendance: number;
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string;
  npwp?: string;
  contractType?: string;
  contractStart?: string;
  contractEnd?: string;
};

type AttendanceStatus = 'HADIR' | 'ALPHA' | 'CUTI' | 'IZIN' | 'SAKIT';

type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  minutesLate?: number;
  overtimeMinutes?: number;
  overtimePay?: number;
  expenseLogged?: boolean;
};

type UserRole = 'admin' | 'hr' | 'supervisor' | 'cashier' | 'user' | '';

type OvertimeRule = {
  fromMinute: number;
  toMinute: number | null;
  multiplier: number;
};

type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  overtimeRules: OvertimeRule[];
};

type ShiftAssignment = {
  id: string;
  employeeId: string;
  date: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  overtimeRules: OvertimeRule[];
};

type PayrollRunStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID';

type PayrollRun = {
  id: string;
  month: string;
  status: PayrollRunStatus;
  createdAt?: unknown;
  createdBy?: string;
  approvedAt?: unknown;
  approvedBy?: string;
  paidAt?: unknown;
  paidBy?: string;
  includeTHR?: boolean;
};

type PayrollSettings = {
  bpjs: {
    kesehatanEmployeePct: number;
    kesehatanEmployerPct: number;
    tkEmployeePct: number;
    tkEmployerPct: number;
    maxWageKesehatan: number;
  };
  pph21: { mode: 'none' | 'flat'; flatPct: number };
  overtime: { defaultRules: OvertimeRule[] };
};

type EmployeeLoan = {
  id: string;
  employeeId: string;
  amount: number;
  remaining: number;
  installmentMonthly: number;
  startMonth: string;
  status: 'ACTIVE' | 'CLOSED';
};

type EmployeeReimbursement = {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

type KpiScore = {
  id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  score: number;
  bonusAmount: number;
  notes: string;
};

type CandidateStage = 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';

type Candidate = {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  expectedSalary: number;
  stage: CandidateStage;
  source: string;
  notes: string;
  createdAt?: unknown;
};

type PettyCashTxType = 'TOPUP' | 'SPEND' | 'REIMBURSE';

type PettyCashTx = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: PettyCashTxType;
  amount: number;
  description: string;
  createdAt?: unknown;
};

type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type LeaveRequestType = 'CUTI' | 'IZIN' | 'SAKIT';

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveRequestType;
  startDate: string;
  endDate: string;
  paid: boolean;
  reason: string;
  status: LeaveRequestStatus;
};

type PayrollSlip = {
  id: string;
  month: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  attendanceDays: number;
  alphaDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  lateDeduction: number;
  overtimeMinutes: number;
  overtimePay: number;
  reimbursements: number;
  loanDeduction: number;
  bpjsEmployee: number;
  pph21: number;
  thr: number;
  kpiBonus: number;
  deductions: number;
  allowances: number;
  takeHomePay: number;
  createdAt?: unknown;
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ uid: string; role: UserRole; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'STAFF' | 'SHIFT' | 'ABSENSI' | 'PAYROLL' | 'CUTI' | 'KPI' | 'REKRUTMEN' | 'PETTY_CASH'>('STAFF');

  // Form State
  const [formData, setFormData] = useState({
    name: '', role: 'Karyawan Toko', email: '', phone: '',
    manualSalary: 0,
    workSchedule: '07:00 - 14:00',
    status: 'AKTIF' as 'AKTIF' | 'NON-AKTIF',
    bankName: '',
    bankAccount: '',
    bankAccountName: '',
    npwp: '',
    contractType: 'Tetap',
    contractStart: new Date().toISOString().slice(0, 10),
    contractEnd: '',
  });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [payrollMonth, setPayrollMonth] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRecord[]>([]);
  const [monthLeave, setMonthLeave] = useState<LeaveRequest[]>([]);
  const [slipBusyId, setSlipBusyId] = useState<string | null>(null);
  const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, { allowances: number; deductions: number; overtimeMinutes: number; bpjsEmployee?: number; pph21?: number; }>>({});
  const [alphaDeductionPercent, setAlphaDeductionPercent] = useState<number>(50);

  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    type: 'CUTI' as LeaveRequestType,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    paid: true,
    reason: '',
  });

  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('DEFAULT');

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>({
    bpjs: {
      kesehatanEmployeePct: 1,
      kesehatanEmployerPct: 4,
      tkEmployeePct: 2,
      tkEmployerPct: 3.7,
      maxWageKesehatan: 12000000,
    },
    pph21: { mode: 'flat', flatPct: 5 },
    overtime: {
      defaultRules: [
        { fromMinute: 0, toMinute: 60, multiplier: 1.5 },
        { fromMinute: 60, toMinute: null, multiplier: 2 },
      ],
    },
  });
  const [monthLoans, setMonthLoans] = useState<EmployeeLoan[]>([]);
  const [monthReimbursements, setMonthReimbursements] = useState<EmployeeReimbursement[]>([]);
  const [payrollKpiScores, setPayrollKpiScores] = useState<Record<string, { score: number; bonusAmount: number; notes: string }>>({});
  const [includeTHR, setIncludeTHR] = useState(false);

  const [kpiMonth, setKpiMonth] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiScores, setKpiScores] = useState<Record<string, { score: number; bonusAmount: number; notes: string }>>({});

  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    name: '',
    phone: '',
    email: '',
    position: '',
    expectedSalary: 0,
    stage: 'APPLIED' as CandidateStage,
    source: '',
    notes: '',
  });

  const [pettyCashMonth, setPettyCashMonth] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });
  const [pettyCashLoading, setPettyCashLoading] = useState(false);
  const [pettyCashTx, setPettyCashTx] = useState<PettyCashTx[]>([]);
  const [pettyCashBalances, setPettyCashBalances] = useState<Record<string, number>>({});
  const [pettyModalOpen, setPettyModalOpen] = useState(false);
  const [pettyForm, setPettyForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'TOPUP' as PettyCashTxType,
    amount: 0,
    description: '',
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthorized(false);
        router.push('/profil/login');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const role = snap.exists() ? (String(snap.data()?.role || '') as UserRole) : '';
        const name = snap.exists() ? String(snap.data()?.name || snap.data()?.email || '') : '';
        if (!['admin', 'hr', 'supervisor'].includes(role)) {
          setAuthorized(false);
          setCurrentUser(null);
          router.push('/profil');
          return;
        }
        setAuthorized(true);
        setCurrentUser({ uid: user.uid, role, name });
        fetchEmployees();
      } catch {
        setAuthorized(false);
        setCurrentUser(null);
        router.push('/profil');
      }
    });
    return () => unsub();
  }, [router]);

  const canManageStaff = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const canManagePayroll = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const canApprovePayroll = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const canManageRecruitment = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const canManagePettyCash = currentUser?.role === 'admin' || currentUser?.role === 'hr';

  useEffect(() => {
    if (!authorized) return;
    if (activeTab === 'ABSENSI') fetchAttendanceByDate(selectedDate);
    if (activeTab === 'CUTI') fetchLeaveRequests();
    if (activeTab === 'PAYROLL') fetchPayrollInputs(payrollMonth);
    if (activeTab === 'SHIFT') {
      fetchShiftTemplates();
      fetchShiftAssignmentsByDate(selectedDate);
    }
    if (activeTab === 'KPI') fetchKpiInputs(kpiMonth);
    if (activeTab === 'REKRUTMEN') fetchCandidates();
    if (activeTab === 'PETTY_CASH') fetchPettyCashByMonth(pettyCashMonth);
  }, [authorized, activeTab, selectedDate, payrollMonth]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
      setEmployees(data);
    } catch {

      notify.admin.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceByDate = async (date: string) => {
    setAttendanceLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'attendance_records'), where('date', '==', date)));
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AttendanceRecord[];
      setAttendance(rows);
    } catch {
      notify.admin.error('Gagal memuat absensi');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const daysInMonth = (month: string) => {
    const [y, m] = month.split('-').map((v) => Number(v));
    const last = new Date(y, (m || 1), 0);
    return last.getDate();
  };

  const monthRange = (month: string) => {
    const d = daysInMonth(month);
    return { start: `${month}-01`, end: `${month}-${String(d).padStart(2, '0')}` };
  };

  const fetchPayrollInputs = async (month: string) => {
    setPayrollLoading(true);
    try {
      await Promise.all([fetchPayrollSettings(), fetchPayrollRun(month), fetchLoansAndReimbursements(month)]);
      const { start, end } = monthRange(month);
      const [attSnap, leaveSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendance_records'), where('date', '>=', start), where('date', '<=', end))),
        getDocs(query(collection(db, 'leave_requests'), where('startDate', '<=', end), where('endDate', '>=', start))),
      ]);
      setMonthAttendance(attSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AttendanceRecord[]);
      setMonthLeave(leaveSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LeaveRequest[]);

      const adjSnap = await getDocs(query(collection(db, 'payroll_adjustments'), where('month', '==', month)));
      const nextAdj: Record<string, { allowances: number; deductions: number; overtimeMinutes: number; bpjsEmployee?: number; pph21?: number; }> = {};
      adjSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const employeeId = String(data.employeeId || '');
        if (!employeeId) return;
        nextAdj[employeeId] = {
          allowances: Number(data.allowances || 0),
          deductions: Number(data.deductions || 0),
          overtimeMinutes: Number(data.overtimeMinutes || 0),
          bpjsEmployee: data.bpjsEmployee !== undefined && data.bpjsEmployee !== null ? Number(data.bpjsEmployee) : undefined,
          pph21: data.pph21 !== undefined && data.pph21 !== null ? Number(data.pph21) : undefined,
        };
      });
      setPayrollAdjustments(nextAdj);

      const kpiSnap = await getDocs(query(collection(db, 'kpi_scores'), where('month', '==', month)));
      const nextKpi: Record<string, { score: number; bonusAmount: number; notes: string }> = {};
      kpiSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const employeeId = String(data.employeeId || '');
        if (!employeeId) return;
        nextKpi[employeeId] = { score: Number(data.score || 0), bonusAmount: Number(data.bonusAmount || 0), notes: String(data.notes || '') };
      });
      setPayrollKpiScores(nextKpi);
    } catch {
      notify.admin.error('Gagal memuat payroll');
    } finally {
      setPayrollLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'leave_requests'), orderBy('createdAt', 'desc')));
      setLeaveRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LeaveRequest[]);
    } catch {
      notify.admin.error('Gagal memuat cuti/izin');
    } finally {
      setLeaveLoading(false);
    }
  };

  const logAudit = async (action: string, targetType: string, targetId: string, payload: Record<string, unknown>) => {
    if (!currentUser?.uid) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action,
        targetType,
        targetId,
        payload,
        actorId: currentUser.uid,
        actorName: currentUser.name || '',
        actorRole: currentUser.role || '',
        createdAt: serverTimestamp(),
      });
    } catch {}
  };

  const toMinutes = (time: string) => {
    const [hh, mm] = String(time || '').split(':').map((v) => Number(v));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const parseRange = (schedule: string) => {
    const [a, b] = String(schedule || '').split('-').map((s) => s.trim());
    const start = toMinutes(a || '');
    const end = toMinutes(b || '');
    if (start === null || end === null) return null;
    return { start, end, startTime: a, endTime: b };
  };

  const defaultShiftRules = (): OvertimeRule[] => payrollSettings.overtime.defaultRules;

  const fetchShiftTemplates = async () => {
    setShiftLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'shift_templates'), orderBy('name', 'asc')));
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ShiftTemplate[];
      setShiftTemplates(rows);
    } catch {
      notify.admin.error('Gagal memuat shift');
    } finally {
      setShiftLoading(false);
    }
  };

  const fetchShiftAssignmentsByDate = async (date: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'shift_assignments'), where('date', '==', date)));
      setShiftAssignments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ShiftAssignment[]);
    } catch {
      setShiftAssignments([]);
    }
  };

  const upsertShiftAssignment = async (employee: Employee, date: string, shiftId: string) => {
    const assignmentId = recordIdFor(date, employee.id);
    const ref = doc(db, 'shift_assignments', assignmentId);
    const base = parseRange(employee.workSchedule);
    const template = shiftTemplates.find((s) => s.id === shiftId);
    const startTime = template?.startTime || base?.startTime || '07:00';
    const endTime = template?.endTime || base?.endTime || '14:00';
    const graceMinutes = typeof template?.graceMinutes === 'number' ? template.graceMinutes : 0;
    const overtimeRules = (template?.overtimeRules && Array.isArray(template.overtimeRules) && template.overtimeRules.length > 0)
      ? template.overtimeRules
      : defaultShiftRules();
    try {
      await setDoc(ref, {
        employeeId: employee.id,
        date,
        shiftId: template?.id || 'DEFAULT',
        shiftName: template?.name || 'Default',
        startTime,
        endTime,
        graceMinutes,
        overtimeRules,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAudit('SHIFT_ASSIGN', 'employee', employee.id, { date, shiftId: template?.id || 'DEFAULT', startTime, endTime, graceMinutes });
      notify.admin.success('Shift tersimpan');
      fetchShiftAssignmentsByDate(date);
    } catch {
      notify.admin.error('Gagal menyimpan shift');
    }
  };

  const getShiftFor = (employee: Employee, date: string) => {
    const assignment = shiftAssignments.find((s) => s.employeeId === employee.id && s.date === date);
    if (assignment) return assignment;
    const base = parseRange(employee.workSchedule);
    return {
      id: recordIdFor(date, employee.id),
      employeeId: employee.id,
      date,
      shiftId: 'DEFAULT',
      shiftName: 'Default',
      startTime: base?.startTime || '07:00',
      endTime: base?.endTime || '14:00',
      graceMinutes: 0,
      overtimeRules: defaultShiftRules(),
    } as ShiftAssignment;
  };

  const computeOvertimePay = (overtimeMinutes: number, hourlyRate: number, rules: OvertimeRule[]) => {
    const minutes = Math.max(0, Math.floor(Number(overtimeMinutes || 0)));
    if (minutes <= 0) return 0;
    const hrs = Number(hourlyRate || 0);
    if (!Number.isFinite(hrs) || hrs <= 0) return 0;
    const sorted = [...rules].sort((a, b) => a.fromMinute - b.fromMinute);
    let pay = 0;
    for (const r of sorted) {
      const from = Math.max(0, Math.floor(Number(r.fromMinute || 0)));
      const to = r.toMinute === null ? minutes : Math.min(minutes, Math.floor(Number(r.toMinute || 0)));
      if (minutes <= from) continue;
      const covered = Math.max(0, to - from);
      if (covered <= 0) continue;
      pay += (covered / 60) * hrs * Number(r.multiplier || 1);
    }
    return Math.round(pay);
  };

  const fetchPayrollSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'payroll_settings', 'default'));
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setPayrollSettings((prev) => ({
        bpjs: {
          kesehatanEmployeePct: Number(data.bpjs?.kesehatanEmployeePct ?? prev.bpjs.kesehatanEmployeePct),
          kesehatanEmployerPct: Number(data.bpjs?.kesehatanEmployerPct ?? prev.bpjs.kesehatanEmployerPct),
          tkEmployeePct: Number(data.bpjs?.tkEmployeePct ?? prev.bpjs.tkEmployeePct),
          tkEmployerPct: Number(data.bpjs?.tkEmployerPct ?? prev.bpjs.tkEmployerPct),
          maxWageKesehatan: Number(data.bpjs?.maxWageKesehatan ?? prev.bpjs.maxWageKesehatan),
        },
        pph21: {
          mode: data.pph21?.mode === 'none' ? 'none' : 'flat',
          flatPct: Number(data.pph21?.flatPct ?? prev.pph21.flatPct),
        },
        overtime: {
          defaultRules: Array.isArray(data.overtime?.defaultRules) ? data.overtime.defaultRules : prev.overtime.defaultRules,
        },
      }));
    } catch {}
  };

  const fetchPayrollRun = async (month: string) => {
    try {
      const snap = await getDoc(doc(db, 'payroll_runs', month));
      if (!snap.exists()) {
        setPayrollRun({ id: month, month, status: 'DRAFT', includeTHR: false });
        setIncludeTHR(false);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as any) } as PayrollRun;
      setPayrollRun(data);
      setIncludeTHR(Boolean((data as any).includeTHR));
    } catch {
      setPayrollRun({ id: month, month, status: 'DRAFT', includeTHR: false });
      setIncludeTHR(false);
    }
  };

  const setPayrollRunStatus = async (status: PayrollRunStatus) => {
    if (!payrollRun) return;
    if (!canApprovePayroll) {
      notify.admin.error('Tidak punya akses approval');
      return;
    }
    try {
      const ref = doc(db, 'payroll_runs', payrollRun.month);
      const base: any = { month: payrollRun.month, status, updatedAt: serverTimestamp() };
      if (status === 'SUBMITTED' && !payrollRun.createdAt) {
        base.createdAt = serverTimestamp();
        base.createdBy = currentUser?.uid || '';
      }
      if (status === 'APPROVED') {
        base.approvedAt = serverTimestamp();
        base.approvedBy = currentUser?.uid || '';
      }
      if (status === 'PAID') {
        base.paidAt = serverTimestamp();
        base.paidBy = currentUser?.uid || '';
      }
      base.includeTHR = includeTHR;
      await setDoc(ref, base, { merge: true });
      await logAudit('PAYROLL_STATUS', 'payroll_run', payrollRun.month, { status });
      notify.admin.success('Status payroll diperbarui');
      fetchPayrollRun(payrollRun.month);
    } catch {
      notify.admin.error('Gagal update status payroll');
    }
  };

  const fetchLoansAndReimbursements = async (month: string) => {
    try {
      const { start, end } = monthRange(month);
      const [loansSnap, reimbSnap] = await Promise.all([
        getDocs(query(collection(db, 'employee_loans'), where('status', '==', 'ACTIVE'))),
        getDocs(query(collection(db, 'employee_reimbursements'), where('date', '>=', start), where('date', '<=', end), where('status', '==', 'APPROVED'))),
      ]);
      setMonthLoans(loansSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EmployeeLoan[]);
      setMonthReimbursements(reimbSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EmployeeReimbursement[]);
    } catch {
      setMonthLoans([]);
      setMonthReimbursements([]);
    }
  };

  const fetchKpiInputs = async (month: string) => {
    setKpiLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'kpi_scores'), where('month', '==', month)));
      const next: Record<string, { score: number; bonusAmount: number; notes: string }> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const employeeId = String(data.employeeId || '');
        if (!employeeId) return;
        next[employeeId] = { score: Number(data.score || 0), bonusAmount: Number(data.bonusAmount || 0), notes: String(data.notes || '') };
      });
      setKpiScores(next);
    } catch {
      setKpiScores({});
    } finally {
      setKpiLoading(false);
    }
  };

  const saveKpi = async (employee: Employee) => {
    if (!canManagePayroll) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    const row = kpiScores[employee.id] || { score: 0, bonusAmount: 0, notes: '' };
    try {
      await setDoc(doc(db, 'kpi_scores', `${kpiMonth}_${employee.id}`), {
        month: kpiMonth,
        employeeId: employee.id,
        employeeName: employee.name,
        score: Number(row.score || 0),
        bonusAmount: Number(row.bonusAmount || 0),
        notes: String(row.notes || ''),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await logAudit('KPI_SAVE', 'employee', employee.id, { month: kpiMonth, score: row.score, bonusAmount: row.bonusAmount });
      notify.admin.success('KPI tersimpan');
    } catch {
      notify.admin.error('Gagal simpan KPI');
    }
  };

  const fetchCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'candidates'), orderBy('createdAt', 'desc')));
      setCandidates(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Candidate[]);
    } catch {
      setCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const createCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRecruitment) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    try {
      const ref = await addDoc(collection(db, 'candidates'), {
        ...candidateForm,
        expectedSalary: Number(candidateForm.expectedSalary || 0),
        createdAt: serverTimestamp(),
      });
      await logAudit('CANDIDATE_CREATE', 'candidate', ref.id, { name: candidateForm.name, stage: candidateForm.stage });
      notify.admin.success('Kandidat ditambahkan');
      setCandidateModalOpen(false);
      setCandidateForm({ name: '', phone: '', email: '', position: '', expectedSalary: 0, stage: 'APPLIED', source: '', notes: '' });
      fetchCandidates();
    } catch {
      notify.admin.error('Gagal tambah kandidat');
    }
  };

  const updateCandidateStage = async (candidate: Candidate, stage: CandidateStage) => {
    if (!canManageRecruitment) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    try {
      await updateDoc(doc(db, 'candidates', candidate.id), { stage, updatedAt: serverTimestamp() });
      await logAudit('CANDIDATE_STAGE', 'candidate', candidate.id, { stage });
      fetchCandidates();
    } catch {
      notify.admin.error('Gagal update stage');
    }
  };

  const convertCandidateToEmployee = async (candidate: Candidate) => {
    if (!canManageRecruitment) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    try {
      const empRef = await addDoc(collection(db, 'employees'), {
        name: candidate.name,
        role: candidate.position || 'Karyawan',
        email: candidate.email || '',
        phone: candidate.phone || '',
        status: 'AKTIF',
        manualSalary: Number(candidate.expectedSalary || 0),
        workSchedule: '07:00 - 14:00',
        totalAttendance: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'candidates', candidate.id), { stage: 'HIRED', hiredEmployeeId: empRef.id, updatedAt: serverTimestamp() });
      await logAudit('CANDIDATE_HIRED', 'candidate', candidate.id, { employeeId: empRef.id });
      notify.admin.success('Kandidat dikonversi jadi karyawan');
      fetchEmployees();
      fetchCandidates();
    } catch {
      notify.admin.error('Gagal konversi kandidat');
    }
  };

  const fetchPettyCashByMonth = async (month: string) => {
    setPettyCashLoading(true);
    try {
      const { start, end } = monthRange(month);
      const [txSnap, balSnap] = await Promise.all([
        getDocs(query(collection(db, 'employee_petty_cash_transactions'), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'desc'))),
        getDocs(query(collection(db, 'employee_petty_cash'), orderBy('employeeName', 'asc'))),
      ]);
      setPettyCashTx(txSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PettyCashTx[]);
      const map: Record<string, number> = {};
      balSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const employeeId = String(data.employeeId || d.id);
        map[employeeId] = Number(data.balance || 0);
      });
      setPettyCashBalances(map);
    } catch {
      setPettyCashTx([]);
      setPettyCashBalances({});
    } finally {
      setPettyCashLoading(false);
    }
  };

  const savePettyCashTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePettyCash) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    const emp = employees.find((x) => x.id === pettyForm.employeeId);
    if (!emp) {
      notify.admin.error('Pilih karyawan');
      return;
    }
    const amount = Math.round(Number(pettyForm.amount || 0));
    if (amount <= 0) {
      notify.admin.error('Nominal tidak valid');
      return;
    }
    const txType = pettyForm.type;
    const delta = txType === 'TOPUP' ? amount : -amount;
    try {
      await runTransaction(db, async (tx) => {
        const balRef = doc(db, 'employee_petty_cash', emp.id);
        const balSnap = await tx.get(balRef);
        const current = balSnap.exists() ? Number((balSnap.data() as any).balance || 0) : 0;
        const next = current + delta;
        if (next < 0) throw new Error('Saldo tidak cukup');
        tx.set(balRef, { employeeId: emp.id, employeeName: emp.name, balance: next, updatedAt: serverTimestamp() }, { merge: true });
        const txRef = doc(collection(db, 'employee_petty_cash_transactions'));
        tx.set(txRef, {
          employeeId: emp.id,
          employeeName: emp.name,
          date: pettyForm.date,
          type: txType,
          amount,
          description: String(pettyForm.description || ''),
          createdAt: serverTimestamp(),
        });
      });
      await logAudit('PETTY_CASH_TX', 'employee', emp.id, { type: txType, amount, date: pettyForm.date });
      notify.admin.success('Petty cash tersimpan');
      setPettyModalOpen(false);
      setPettyForm({ employeeId: '', date: new Date().toISOString().slice(0, 10), type: 'TOPUP', amount: 0, description: '' });
      fetchPettyCashByMonth(pettyCashMonth);
    } catch (err: any) {
      notify.admin.error(err?.message || 'Gagal simpan petty cash');
    }
  };

  const parseScheduleStart = (schedule: string) => {
    const s = String(schedule || '').split('-')[0]?.trim() || '';
    const [hh, mm] = s.split(':').map((v) => Number(v));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  };

  const nowIso = () => new Date().toISOString();

  const recordIdFor = (date: string, employeeId: string) => `${date}_${employeeId}`;

  const markAttendance = async (employee: Employee, status: AttendanceStatus, date: string) => {
    const empRef = doc(db, 'employees', employee.id);
    const recRef = doc(db, 'attendance_records', recordIdFor(date, employee.id));
    const shift = getShiftFor(employee, date);
    const scheduleStart = toMinutes(shift.startTime);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const minutesLate = scheduleStart !== null ? Math.max(0, nowMinutes - (scheduleStart + Number(shift.graceMinutes || 0))) : 0;
    const dailySalary = Math.round(Number(employee.manualSalary || 0) / 30);
    const penaltyAmount = Math.round((Number(employee.manualSalary || 0) / 30) * (alphaDeductionPercent / 100));

    try {
      await runTransaction(db, async (tx) => {
        const [empSnap, recSnap] = await Promise.all([tx.get(empRef), tx.get(recRef)]);
        if (!empSnap.exists()) throw new Error('Karyawan tidak ditemukan');

        const prev = recSnap.exists() ? (recSnap.data() as any) : null;
        const prevStatus = prev ? (prev.status as AttendanceStatus | undefined) : undefined;
        const prevExpenseLogged = Boolean(prev?.expenseLogged);
        const prevDateLogged = prev ? String(prev.date || '') : '';
        const alreadySameDay = prevDateLogged === date;

        const base: any = {
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          status,
          shiftId: shift.shiftId,
          shiftName: shift.shiftName,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          graceMinutes: shift.graceMinutes,
          updatedAt: serverTimestamp(),
        };

        if (status === 'HADIR') {
          if (!prev?.checkInAt) base.checkInAt = nowIso();
          base.minutesLate = minutesLate;
        }

        if (!recSnap.exists()) base.createdAt = serverTimestamp();
        tx.set(recRef, base, { merge: true });

        if (status === 'HADIR') {
          const shouldIncrement = !alreadySameDay || prevStatus !== 'HADIR';
          if (shouldIncrement) {
            tx.update(empRef, { totalAttendance: increment(1), attendanceDates: arrayUnion(date) });
          } else {
            tx.update(empRef, { attendanceDates: arrayUnion(date) });
          }
          if (dailySalary > 0 && !prevExpenseLogged) {
            const expRef = doc(collection(db, 'operational_expenses'));
            tx.set(expRef, {
              category: 'GAJI_KARYAWAN',
              amount: dailySalary,
              description: `Gaji harian ${employee.name} - ${employee.role}`,
              employeeId: employee.id,
              employeeName: employee.name,
              date,
              createdAt: serverTimestamp(),
            });
            tx.set(recRef, { expenseLogged: true }, { merge: true });
          }
        } else if (status === 'ALPHA') {
          const expRef = doc(collection(db, 'operational_expenses'));
          tx.set(expRef, {
            category: 'DENDA_ALPHA',
            amount: -penaltyAmount,
            description: `Denda alpha ${employee.name} - ${employee.role}`,
            employeeId: employee.id,
            employeeName: employee.name,
            date,
            createdAt: serverTimestamp(),
          });
        }
      });

      notify.admin.success('Absensi tersimpan');
      await logAudit('ATTENDANCE_SET', 'employee', employee.id, { date, status });
      await Promise.all([fetchEmployees(), fetchAttendanceByDate(date)]);
    } catch (e: any) {
      notify.admin.error(e?.message || 'Gagal menyimpan absensi');
    }
  };

  const checkOutAttendance = async (employee: Employee, date: string) => {
    const recRef = doc(db, 'attendance_records', recordIdFor(date, employee.id));
    const shift = getShiftFor(employee, date);
    const shiftEnd = toMinutes(shift.endTime);
    const hourlyRate = Number(employee.manualSalary || 0) / 173;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(recRef);
        if (!snap.exists()) throw new Error('Belum ada check-in');
        const data = snap.data() as any;
        if (String(data.status || '') !== 'HADIR') throw new Error('Status bukan HADIR');
        if (data.checkOutAt) return;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const overtimeMinutes = shiftEnd !== null ? Math.max(0, nowMinutes - shiftEnd) : 0;
        const rules = Array.isArray(shift.overtimeRules) && shift.overtimeRules.length > 0 ? shift.overtimeRules : defaultShiftRules();
        const overtimePay = computeOvertimePay(overtimeMinutes, hourlyRate, rules);
        tx.set(recRef, { checkOutAt: nowIso(), overtimeMinutes, overtimePay, updatedAt: serverTimestamp() }, { merge: true });
      });
      notify.admin.success('Check-out tersimpan');
      await logAudit('ATTENDANCE_CHECKOUT', 'employee', employee.id, { date });
      fetchAttendanceByDate(date);
    } catch (e: any) {
      notify.admin.error(e?.message || 'Gagal check-out');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), formData);
        notify.admin.success("Data berhasil diperbarui");
      } else {
        await addDoc(collection(db, 'employees'), {
          ...formData,
          totalAttendance: 0,
          createdAt: serverTimestamp()
        });
        notify.admin.success("Karyawan baru ditambahkan");
      }
      setIsModalOpen(false);
      resetForm();
      fetchEmployees();
    } catch {

      notify.admin.error("Gagal menyimpan data");
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({
      name: emp.name, role: emp.role, email: emp.email, phone: emp.phone,
      manualSalary: emp.manualSalary,
      workSchedule: emp.workSchedule,
      status: emp.status,
      bankName: emp.bankName || '',
      bankAccount: emp.bankAccount || '',
      bankAccountName: emp.bankAccountName || '',
      npwp: emp.npwp || '',
      contractType: emp.contractType || 'Tetap',
      contractStart: emp.contractStart || new Date().toISOString().slice(0, 10),
      contractEnd: emp.contractEnd || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data karyawan ini secara permanen?")) return;
    notify.admin.loading('Menghapus...');
    try {
      await deleteDoc(doc(db, 'employees', id));
      notify.admin.success("Berhasil dihapus");
      setEmployees(employees.filter(e => e.id !== id));
    } catch {
      notify.admin.error("Gagal menghapus");
    }
  };

  const handlePresent = async (employee: Employee) => {
    await markAttendance(employee, 'HADIR', selectedDate);
  };

  const handleAlpha = async (employee: Employee) => {
    await markAttendance(employee, 'ALPHA', selectedDate);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      role: 'Karyawan Toko',
      email: '',
      phone: '',
      manualSalary: 0,
      workSchedule: '07:00 - 14:00',
      status: 'AKTIF',
      bankName: '',
      bankAccount: '',
      bankAccountName: '',
      npwp: '',
      contractType: 'Tetap',
      contractStart: new Date().toISOString().slice(0, 10),
      contractEnd: '',
    });
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleTabs = useMemo(() => {
    const base: Array<{ key: typeof activeTab; label: string }> = [
      { key: 'STAFF', label: 'STAFF' },
      { key: 'SHIFT', label: 'SHIFT' },
      { key: 'ABSENSI', label: 'ABSENSI' },
      { key: 'PAYROLL', label: 'PAYROLL' },
      { key: 'CUTI', label: 'CUTI' },
    ];
    if (canManagePayroll) base.push({ key: 'KPI', label: 'KPI' });
    if (canManageRecruitment) base.push({ key: 'REKRUTMEN', label: 'REKRUTMEN' });
    if (canManagePettyCash) base.push({ key: 'PETTY_CASH', label: 'PETTY CASH' });
    return base;
  }, [canManagePayroll, canManageRecruitment, canManagePettyCash, activeTab]);

  const attendanceByEmployeeId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((r) => map.set(r.employeeId, r));
    return map;
  }, [attendance]);

  const payrollRows = useMemo(() => {
    const { start, end } = monthRange(payrollMonth);
    const startNum = Number(start.replace(/-/g, ''));
    const endNum = Number(end.replace(/-/g, ''));

    const inRange = (d: string) => {
      const n = Number(String(d || '').replace(/-/g, ''));
      return n >= startNum && n <= endNum;
    };

    const attendanceMap = new Map<string, AttendanceRecord[]>();
    monthAttendance.forEach((r) => {
      if (!inRange(r.date)) return;
      const list = attendanceMap.get(r.employeeId) || [];
      list.push(r);
      attendanceMap.set(r.employeeId, list);
    });

    const leaveMap = new Map<string, LeaveRequest[]>();
    monthLeave.forEach((r) => {
      if (r.status !== 'APPROVED') return;
      const list = leaveMap.get(r.employeeId) || [];
      list.push(r);
      leaveMap.set(r.employeeId, list);
    });

    const calcOverlapDays = (req: LeaveRequest) => {
      const { start: ms, end: me } = monthRange(payrollMonth);
      const s = req.startDate > ms ? req.startDate : ms;
      const e = req.endDate < me ? req.endDate : me;
      if (e < s) return 0;
      const sd = new Date(`${s}T00:00:00`);
      const ed = new Date(`${e}T00:00:00`);
      return Math.floor((ed.getTime() - sd.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    };

    return employees
      .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
      .map((emp) => {
        const records = attendanceMap.get(emp.id) || [];
        const attendanceDays = records.filter((r) => r.status === 'HADIR').length;
        const alphaDays = records.filter((r) => r.status === 'ALPHA').length;
        const overtimeMinutesFromAttendance = records.reduce((sum, r) => sum + Number(r.overtimeMinutes || 0), 0);
        const overtimePayFromAttendance = records.reduce((sum, r) => sum + Number((r as any).overtimePay || 0), 0);
        const lateMinutes = records.reduce((sum, r) => sum + Number(r.minutesLate || 0), 0);

        const leaves = leaveMap.get(emp.id) || [];
        const leaveDays = leaves.reduce((sum, req) => sum + calcOverlapDays(req), 0);
        const paidLeaveDays = leaves.filter((r) => r.paid).reduce((sum, req) => sum + calcOverlapDays(req), 0);
        const unpaidLeaveDays = Math.max(0, leaveDays - paidLeaveDays);

        const dailyRate = Math.round(Number(emp.manualSalary || 0) / 30);
        const hourlyRate = Number(emp.manualSalary || 0) / 173;
        const adj = payrollAdjustments[emp.id] || { allowances: 0, deductions: 0, overtimeMinutes: 0 };
        const overtimeMinutes = overtimeMinutesFromAttendance + Number(adj.overtimeMinutes || 0);
        const overtimePay = Math.round(overtimePayFromAttendance + computeOvertimePay(Number(adj.overtimeMinutes || 0), hourlyRate, payrollSettings.overtime.defaultRules));

        const lateDeduction = Math.round((lateMinutes / 60) * hourlyRate);

        const alphaDeduction = Math.round(alphaDays * dailyRate * (alphaDeductionPercent / 100));
        const unpaidLeaveDeduction = Math.round(unpaidLeaveDays * dailyRate);

        const reimbursements = monthReimbursements.filter((r) => r.employeeId === emp.id).reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const eligibleLoans = monthLoans.filter((l) => l.employeeId === emp.id && l.status === 'ACTIVE' && String(l.startMonth || '') <= payrollMonth);
        const loanDeduction = eligibleLoans.reduce((sum, l) => sum + Math.min(Number(l.installmentMonthly || 0), Number(l.remaining || 0)), 0);

        const baseSalary = Math.round(Number(emp.manualSalary || 0));
        const thr = includeTHR || payrollRun?.includeTHR ? baseSalary : 0;
        const kpiRow = payrollKpiScores[emp.id] || { bonusAmount: 0 };
        const kpiBonus = Math.round(Number((kpiRow as any).bonusAmount || 0));

        const wageKesehatan = Math.min(baseSalary, Number(payrollSettings.bpjs.maxWageKesehatan || 0) || baseSalary);
        const defaultBpjsEmployee = Math.round((wageKesehatan * Number(payrollSettings.bpjs.kesehatanEmployeePct || 0)) / 100) + Math.round((baseSalary * Number(payrollSettings.bpjs.tkEmployeePct || 0)) / 100);
        const bpjsEmployee = adj.bpjsEmployee !== undefined ? Number(adj.bpjsEmployee) : defaultBpjsEmployee;

        const allowances = Math.round(Number(adj.allowances || 0)) + Math.round(reimbursements) + thr + kpiBonus;
        const baseDeductions = Math.round(Number(adj.deductions || 0)) + alphaDeduction + unpaidLeaveDeduction + lateDeduction;

        const taxable = Math.max(0, baseSalary + overtimePay + allowances - (baseDeductions + bpjsEmployee + loanDeduction));
        const defaultPph21 = payrollSettings.pph21.mode === 'flat' ? Math.round((taxable * Number(payrollSettings.pph21.flatPct || 0)) / 100) : 0;
        const pph21 = adj.pph21 !== undefined ? Number(adj.pph21) : defaultPph21;

        const deductions = baseDeductions + bpjsEmployee + loanDeduction + pph21;
        const takeHomePay = Math.max(0, Math.round(baseSalary + overtimePay + allowances - deductions));

        const slipId = `${payrollMonth}_${emp.id}`;
        return {
          slipId,
          employeeId: emp.id,
          employeeName: emp.name,
          baseSalary,
          attendanceDays,
          alphaDays,
          paidLeaveDays,
          unpaidLeaveDays,
          lateMinutes,
          lateDeduction,
          overtimeMinutes,
          overtimePay,
          reimbursements: Math.round(reimbursements),
          loanDeduction: Math.round(loanDeduction),
          bpjsEmployee,
          pph21,
          thr,
          kpiBonus,
          allowances,
          deductions,
          takeHomePay,
        };
      });
  }, [employees, monthAttendance, monthLeave, payrollMonth, payrollAdjustments, alphaDeductionPercent, monthLoans, monthReimbursements, payrollSettings, includeTHR, payrollRun, payrollKpiScores]);

  const savePayrollRunOptions = async () => {
    if (!canManagePayroll) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    try {
      await setDoc(doc(db, 'payroll_runs', payrollMonth), { month: payrollMonth, includeTHR, updatedAt: serverTimestamp() }, { merge: true });
      notify.admin.success('Setting payroll tersimpan');
      fetchPayrollRun(payrollMonth);
    } catch {
      notify.admin.error('Gagal simpan setting payroll');
    }
  };

  const downloadBankExportCsv = () => {
    if (!canManagePayroll) {
      notify.admin.error('Tidak punya akses');
      return;
    }
    const header = ['employeeId', 'employeeName', 'bankName', 'bankAccount', 'bankAccountName', 'amount', 'description'];
    const lines = [header.join(',')];
    const empMap = new Map(employees.map((e) => [e.id, e]));
    payrollRows.forEach((r: any) => {
      const emp = empMap.get(r.employeeId);
      const bankName = String(emp?.bankName || '');
      const bankAccount = String(emp?.bankAccount || '');
      const bankAccountName = String(emp?.bankAccountName || emp?.name || '');
      const amount = String(Math.round(Number(r.takeHomePay || 0)));
      const desc = `PAYROLL ${payrollMonth}`;
      const row = [
        r.employeeId,
        `"${String(r.employeeName || '').replace(/"/g, '""')}"`,
        `"${bankName.replace(/"/g, '""')}"`,
        `"${bankAccount.replace(/"/g, '""')}"`,
        `"${bankAccountName.replace(/"/g, '""')}"`,
        amount,
        `"${desc}"`,
      ];
      lines.push(row.join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_export_${payrollMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const savePayrollAdjustment = async (employeeId: string, patch: Partial<{ allowances: number; deductions: number; overtimeMinutes: number; bpjsEmployee?: number; pph21?: number; }>) => {
    const current = payrollAdjustments[employeeId] || { allowances: 0, deductions: 0, overtimeMinutes: 0 };
    const next = { ...current, ...patch };
    setPayrollAdjustments((prev) => ({ ...prev, [employeeId]: next }));
    try {
      await setDoc(doc(db, 'payroll_adjustments', `${payrollMonth}_${employeeId}`), {
        month: payrollMonth,
        employeeId,
        allowances: Number(next.allowances || 0),
        deductions: Number(next.deductions || 0),
        overtimeMinutes: Number(next.overtimeMinutes || 0),
        bpjsEmployee: next.bpjsEmployee !== undefined ? Number(next.bpjsEmployee) : null,
        pph21: next.pph21 !== undefined ? Number(next.pph21) : null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch {
      notify.admin.error('Gagal menyimpan adjustment');
    }
  };

  const generateSlip = async (row: any) => {
    setSlipBusyId(row.employeeId);
    try {
      const payload: PayrollSlip = {
        id: row.slipId,
        month: payrollMonth,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        baseSalary: row.baseSalary,
        attendanceDays: row.attendanceDays,
        alphaDays: row.alphaDays,
        paidLeaveDays: row.paidLeaveDays,
        unpaidLeaveDays: row.unpaidLeaveDays,
        lateMinutes: row.lateMinutes,
        lateDeduction: row.lateDeduction,
        overtimeMinutes: row.overtimeMinutes,
        overtimePay: row.overtimePay,
        reimbursements: row.reimbursements,
        loanDeduction: row.loanDeduction,
        bpjsEmployee: row.bpjsEmployee,
        pph21: row.pph21,
        thr: row.thr,
        kpiBonus: row.kpiBonus,
        deductions: row.deductions,
        allowances: row.allowances,
        takeHomePay: row.takeHomePay,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'payroll_slips', row.slipId), payload, { merge: true });
      notify.admin.success('Slip tersimpan');
    } catch {
      notify.admin.error('Gagal membuat slip');
    } finally {
      setSlipBusyId(null);
    }
  };

  const downloadSlipPdf = async (slipId: string) => {
    try {
      const snap = await getDoc(doc(db, 'payroll_slips', slipId));
      if (!snap.exists()) {
        notify.admin.error('Slip belum dibuat');
        return;
      }
      const s = snap.data() as any as PayrollSlip;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 14;
      let y = 18;
      pdf.setFontSize(14);
      pdf.text('Slip Gaji', margin, y);
      y += 7;
      pdf.setFontSize(10);
      pdf.text(`Periode: ${s.month}`, margin, y);
      y += 6;
      pdf.text(`Nama: ${s.employeeName}`, margin, y);
      y += 6;
      pdf.text(`Employee ID: ${s.employeeId}`, margin, y);
      y += 8;

      const rows = [
        ['Gaji Pokok', s.baseSalary],
        ['THR', s.thr],
        ['Lembur', s.overtimePay],
        ['Reimburse', s.reimbursements],
        ['Bonus KPI', s.kpiBonus],
        ['Tunjangan', s.allowances],
        ['Potongan Telat', -Math.abs(s.lateDeduction)],
        ['BPJS (Karyawan)', -Math.abs(s.bpjsEmployee)],
        ['PPh21', -Math.abs(s.pph21)],
        ['Pinjaman', -Math.abs(s.loanDeduction)],
        ['Potongan', -Math.abs(s.deductions)],
      ] as Array<[string, number]>;
      pdf.setFontSize(11);
      pdf.text('Rincian', margin, y);
      y += 6;
      pdf.setFontSize(10);
      rows.forEach(([label, amount]) => {
        pdf.text(label, margin, y);
        pdf.text(`Rp ${Number(amount).toLocaleString('id-ID')}`, 200 - margin, y, { align: 'right' });
        y += 6;
      });
      y += 2;
      pdf.setLineWidth(0.2);
      pdf.line(margin, y, 200 - margin, y);
      y += 7;
      pdf.setFontSize(12);
      pdf.text('Take Home Pay', margin, y);
      pdf.text(`Rp ${Number(s.takeHomePay).toLocaleString('id-ID')}`, 200 - margin, y, { align: 'right' });
      y += 10;
      pdf.setFontSize(9);
      pdf.text(`Hadir: ${s.attendanceDays} | Alpha: ${s.alphaDays} | Cuti dibayar: ${s.paidLeaveDays} | Cuti tidak dibayar: ${s.unpaidLeaveDays}`, margin, y);
      pdf.save(`slip-gaji_${s.month}_${s.employeeName}.pdf`);
    } catch {
      notify.admin.error('Gagal download slip');
    }
  };

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === leaveForm.employeeId);
    if (!emp) {
      notify.admin.error('Pilih karyawan');
      return;
    }
    try {
      await addDoc(collection(db, 'leave_requests'), {
        employeeId: emp.id,
        employeeName: emp.name,
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        paid: Boolean(leaveForm.paid),
        reason: String(leaveForm.reason || ''),
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });
      notify.admin.success('Pengajuan dibuat');
      setLeaveModalOpen(false);
      setLeaveForm((prev) => ({ ...prev, reason: '' }));
      fetchLeaveRequests();
    } catch {
      notify.admin.error('Gagal membuat pengajuan');
    }
  };

  const setLeaveStatus = async (req: LeaveRequest, status: LeaveRequestStatus) => {
    try {
      await updateDoc(doc(db, 'leave_requests', req.id), { status, updatedAt: serverTimestamp() });
      notify.admin.success('Status diperbarui');
      fetchLeaveRequests();
    } catch {
      notify.admin.error('Gagal update status');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-800 font-sans pb-20">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
               <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                 <UserCog size={20} />
               </div>
               <div>
                 <h1 className="text-xl font-black text-slate-900 tracking-tight">Team Ataya</h1>
                 <p className="text-xs font-medium text-slate-500">Manajemen staf & kehadiran</p>
               </div>
             </div>
             
             <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Cari nama, jabatan..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                  <Plus size={16} /> <span className="hidden sm:inline">Tambah Staff</span>
                </button>
             </div>
           </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {!authorized ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
            <p className="text-sm font-bold text-slate-600">Memverifikasi akses...</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-3">
              <div className="flex flex-wrap gap-2">
                {visibleTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeTab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'STAFF' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Staff</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Jabatan</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Jadwal & Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Gaji & Absensi</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">
                            Tidak ada data karyawan ditemukan.
                          </td>
                        </tr>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <tr key={emp.id} className="group hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs border border-emerald-100">
                                  {emp.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{emp.phone || '-'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wide border border-indigo-100">
                                <ShieldCheck size={12} /> {emp.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <Clock size={14} className="text-slate-400" />
                                  {emp.workSchedule}
                                </div>
                                <span className={`inline-flex self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                  emp.status === 'AKTIF'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}>
                                  {emp.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-700">Rp {emp.manualSalary?.toLocaleString('id-ID')}</p>
                                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                  <CheckCircle2 size={12} className="text-emerald-500" />
                                  Hadir: {emp.totalAttendance || 0} hari
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handlePresent(emp)}
                                  title="Absen Hadir"
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition-colors border border-emerald-100"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleAlpha(emp)}
                                  title="Alpha (Denda)"
                                  className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition-colors border border-rose-100"
                                >
                                  <X size={16} />
                                </button>
                                <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                                <button
                                  onClick={() => handleEdit(emp)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(emp.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'SHIFT' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Shift Management</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jadwal per hari, grace, dan aturan lembur</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => { fetchShiftTemplates(); fetchShiftAssignmentsByDate(selectedDate); }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {shiftLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[920px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Shift</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Jam</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Grace</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {employees.filter((e) => String(e.status || '').toUpperCase() === 'AKTIF').map((emp) => {
                          const s = getShiftFor(emp, selectedDate);
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{emp.role}</p>
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={s.shiftId}
                                  onChange={(e) => upsertShiftAssignment(emp, selectedDate, e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none"
                                >
                                  <option value="DEFAULT">Default</option>
                                  {shiftTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-6 py-4 text-xs font-black text-slate-700">
                                {s.startTime} - {s.endTime}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-black text-slate-700">
                                {Number(s.graceMinutes || 0)} mnt
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => upsertShiftAssignment(emp, selectedDate, s.shiftId)}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    Simpan
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ABSENSI' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Absensi Harian</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Check-in, alpha, dan riwayat</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Denda Alpha</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={alphaDeductionPercent}
                        onChange={(e) => setAlphaDeductionPercent(Number(e.target.value || 0))}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black outline-none text-center"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                {attendanceLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[820px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Check-in</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Check-out</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {employees
                          .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
                          .map((emp) => {
                            const rec = attendanceByEmployeeId.get(emp.id);
                            const status = rec?.status || '-';
                            return (
                              <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs border border-emerald-100">
                                      {emp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">{emp.role}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                    status === 'HADIR'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : status === 'ALPHA'
                                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                                        : status === 'CUTI'
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                          : status === 'SAKIT'
                                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                                            : 'bg-slate-50 text-slate-600 border-slate-100'
                                  }`}>
                                    {status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                  {rec?.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-700">
                                  {rec?.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => markAttendance(emp, 'HADIR', selectedDate)}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                      Check-in
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => checkOutAttendance(emp, selectedDate)}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black"
                                    >
                                      Check-out
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => markAttendance(emp, 'ALPHA', selectedDate)}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700"
                                    >
                                      Alpha
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => markAttendance(emp, 'CUTI', selectedDate)}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700"
                                    >
                                      Cuti
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => markAttendance(emp, 'SAKIT', selectedDate)}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-600 text-white hover:bg-amber-700"
                                    >
                                      Sakit
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'PAYROLL' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Payroll</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Slip gaji bulanan + tunjangan/potongan</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                    <span className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      payrollRun?.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : payrollRun?.status === 'PAID'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          : payrollRun?.status === 'SUBMITTED'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {payrollRun?.status || 'DRAFT'}
                    </span>
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <input type="checkbox" checked={includeTHR} onChange={(e) => setIncludeTHR(e.target.checked)} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Include THR</span>
                    </label>
                    <button
                      type="button"
                      onClick={savePayrollRunOptions}
                      className="px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
                    >
                      Simpan
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Denda Alpha</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={alphaDeductionPercent}
                        onChange={(e) => setAlphaDeductionPercent(Number(e.target.value || 0))}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black outline-none text-center"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={downloadBankExportCsv}
                      className="px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <Download size={16} /> Export Bank
                    </button>
                    {canApprovePayroll && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPayrollRunStatus('SUBMITTED')}
                          className="px-4 py-2.5 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-700"
                        >
                          Submit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayrollRunStatus('APPROVED')}
                          className="px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setPayrollRunStatus('PAID')}
                          className="px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          Paid
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {payrollLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1680px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Gaji Pokok</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Hadir</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Alpha</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Cuti</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Telat</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Lembur (menit)</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Lembur</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">BPJS</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">PPh21</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Pinjaman</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Reimburse</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">THR</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">KPI</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Adj Tunjangan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Adj Potongan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">THP</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payrollRows.length === 0 ? (
                          <tr>
                            <td colSpan={18} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Tidak ada karyawan aktif.</td>
                          </tr>
                        ) : (
                          payrollRows.map((r: any) => (
                            <tr key={r.employeeId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs border border-emerald-100">
                                    {String(r.employeeName || '').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{r.employeeName}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{r.employeeId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-800">Rp {Number(r.baseSalary).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-center text-xs font-black text-slate-700">{r.attendanceDays}</td>
                              <td className="px-6 py-4 text-center text-xs font-black text-rose-700">{r.alphaDays}</td>
                              <td className="px-6 py-4 text-center text-xs font-black text-indigo-700">{r.paidLeaveDays}/{r.unpaidLeaveDays}</td>
                              <td className="px-6 py-4 text-center text-xs font-black text-amber-700">{r.lateMinutes}</td>
                              <td className="px-6 py-4 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-center outline-none"
                                  value={payrollAdjustments[r.employeeId]?.overtimeMinutes ?? 0}
                                  onChange={(e) => savePayrollAdjustment(r.employeeId, { overtimeMinutes: Number(e.target.value || 0) })}
                                />
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-900">Rp {Number(r.overtimePay).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-right outline-none"
                                  value={payrollAdjustments[r.employeeId]?.bpjsEmployee ?? r.bpjsEmployee}
                                  onChange={(e) => savePayrollAdjustment(r.employeeId, { bpjsEmployee: Number(e.target.value || 0) })}
                                />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-right outline-none"
                                  value={payrollAdjustments[r.employeeId]?.pph21 ?? r.pph21}
                                  onChange={(e) => savePayrollAdjustment(r.employeeId, { pph21: Number(e.target.value || 0) })}
                                />
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {Number(r.loanDeduction).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {Number(r.reimbursements).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {Number(r.thr).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {Number(r.kpiBonus).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-right outline-none"
                                  value={payrollAdjustments[r.employeeId]?.allowances ?? 0}
                                  onChange={(e) => savePayrollAdjustment(r.employeeId, { allowances: Number(e.target.value || 0) })}
                                />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-right outline-none"
                                  value={payrollAdjustments[r.employeeId]?.deductions ?? 0}
                                  onChange={(e) => savePayrollAdjustment(r.employeeId, { deductions: Number(e.target.value || 0) })}
                                />
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-900">Rp {Number(r.takeHomePay).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={slipBusyId === r.employeeId}
                                    onClick={() => generateSlip(r)}
                                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    Generate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadSlipPdf(r.slipId)}
                                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black"
                                  >
                                    PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'CUTI' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 tracking-tight">Cuti & Izin</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengajuan, approval, dan arsip</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeaveModalOpen(true)}
                    className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Buat Pengajuan
                  </button>
                </div>

                {leaveLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Dibayar</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {leaveRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Belum ada pengajuan.</td>
                          </tr>
                        ) : (
                          leaveRequests.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-800">{r.employeeName}</p>
                                <p className="text-[10px] font-bold text-slate-400">{r.employeeId}</p>
                              </td>
                              <td className="px-6 py-4 text-xs font-black text-slate-700">{r.type}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-700">{r.startDate} → {r.endDate}</td>
                              <td className="px-6 py-4 text-xs font-black text-slate-700">{r.paid ? 'YA' : 'TIDAK'}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                  r.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : r.status === 'REJECTED'
                                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                                      : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {r.status === 'PENDING' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setLeaveStatus(r, 'APPROVED')}
                                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setLeaveStatus(r, 'REJECTED')}
                                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setLeaveStatus(r, 'PENDING')}
                                      className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-black"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'KPI' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Target size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">KPI</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score bulanan + bonus</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="month"
                      value={kpiMonth}
                      onChange={(e) => setKpiMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => fetchKpiInputs(kpiMonth)}
                      className="px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {kpiLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[980px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Score</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Bonus</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Catatan</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {employees.filter((e) => String(e.status || '').toUpperCase() === 'AKTIF').map((emp) => {
                          const row = kpiScores[emp.id] || { score: 0, bonusAmount: 0, notes: '' };
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-800">{emp.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{emp.role}</p>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={row.score}
                                  onChange={(e) => setKpiScores((p) => ({ ...p, [emp.id]: { ...row, score: Number(e.target.value || 0) } }))}
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-center outline-none"
                                />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.bonusAmount}
                                  onChange={(e) => setKpiScores((p) => ({ ...p, [emp.id]: { ...row, bonusAmount: Number(e.target.value || 0) } }))}
                                  className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-right outline-none"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <input
                                  value={row.notes}
                                  onChange={(e) => setKpiScores((p) => ({ ...p, [emp.id]: { ...row, notes: e.target.value } }))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                                  placeholder="Opsional"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => saveKpi(emp)}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    Simpan
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'REKRUTMEN' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Briefcase size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Rekrutmen</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline kandidat</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCandidateModalOpen(true)}
                      className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} /> Tambah Kandidat
                    </button>
                  </div>
                </div>

                {candidatesLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Kandidat</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Posisi</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ekspektasi</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Stage</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {candidates.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Belum ada kandidat.</td>
                          </tr>
                        ) : (
                          candidates.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-800">{c.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">{c.phone || '-'} • {c.email || '-'}</p>
                              </td>
                              <td className="px-6 py-4 text-xs font-black text-slate-700">{c.position || '-'}</td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {Number(c.expectedSalary || 0).toLocaleString('id-ID')}</td>
                              <td className="px-6 py-4">
                                <select
                                  value={c.stage}
                                  onChange={(e) => updateCandidateStage(c, e.target.value as CandidateStage)}
                                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none"
                                >
                                  <option value="APPLIED">APPLIED</option>
                                  <option value="INTERVIEW">INTERVIEW</option>
                                  <option value="OFFER">OFFER</option>
                                  <option value="HIRED">HIRED</option>
                                  <option value="REJECTED">REJECTED</option>
                                </select>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => convertCandidateToEmployee(c)}
                                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700"
                                  >
                                    Hire
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'PETTY_CASH' && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl text-white">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Petty Cash Karyawan</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo + transaksi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="month"
                      value={pettyCashMonth}
                      onChange={(e) => setPettyCashMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setPettyModalOpen(true)}
                      className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} /> Tambah Transaksi
                    </button>
                  </div>
                </div>

                {pettyCashLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6">
                    <div className="xl:col-span-1 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Saldo</h3>
                      <div className="space-y-3">
                        {employees.filter((e) => String(e.status || '').toUpperCase() === 'AKTIF').map((e) => (
                          <div key={e.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                            <div>
                              <p className="text-xs font-black text-slate-800">{e.name}</p>
                              <p className="text-[10px] font-bold text-slate-400">{e.role}</p>
                            </div>
                            <div className="text-xs font-black text-slate-900">
                              Rp {Number(pettyCashBalances[e.id] || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
                      <div className="p-5 border-b border-slate-100">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Transaksi</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[820px]">
                          <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Nominal</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {pettyCashTx.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm font-medium">Belum ada transaksi.</td>
                              </tr>
                            ) : (
                              pettyCashTx.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-6 py-4 text-xs font-black text-slate-700">{t.date}</td>
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-black text-slate-800">{t.employeeName}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{t.employeeId}</p>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-black text-slate-700">{t.type}</td>
                                  <td className={`px-6 py-4 text-right text-xs font-black ${t.type === 'TOPUP' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    Rp {Number(t.amount || 0).toLocaleString('id-ID')}
                                  </td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-700">{t.description || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL TAMBAH/EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingId ? 'Edit Data Staff' : 'Registrasi Staff Baru'}</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Lengkapi informasi karyawan di bawah ini.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>


            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="Nama staff" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kontak (WA)</label>
                  <input 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                    placeholder="08xxx" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan</label>
                  <select 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option>Karyawan Toko</option>
                    <option>Kasir</option>
                    <option>Kurir</option>
                    <option>Admin Gudang</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NON-AKTIF' })} 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="NON-AKTIF">NON-AKTIF</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gaji Bulanan (Rp)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Rp</span>
                   <input 
                     type="number" 
                     required 
                     value={formData.manualSalary} 
                     onChange={e => setFormData({ ...formData, manualSalary: Number(e.target.value) })} 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                   />
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jadwal Shift</label>
                <div className="relative">
                   <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     required 
                     value={formData.workSchedule} 
                     onChange={e => setFormData({ ...formData, workSchedule: e.target.value })} 
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none" 
                     placeholder="Contoh: 08:00 - 16:00" 
                   />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank</label>
                  <input
                    value={formData.bankName}
                    onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="BCA/BRI/BNI/..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No Rekening</label>
                  <input
                    value={formData.bankAccount}
                    onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Rekening</label>
                  <input
                    value={formData.bankAccountName}
                    onChange={e => setFormData({ ...formData, bankAccountName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="Atas nama"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NPWP</label>
                  <input
                    value={formData.npwp}
                    onChange={e => setFormData({ ...formData, npwp: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kontrak</label>
                  <select
                    value={formData.contractType}
                    onChange={e => setFormData({ ...formData, contractType: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="Tetap">Tetap</option>
                    <option value="Kontrak">Kontrak</option>
                    <option value="Magang">Magang</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mulai</label>
                  <input
                    type="date"
                    value={formData.contractStart}
                    onChange={e => setFormData({ ...formData, contractStart: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selesai</label>
                  <input
                    type="date"
                    value={formData.contractEnd}
                    onChange={e => setFormData({ ...formData, contractEnd: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save size={18} /> {editingId ? 'Simpan Perubahan' : 'Simpan Data Staff'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {leaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Buat Pengajuan</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Cuti, izin, atau sakit.</p>
              </div>
              <button onClick={() => setLeaveModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitLeave} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Karyawan</label>
                <select
                  value={leaveForm.employeeId}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, employeeId: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                >
                  <option value="">Pilih</option>
                  {employees
                    .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value as LeaveRequestType }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="CUTI">CUTI</option>
                    <option value="IZIN">IZIN</option>
                    <option value="SAKIT">SAKIT</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dibayar</label>
                  <select
                    value={leaveForm.paid ? 'YA' : 'TIDAK'}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, paid: e.target.value === 'YA' }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="YA">YA</option>
                    <option value="TIDAK">TIDAK</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mulai</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selesai</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alasan</label>
                <input
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="Opsional"
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save size={18} /> Simpan Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {candidateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Tambah Kandidat</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Masukkan data kandidat rekrutmen.</p>
              </div>
              <button onClick={() => setCandidateModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={createCandidate} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama</label>
                <input
                  required
                  value={candidateForm.name}
                  onChange={(e) => setCandidateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kontak</label>
                  <input
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Posisi</label>
                  <input
                    value={candidateForm.position}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, position: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ekspektasi Gaji</label>
                  <input
                    type="number"
                    value={candidateForm.expectedSalary}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, expectedSalary: Number(e.target.value || 0) }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stage</label>
                  <select
                    value={candidateForm.stage}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, stage: e.target.value as CandidateStage }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="APPLIED">APPLIED</option>
                    <option value="INTERVIEW">INTERVIEW</option>
                    <option value="OFFER">OFFER</option>
                    <option value="HIRED">HIRED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sumber</label>
                  <input
                    value={candidateForm.source}
                    onChange={(e) => setCandidateForm((p) => ({ ...p, source: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="IG, Walk-in, Referensi..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan</label>
                <input
                  value={candidateForm.notes}
                  onChange={(e) => setCandidateForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save size={18} /> Simpan Kandidat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pettyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Petty Cash</h2>
                <p className="text-xs text-slate-400 font-medium mt-1">Tambah transaksi petty cash karyawan.</p>
              </div>
              <button onClick={() => setPettyModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={savePettyCashTx} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Karyawan</label>
                <select
                  value={pettyForm.employeeId}
                  onChange={(e) => setPettyForm((p) => ({ ...p, employeeId: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                >
                  <option value="">Pilih</option>
                  {employees
                    .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
                    .map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                  <input
                    type="date"
                    value={pettyForm.date}
                    onChange={(e) => setPettyForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                  <select
                    value={pettyForm.type}
                    onChange={(e) => setPettyForm((p) => ({ ...p, type: e.target.value as PettyCashTxType }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                  >
                    <option value="TOPUP">TOPUP</option>
                    <option value="SPEND">SPEND</option>
                    <option value="REIMBURSE">REIMBURSE</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal</label>
                <input
                  type="number"
                  min={0}
                  value={pettyForm.amount}
                  onChange={(e) => setPettyForm((p) => ({ ...p, amount: Number(e.target.value || 0) }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                <input
                  value={pettyForm.description}
                  onChange={(e) => setPettyForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="Opsional"
                />
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <Save size={18} /> Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
