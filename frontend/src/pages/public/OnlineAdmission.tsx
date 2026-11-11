import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { api, apiErrorMessage } from '../../services/api';
const schema = z.object({
  studentName: z.string().min(2), dateOfBirth: z.string().min(1, 'Date of birth required'), gender: z.enum(['male','female','other']),
  guardianName: z.string().min(2), guardianRelation: z.string().optional().or(z.literal('')), guardianEmail: z.string().email(), guardianPhone: z.string().min(7),
  desiredClass: z.string().min(1), previousSchool: z.string().optional().or(z.literal('')), address: z.string().min(5), city: z.string().optional().or(z.literal('')),
  document1: z.string().optional().or(z.literal('')), document2: z.string().optional().or(z.literal('')),
}); type FormData = z.infer<typeof schema>;
export default function OnlineAdmission() {
  const [state, setState] = useState<'idle'|'sent'|'error'>('idle'); const [msg, setMsg] = useState(''); const [refId, setRefId] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setState('idle'); setMsg('');
    const documents = [data.document1, data.document2].filter((d): d is string => !!d && d.trim().length > 0).map((name) => ({ name: name.trim() }));
    const payload = {
      studentName: data.studentName, dateOfBirth: data.dateOfBirth, gender: data.gender,
      guardianName: data.guardianName, guardianRelation: data.guardianRelation || undefined,
      guardianEmail: data.guardianEmail, guardianPhone: data.guardianPhone,
      previousSchool: data.previousSchool || undefined, desiredClass: data.desiredClass,
      address: data.address, city: data.city || undefined, documents,
    };
    try {
      const r = await api.post('/admissions/public', payload);
      // Success is shown ONLY on a real 2xx — the application is saved with status "Submitted".
      setRefId(String(r.data?.data?.id ?? ''));
      setState('sent'); reset();
    } catch (e) {
      const s = (e as { response?: { status?: number } })?.response?.status;
      setState('error');
      setMsg(s === 503
        ? 'The school database is not connected right now, so your application was NOT saved. Please try again later or contact the school office directly.'
        : apiErrorMessage(e));
    }
  };
  return (<div className="max-w-2xl mx-auto px-4 py-10"><h1 className="text-3xl font-bold mb-2">Online Admission Application</h1>
  <p className="text-slate-600 mb-6">Submitting creates an application with status “Submitted”. The office reviews it (Under Review), then Admin/Principal approve or reject it. Enrollment (admission number, class assignment, fee challan) follows approval — see Admissions in docs/workflows.md.</p>
  <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-4"><div><label className="block text-sm font-medium mb-1">Student full name</label><input type="text" className="w-full border rounded px-3 py-2" {...register('studentName')} />{errors.studentName && <p className="text-red-600 text-xs mt-1">{errors.studentName?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Date of birth</label><input type="date" className="w-full border rounded px-3 py-2" {...register('dateOfBirth')} />{errors.dateOfBirth && <p className="text-red-600 text-xs mt-1">{errors.dateOfBirth?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Gender</label><select className="w-full border rounded px-3 py-2" {...register('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div><div><label className="block text-sm font-medium mb-1">Parent / guardian name</label><input type="text" className="w-full border rounded px-3 py-2" {...register('guardianName')} />{errors.guardianName && <p className="text-red-600 text-xs mt-1">{errors.guardianName?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Guardian relation (optional, e.g. Father)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('guardianRelation')} /></div><div><label className="block text-sm font-medium mb-1">Guardian email</label><input type="email" className="w-full border rounded px-3 py-2" {...register('guardianEmail')} />{errors.guardianEmail && <p className="text-red-600 text-xs mt-1">{errors.guardianEmail?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Guardian phone</label><input type="text" className="w-full border rounded px-3 py-2" {...register('guardianPhone')} />{errors.guardianPhone && <p className="text-red-600 text-xs mt-1">{errors.guardianPhone?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Desired class (e.g. Class 6)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('desiredClass')} />{errors.desiredClass && <p className="text-red-600 text-xs mt-1">{errors.desiredClass?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Previous school (optional)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('previousSchool')} />{errors.previousSchool && <p className="text-red-600 text-xs mt-1">{errors.previousSchool?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Home address</label><input type="text" className="w-full border rounded px-3 py-2" {...register('address')} />{errors.address && <p className="text-red-600 text-xs mt-1">{errors.address?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">City (optional)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('city')} /></div>
  <fieldset className="border rounded p-3 space-y-3"><legend className="text-sm font-medium px-1">Supporting documents (names only)</legend>
  <p className="text-xs text-slate-500">List the documents you will provide (e.g. “Birth certificate”, “Previous report card”). Only the names are recorded with this application — the office collects the actual documents, because secure file upload is enabled only when Cloudinary/S3 storage is configured (§34).</p>
  <div><label className="block text-sm mb-1">Document 1 name (optional)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('document1')} /></div>
  <div><label className="block text-sm mb-1">Document 2 name (optional)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('document2')} /></div></fieldset>
  {state === 'sent' && <p className="text-success text-sm font-medium">Application submitted successfully with status “Submitted”. The school office will contact the guardian.{refId ? ` Application reference: ${refId}` : ''}</p>}
  {state === 'error' && <p className="text-red-600 bg-red-50 border border-red-200 rounded p-3 text-sm">{msg}</p>}
  <button disabled={isSubmitting} className="bg-brand text-white px-5 py-2.5 rounded font-medium disabled:opacity-50">{isSubmitting ? 'Submitting…' : 'Submit Application'}</button></form></div>);
}
