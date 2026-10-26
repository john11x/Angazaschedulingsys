import { Link } from 'react-router';
import heroImage from '@/assets/images/landingpages/Digital-Literacy-Lab-image-2048x1143.jpg';
import whoWeAreImage from '@/assets/images/landingpages/Kitambo05-1.jpg';

const LOGO_SRC = '/logos/angaza-center-horizontal-logo-full-color.png';
const ANGAZA_SITE = 'https://www.angazacenter.org';

const navLinks = [
  { label: 'About', href: `${ANGAZA_SITE}/about` },
  { label: 'What We Do', href: `${ANGAZA_SITE}/what-we-do` },
  { label: 'Contact', href: `${ANGAZA_SITE}/contact` },
] as const;

const footerContact = {
  email: 'contact@angazacenter.org',
  phoneNA: '+1 312-380-1708',
  phoneAfrica: '+254 11 3630966',
};

const footerLearnMore = [
  { label: 'Member Schools', href: `${ANGAZA_SITE}/member-schools` },
  { label: 'What We Do', href: `${ANGAZA_SITE}/what-we-do` },
  { label: 'Blogs', href: `${ANGAZA_SITE}/blogs` },
] as const;

const footerGetInvolved = [
  { label: 'Donate', href: `${ANGAZA_SITE}/donate` },
  { label: 'Become a Volunteer', href: `${ANGAZA_SITE}/get-involved` },
  { label: 'Contact Us', href: `${ANGAZA_SITE}/contact` },
] as const;

function ExternalLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      {/* Top bar */}
      <div className="bg-[var(--color-landing-dark)] text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>Africa {footerContact.phoneAfrica}</span>
          <span>US {footerContact.phoneNA}</span>
          <ExternalLink href={`mailto:${footerContact.email}`} className="text-white/90 hover:text-white">
            {footerContact.email}
          </ExternalLink>
        </div>
      </div>

      {/* Main nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <ExternalLink href={ANGAZA_SITE}>
            <img
              src={LOGO_SRC}
              alt="Angaza Center"
              className="h-9 w-auto object-contain"
            />
          </ExternalLink>
          <nav className="flex items-center gap-6">
            {navLinks.map(({ label, href }) => (
              <ExternalLink
                key={label}
                href={href}
                className="text-slate-700 hover:text-[var(--color-brand)] font-medium transition-colors"
              >
                {label}
              </ExternalLink>
            ))}
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-lg bg-[var(--color-brand)] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <img
          src={heroImage}
          alt="Digital literacy in the classroom"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[var(--color-landing-dark)]/75" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Digital literacy is as critical as reading skills
          </h1>
          <p className="text-xl text-white/95 mb-8">
            We improve economic and social standing of young people in rural African high schools. Connect with peer trainers and schedule sessions.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 rounded-lg bg-[var(--color-brand)] text-white font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
          >
            It takes all of us — Get Started
          </Link>
        </div>
      </section>

      {/* Who We Are */}
      <section className="max-w-7xl mx-auto px-4 py-20 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-1 w-12 bg-[var(--color-brand)] rounded-full"></div>
            <h2 className="text-3xl lg:text-4xl font-bold text-[var(--color-landing-dark)] whitespace-nowrap">
              Who We Are
            </h2>
            <div className="h-1 w-12 bg-[var(--color-brand)] rounded-full"></div>
          </div>
          <p className="text-slate-600 text-lg leading-relaxed mb-6">
            A lack of computer literacy among students in rural and low-income communities—especially in Africa—limits their opportunities and reinforces inequality.
          </p>
          <p className="text-slate-600 text-lg leading-relaxed">
            Information technology literacy should no longer be an exception regardless of economic circumstances or social context.
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-[var(--color-brand)] rounded-xl transform translate-x-3 translate-y-3 opacity-20"></div>
          <img
            src={whoWeAreImage}
            alt="Students learning with laptops"
            className="relative w-full rounded-xl shadow-xl object-cover aspect-[4/3] border-4 border-white"
          />
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-slate-100 py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-slate-700 text-lg mb-6">
            Trainers, coordinators, and lead teachers: sign in to manage availability and bookings.
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 rounded-lg bg-[var(--color-brand)] text-white font-bold hover:opacity-90 transition-opacity"
          >
            Login to P2P Scheduling
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-landing-dark)] text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-12 grid grid-cols-1 md:grid-cols-3 gap-12 border-b border-white/10">
          
          {/* Contact Details */}
          <div className="space-y-4 flex flex-col items-start">
            <h3 className="font-semibold text-lg text-white mb-2 relative inline-block">
              Contact Us
              <span className="absolute -bottom-1 left-0 w-8 h-0.5 bg-[var(--color-brand)]"></span>
            </h3>
            
            <div className="text-white/80 text-sm space-y-1">
              <p className="font-medium text-white">North America</p>
              <p>1 Overlook Point, STE 526</p>
              <p>Lincolnshire, IL 60069</p>
            </div>
            
            <div className="text-white/80 text-sm space-y-1 mt-4">
              <p className="font-medium text-white">Africa</p>
              <p>8th Floor Westcom Point, Mahiga Mairu Rd</p>
              <p>Westlands, Nairobi</p>
            </div>

            <div className="pt-2 text-sm text-white/90 font-medium">
              <ExternalLink href={`mailto:${footerContact.email}`} className="hover:text-[var(--color-brand)] transition-colors block mb-1">
                {footerContact.email}
              </ExternalLink>
              <p>US: {footerContact.phoneNA} <span className="mx-1 text-white/40">|</span> Africa: {footerContact.phoneAfrica}</p>
            </div>
          </div>
          
          {/* Learn More */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-white mb-2 relative inline-block">
              Learn More
              <span className="absolute -bottom-1 left-0 w-8 h-0.5 bg-[var(--color-brand)]"></span>
            </h3>
            <ul className="space-y-3 mt-4">
              {footerLearnMore.map(({ label, href }) => (
                <li key={label}>
                  <ExternalLink href={href} className="text-white/70 hover:text-[var(--color-brand)] text-sm transition-colors flex items-center gap-2">
                    <span className="text-[var(--color-brand)] text-xs">▸</span> {label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Get Involved */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-white mb-2 relative inline-block">
              Get Involved
              <span className="absolute -bottom-1 left-0 w-8 h-0.5 bg-[var(--color-brand)]"></span>
            </h3>
            <ul className="space-y-3 mt-4">
              {footerGetInvolved.map(({ label, href }) => (
                <li key={label}>
                  <ExternalLink href={href} className="text-white/70 hover:text-[var(--color-brand)] text-sm transition-colors flex items-center gap-2">
                    <span className="text-[var(--color-brand)] text-xs">▸</span> {label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </div>
          
        </div>
        <div className="border-t border-white/20 max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-white/80 text-sm">
          <ExternalLink href={ANGAZA_SITE} className="hover:text-white">
            {ANGAZA_SITE.replace(/^https?:\/\//, '')}
          </ExternalLink>
          <span className="hidden sm:inline">·</span>
          <span>© {new Date().getFullYear()} Angaza Center. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
