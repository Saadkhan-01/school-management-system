
import { Link, NavLink, Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
const links: Array<[string, string]> = [['/','Home'],['/about','About Us'],['/principal-message',"Principal's Message"],['/academics','Academics'],['/classes','Classes'],['/faculty','Faculty'],['/admissions','Admissions'],['/facilities','Facilities'],['/news-events','News & Events'],['/gallery','Gallery'],['/contact','Contact Us']];
export default function PublicLayout() {
  return (<div className="min-h-screen flex flex-col">
    <header className="bg-navy text-white sticky top-0 z-20 shadow">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg"><GraduationCap className="text-sky-400" /> Greenfield School <span className="text-[10px] font-normal bg-amber-500 text-navy rounded px-1.5 py-0.5">DEMO NAME</span></Link>
        <nav className="flex gap-1 flex-wrap ml-auto text-sm">{links.map(([to, label]) => (<NavLink key={to} to={to} className={({ isActive }) => `px-2.5 py-1.5 rounded hover:bg-white/10 ${isActive ? 'bg-brand' : ''}`}>{label}</NavLink>))}
        <Link to="/online-admission" className="px-3 py-1.5 rounded bg-brand font-medium">Online Admission</Link>
        <Link to="/login" className="px-3 py-1.5 rounded bg-white text-navy font-medium">Login</Link></nav>
      </div>
    </header>
    <main className="flex-1"><Outlet /></main>
    <footer className="bg-navy text-slate-300 text-sm"><div className="max-w-7xl mx-auto px-4 py-8 grid gap-6 md:grid-cols-3">
      <div><p className="text-white font-semibold mb-2">Greenfield School (Demo)</p><p>Sample public website content — managed from Admin → Website Management in the ERP (Phase 2 CMS). Replace with real school details.</p></div>
      <div><p className="text-white font-semibold mb-2">Quick Links</p><ul className="space-y-1"><li><Link className="hover:text-white" to="/admissions">Admissions</Link></li><li><Link className="hover:text-white" to="/online-admission">Online Admission</Link></li><li><Link className="hover:text-white" to="/news-events">News & Events</Link></li><li><Link className="hover:text-white" to="/contact">Contact</Link></li></ul></div>
      <div><p className="text-white font-semibold mb-2">Contact (Demo)</p><p>123 Education Road, Springfield<br/>office@example-school.edu<br/>+1 (555) 010-2030</p></div>
    </div><div className="border-t border-white/10 py-3 text-center text-xs">© {new Date().getFullYear()} Greenfield School — Demo content for development.</div></footer>
  </div>);
}
