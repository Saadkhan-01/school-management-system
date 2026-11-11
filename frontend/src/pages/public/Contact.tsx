import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { api, apiErrorMessage } from '../../services/api';
import { DemoBadge, usePublicWebsite } from '../../hooks/usePublicWebsite';
const schema = z.object({ name: z.string().min(2, 'Name is required'), email: z.string().email('Valid email required'), phone: z.string().min(7).optional().or(z.literal('')), subject: z.string().min(3), message: z.string().min(10, 'Please write at least 10 characters') }); type FormData = z.infer<typeof schema>;
export default function Contact() {
  const { content, source } = usePublicWebsite();
  const [state, setState] = useState<'idle'|'sent'|'error'>('idle'); const [msg, setMsg] = useState(''); const [refId, setRefId] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setState('idle'); setMsg('');
    try {
      const r = await api.post('/website/enquiries', data);
      // Success is shown ONLY on a real 2xx from the API (the enquiry is saved in MongoDB).
      setRefId(String(r.data?.data?.id ?? ''));
      setState('sent'); reset();
    } catch (e) {
      const s = (e as { response?: { status?: number } })?.response?.status;
      setState('error');
      setMsg(s === 503
        ? 'The school database is not connected right now, so your message was NOT saved. Please try again later, or contact the school directly using the details on this page.'
        : apiErrorMessage(e));
    }
  };
  return (<div className="max-w-2xl mx-auto px-4 py-10"><h1 className="text-3xl font-bold mb-2">Contact Us</h1>
  <DemoBadge source={source} />
  <p className="text-slate-600 mb-6 mt-2">{content.contact.email} · {content.contact.phone} · {content.contact.address}{content.contact.city ? `, ${content.contact.city}` : ''}{content.contact.officeHours ? ` · Office hours: ${content.contact.officeHours}` : ''}</p>
  {content.contact.mapLink && <p className="mb-6"><a className="text-brand text-sm font-medium" href={content.contact.mapLink} target="_blank" rel="noreferrer">View location on map →</a></p>}
  <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-4"><div><label className="block text-sm font-medium mb-1">Your name</label><input type="text" className="w-full border rounded px-3 py-2" {...register('name')} />{errors.name && <p className="text-red-600 text-xs mt-1">{errors.name?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Email</label><input type="email" className="w-full border rounded px-3 py-2" {...register('email')} />{errors.email && <p className="text-red-600 text-xs mt-1">{errors.email?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Phone (optional)</label><input type="text" className="w-full border rounded px-3 py-2" {...register('phone')} />{errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Subject</label><input type="text" className="w-full border rounded px-3 py-2" {...register('subject')} />{errors.subject && <p className="text-red-600 text-xs mt-1">{errors.subject?.message as string}</p>}</div><div><label className="block text-sm font-medium mb-1">Message</label><textarea rows={4} className="w-full border rounded px-3 py-2" {...register('message')} />{errors.message && <p className="text-red-600 text-xs mt-1">{errors.message?.message as string}</p>}</div>
  {state === 'sent' && <p className="text-success text-sm font-medium">Submitted successfully — your enquiry was saved and the school office will contact you.{refId ? ` Reference: ${refId}` : ''}</p>}
  {state === 'error' && <p className="text-red-600 bg-red-50 border border-red-200 rounded p-3 text-sm">{msg}</p>}
  <button disabled={isSubmitting} className="bg-brand text-white px-5 py-2.5 rounded font-medium disabled:opacity-50">{isSubmitting ? 'Submitting…' : 'Submit'}</button></form></div>);
}
