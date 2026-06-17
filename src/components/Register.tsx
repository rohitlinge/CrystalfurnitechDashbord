import React, { useState } from 'react';
import { DBService } from '../firebase';
import { ArrowLeft, Building2, User, Phone, Mail, FileText, MapPin, Map, CheckCircle2, Lock } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { motion } from 'motion/react';

interface RegisterProps {
  onBackToLogin: () => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry"
];

export default function Register({ onBackToLogin }: RegisterProps) {
  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    mobile: '',
    email: '',
    gstNumber: '',
    city: '',
    state: 'Maharashtra',
    address: '',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registeredSuccessfully, setRegisteredSuccessfully] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validations
    if (!formData.companyName || !formData.ownerName || !formData.mobile || !formData.email || 
        !formData.gstNumber || !formData.city || !formData.state || !formData.address || 
        !formData.password) {
      setError("Please fill in all requested fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    // GST validation pattern check (Indian GST is 15 chars)
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstPattern.test(formData.gstNumber.toUpperCase())) {
      setError("Please enter a valid 15-character Indian GST state code number (e.g., 27AAAAA1111A1Z1).");
      return;
    }

    // Mobile Validation (10 digits)
    if (!/^[6-9]\d{9}$/.test(formData.mobile)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    setLoadingStep('Creating your account...');

    try {
      await DBService.register({
        companyName: formData.companyName,
        ownerName: formData.ownerName,
        mobile: formData.mobile,
        email: formData.email,
        gstNumber: formData.gstNumber.toUpperCase(),
        city: formData.city,
        state: formData.state,
        address: formData.address,
        password: formData.password
      });

      setRegisteredSuccessfully(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during account registration. Please try again.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  if (registeredSuccessfully) {
    return (
      <div className="w-full max-w-2xl bg-[#222222] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-8 sm:p-12 text-center flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 rounded-full flex items-center justify-center mb-6"
          >
            <CheckCircle2 className="w-12 h-12" />
          </motion.div>
          <h2 id="register-success-title" className="text-3xl font-bold text-white tracking-tight mb-4">
            Thank You For Registering
          </h2>
          <div className="max-w-md mx-auto space-y-4 text-neutral-400 leading-relaxed text-sm mb-8">
            <p className="font-semibold text-white text-base">
              Your account has been submitted for verification.
            </p>
            <p>
              Our team will review your details (including GST representation, mobile coordinates, and retail footprint) and approve your dealer access shortly.
            </p>
            <p className="bg-[#b65200]/15 text-[#d4af37] py-3 px-4 rounded-lg border border-[#d4af37]/30 font-medium text-center">
              You will be able to access the dealer portal after approval.
            </p>
          </div>
          
          <button 
            type="button"
            id="back-to-login"
            onClick={onBackToLogin}
            className="w-full py-3 cf-btn-brand transition rounded-lg font-medium text-sm flex items-center justify-center gap-2 max-w-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Proceed to Login Area
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl bg-[#222222] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="bg-[#171717] p-6 sm:p-8 text-white relative border-b border-[#d4af37]/20">
        <button 
          id="btn-back-login"
          onClick={onBackToLogin}
          className="absolute left-6 top-6 sm:top-8 bg-[#b65200]/20 hover:bg-[#b65200] text-[#d4af37] hover:text-white p-2 rounded-lg border border-[#d4af37]/30 transition duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center pt-8 flex flex-col items-center">
          <BrandLogo variant="light" size="lg" subtitle="Dealer Registration" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6">
        <h2 id="reg-sec-hdr" className="text-lg font-semibold text-[#d4af37] border-b border-white/10 pb-2 flex items-center gap-2">
          Dealer Profile & Corporate Metrics
        </h2>

        {error && (
          <div id="reg-error-msg" className="bg-[#ef4444]/10 text-[#ef4444] text-xs font-medium py-3 px-4 rounded-lg border border-[#ef4444]/30 leading-snug">
            {error}
          </div>
        )}

        {/* Form Fields arranged in grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Company Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Company Name *</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="companyName"
                name="companyName"
                type="text"
                required
                value={formData.companyName}
                onChange={handleChange}
                placeholder="e.g. Apex Woodcraft Pvt Ltd"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Owner Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Owner Full Name *</label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="ownerName"
                name="ownerName"
                type="text"
                required
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="e.g. Harish Kumar"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Mobile Number *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="mobile"
                name="mobile"
                type="tel"
                required
                value={formData.mobile}
                onChange={handleChange}
                placeholder="10-digit Indian Mobile, e.g. 9876543210"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="procurement@apexwood.com"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* GST Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">GST Number * <span className="text-zinc-500 font-normal">(15 Characters)</span></label>
            <div className="relative">
              <FileText className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="gstNumber"
                name="gstNumber"
                type="text"
                required
                maxLength={15}
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="e.g. 27AAAAA1111A1Z1"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm uppercase"
              />
            </div>
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">City *</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="city"
                name="city"
                type="text"
                required
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Mumbai"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* State */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">State *</label>
            <div className="relative">
              <Map className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <select 
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="cf-input w-full pl-9 pr-10 py-2.5 text-sm appearance-none cursor-pointer"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st} className="bg-[#171717]">{st}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Complete Address */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-400 block">Complete Registered Business Address *</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="address"
                name="address"
                type="text"
                required
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g. Unit 302, Phase II, Industrial Logistics Hub"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Password * <span className="text-zinc-500 font-normal">(Min 6 chars)</span></label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-400 block">Confirm Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <input 
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••"
                className="cf-input w-full pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
          </div>

        </div>

        <button 
          id="btn-submit-registration"
          type="submit"
          disabled={loading}
          className="w-full py-3 cf-btn-brand disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm rounded-lg tracking-wide cursor-pointer flex items-center justify-center gap-2 mt-4"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {loadingStep || 'Registering Dealer Account...'}
            </>
          ) : "Submit wholesale registration profile"}
        </button>
      </form>
    </div>
  );
}
