import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api, { getImageUrl } from '../utils/api';
import { compressImage, MIN_RECOMMENDED_WIDTH } from '../utils/imageCompression';
import { Car, Check, X, UploadCloud, ChevronRight, ChevronLeft, Save, ShieldAlert } from 'lucide-react';

const TOTAL_STEPS = 5;

const FEATURES_LIST = [
  'Air Conditioning', 'Leather Seats', 'Reverse Camera', 'Sunroof',
  'Bluetooth', 'Apple CarPlay', 'Android Auto', 'Keyless Entry',
  'Parking Sensors', 'Cruise Control', 'Heated Seats', 'Navigation System',
  'Push Start', 'Alloy Wheels', 'Tinted Windows',
];

const emptyForm = {
  make: '', model: '', year: '', price: '', location: '', condition: 'FOREIGN_USED',
  mileage: '', transmission: 'AUTOMATIC', fuelType: 'PETROL',
  engineSize: '', bodyType: '', color: '', description: '',
  features: [],
};

const SellCar = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [billing, setBilling] = useState(null);

  useEffect(() => {
    if (!user || user.role === 'BUYER') return;
    api.get('/billing/status')
      .then(({ data }) => setBilling(data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!isEdit) return;
    const loadVehicle = async () => {
      try {
        // Edit mode needs the raw image data so an unchanged save can re-submit it
        const { data } = await api.get(`/vehicles/${id}`, { params: { withImageData: 'true' } });
        setForm({
          make:         data.make         || '',
          model:        data.model        || '',
          year:         data.year         ? String(data.year)  : '',
          price:        data.price        ? String(data.price) : '',
          location:     data.location     || '',
          condition:    data.condition    || 'FOREIGN_USED',
          mileage:      data.mileage      ? String(data.mileage) : '',
          transmission: data.transmission || 'AUTOMATIC',
          fuelType:     data.fuelType     || 'PETROL',
          engineSize:   data.engineSize   || '',
          bodyType:     data.bodyType     || '',
          color:        data.color        || '',
          description:  data.description  || '',
          features:     data.features?.map(f => f.featureName) || [],
        });
        if (data.images && data.images.length > 0) {
          setUploadedImages(data.images.map(img => img.data));
        }
      } catch (err) {
        setError('Failed to load listing for editing.');
      } finally {
        setLoading(false);
      }
    };
    loadVehicle();
  }, [id, isEdit]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Login Required</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            Please log in to your account to list a car for sale.
          </p>
          <Link to="/login" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (user.role === 'BUYER') {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-bg px-4 mt-16">
        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-12 max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Car size={32} className="text-primary" />
          </div>
          <h2 className="font-display font-semibold text-2xl text-textprimary mb-2">Become a Seller</h2>
          <p className="text-textsecondary mb-8 leading-relaxed">
            You're one step away from listing your car. Upgrade your account to a seller account — it takes less than a minute.
          </p>
          <Link to="/become-seller" className="w-full h-11 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors flex items-center justify-center">
            Upgrade to Seller
          </Link>
          <Link to="/" className="w-full h-11 mt-3 bg-bg border border-bordercol text-textprimary font-medium rounded-md hover:bg-bordercol/30 transition-colors flex items-center justify-center">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex flex-col items-center justify-center bg-bg text-textmuted">
        <div className="animate-spin w-10 h-10 border-4 border-bordercol border-t-primary rounded-full mb-4"></div>
        <p>Loading listing data...</p>
      </div>
    );
  }

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleFeature = (feat) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feat)
        ? prev.features.filter(f => f !== feat)
        : [...prev.features, feat]
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const localPreviews = files.map(f => URL.createObjectURL(f));
    setUploadedImages(prev => [...prev, ...localPreviews]);

    setUploading(true);
    setError('');
    try {
      // Compress large photos client-side so listings stay crisp and load fast
      const processed = [];
      const lowRes = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          processed.push(file); // PDFs / documents pass through untouched
          continue;
        }
        const { file: outFile, width } = await compressImage(file);
        processed.push(outFile);
        if (width < MIN_RECOMMENDED_WIDTH) {
          lowRes.push(`${file.name} (${width}px wide)`);
        }
      }
      if (lowRes.length > 0) {
        setError(
          `Heads up: ${lowRes.join(', ')} ${lowRes.length === 1 ? 'is' : 'are'} low resolution. ` +
          'Photos under 800px wide look blurry on listing pages — try uploading original photos from your camera or gallery.'
        );
      }

      const formData = new FormData();
      processed.forEach(file => formData.append('images', file));
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedImages(prev => {
        const without = prev.filter(url => !url.startsWith('blob:'));
        return [...without, ...data.urls];
      });
    } catch (err) {
      setUploadedImages(prev => prev.filter(url => !url.startsWith('blob:')));
      setError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');

    const requiredFields = ['make', 'model', 'year', 'price', 'location'];
    const missing = requiredFields.filter(f => !form[f] || String(form[f]).trim() === '');
    if (missing.length > 0) {
      setError(`Please fill in all required fields: ${missing.join(', ')}`);
      return;
    }

    const yearNum  = parseInt(form.year, 10);
    const priceNum = parseFloat(form.price);
    if (Number.isNaN(yearNum) || yearNum < 1960 || yearNum > new Date().getFullYear() + 1) {
      setError('Please enter a valid year (e.g. 2020).');
      return;
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid price.');
      return;
    }

    const finalImages = uploadedImages.filter(url => !url.startsWith('blob:'));

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        year:   yearNum,
        price:  priceNum,
        mileage: form.mileage ? parseInt(form.mileage, 10) : undefined,
        images: finalImages.map((data, i) => ({ data, isPrimary: i === 0 })),
      };

      if (isEdit) {
        const { data } = await api.put(`/vehicles/${id}`, payload);
        navigate(`/car/${data.id}`);
      } else {
        const { data } = await api.post('/vehicles', payload);
        navigate(`/car/${data.id}`);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to save listing. Please try again.';
      setError(err.response?.data?.upgradeRequired ? `${message} Visit the Pricing page to upgrade.` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Basic Info', 'Specs', 'Features', 'Photos', 'Review'];

  return (
    <div className="bg-bg min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-textprimary mb-2">
            {isEdit ? 'Edit Listing' : 'Sell Your Car'}
          </h1>
          <p className="text-textsecondary">
            {isEdit
              ? 'Update your listing details. It will be reviewed again by our team.'
              : 'Fill in the details to create your listing'}
          </p>

          {billing && (
            <div className="mt-4 inline-flex flex-wrap items-center gap-2 bg-surface border border-bordercol rounded-md px-4 py-2.5 text-sm">
              <span className="font-medium text-textprimary">
                {billing.plan.label} plan
              </span>
              <span className="text-textsecondary">
                {billing.listingLimit === null
                  ? `· ${billing.listingsUsed} listings (unlimited)`
                  : `· ${billing.listingsUsed} of ${billing.listingLimit} listings used`}
              </span>
              {billing.listingLimit !== null && billing.listingsUsed >= billing.listingLimit && (
                <Link to="/pricing" className="text-primary font-medium hover:underline">
                  · Limit reached — upgrade
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex items-center min-w-[500px]">
            {stepLabels.map((label, i) => {
              const current = i + 1;
              const isPast = step > current;
              const isActive = step === current;
              
              return (
                <React.Fragment key={label}>
                  <div className={`flex flex-col items-center flex-1 relative ${isPast || isActive ? 'text-primary' : 'text-textmuted'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 z-10 transition-colors ${
                      isPast ? 'bg-primary text-white' : isActive ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-surface border-2 border-bordercol text-textmuted'
                    }`}>
                      {isPast ? <Check size={16} /> : current}
                    </div>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className="flex-1 h-1 bg-bordercol mx-2 rounded-full relative -top-3">
                      <div 
                        className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-300" 
                        style={{ width: step > current ? '100%' : '0%' }}
                      ></div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-err/10 border border-err/20 rounded-md text-err text-sm font-medium">
            {error}
          </div>
        )}

        <div className="bg-surface border border-bordercol rounded-xl shadow-sm p-6 sm:p-8">
          
          {/* ===== STEP 1: Basic Info ===== */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-bordercol pb-4">
                <h2 className="font-display font-semibold text-xl text-textprimary">Basic Information</h2>
                <p className="text-sm text-textsecondary mt-1">Provide the essential details about your vehicle.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Make *</label>
                  <input value={form.make} onChange={e => update('make', e.target.value)} placeholder="e.g. Toyota" className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Model *</label>
                  <input value={form.model} onChange={e => update('model', e.target.value)} placeholder="e.g. Camry" className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Year *</label>
                  <input type="number" value={form.year} onChange={e => update('year', e.target.value)} placeholder="e.g. 2021" min="1960" max={new Date().getFullYear() + 1} className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Price (GH₵) *</label>
                  <input type="number" value={form.price} onChange={e => update('price', e.target.value)} placeholder="e.g. 185000" className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Location *</label>
                  <select value={form.location} onChange={e => update('location', e.target.value)} className="form-select">
                    <option value="">Select Location</option>
                    {['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani', 'Ho'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Condition *</label>
                  <select value={form.condition} onChange={e => update('condition', e.target.value)} className="form-select">
                    <option value="BRAND_NEW">Brand New</option>
                    <option value="FOREIGN_USED">Foreign Used</option>
                    <option value="LOCALLY_USED">Locally Used</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP 2: Specs ===== */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-bordercol pb-4">
                <h2 className="font-display font-semibold text-xl text-textprimary">Vehicle Specifications</h2>
                <p className="text-sm text-textsecondary mt-1">Add technical details to help buyers find your car.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Mileage (km)</label>
                  <input type="number" value={form.mileage} onChange={e => update('mileage', e.target.value)} placeholder="e.g. 42000" className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Transmission</label>
                  <select value={form.transmission} onChange={e => update('transmission', e.target.value)} className="form-select">
                    <option value="AUTOMATIC">Automatic</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Fuel Type</label>
                  <select value={form.fuelType} onChange={e => update('fuelType', e.target.value)} className="form-select">
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ELECTRIC">Electric</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Engine Size</label>
                  <input value={form.engineSize} onChange={e => update('engineSize', e.target.value)} placeholder="e.g. 2.5L" className="form-input" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Body Type</label>
                  <select value={form.bodyType} onChange={e => update('bodyType', e.target.value)} className="form-select">
                    <option value="">Select</option>
                    {['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Convertible', 'Wagon'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-textprimary">Color</label>
                  <input value={form.color} onChange={e => update('color', e.target.value)} placeholder="e.g. Pearl White" className="form-input" />
                </div>
              </div>
              
              <div className="space-y-1.5 pt-2">
                <label className="block text-sm font-medium text-textprimary">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Describe the car's condition, history, any extras..."
                  rows={4}
                  className="w-full p-3 border border-bordercol rounded-md bg-bg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow resize-none"
                />
              </div>
            </div>
          )}

          {/* ===== STEP 3: Features ===== */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-bordercol pb-4">
                <h2 className="font-display font-semibold text-xl text-textprimary">Features & Extras</h2>
                <p className="text-sm text-textsecondary mt-1">Select all features your car has.</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {FEATURES_LIST.map(feat => {
                  const isSelected = form.features.includes(feat);
                  return (
                    <button
                      key={feat}
                      type="button"
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors flex items-center gap-2 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-bordercol bg-surface text-textsecondary hover:bg-bg hover:border-textmuted'
                      }`}
                      onClick={() => toggleFeature(feat)}
                    >
                      {isSelected ? <Check size={14} /> : <span className="w-3.5" />} {feat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== STEP 4: Photos ===== */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-bordercol pb-4">
                <h2 className="font-display font-semibold text-xl text-textprimary">Photos</h2>
                <p className="text-sm text-textsecondary mt-1">
                  {isEdit
                    ? 'Your existing photos are shown below. Upload new ones to replace them, or keep the current set.'
                    : 'Upload up to 15 photos. The first photo will be the main thumbnail.'}
                </p>
              </div>

              <label className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                uploading ? 'border-primary bg-primary/5' : 'border-bordercol bg-bg hover:bg-surface hover:border-primary/50'
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
                <UploadCloud size={40} className={`mb-3 ${uploading ? 'text-primary' : 'text-textmuted'}`} />
                <span className="font-medium text-textprimary">
                  {uploading ? 'Uploading images...' : 'Click to Upload Photos'}
                </span>
                <span className="text-sm text-textsecondary mt-1 text-center max-w-xs">JPG, PNG, WEBP up to 5MB each.</span>
              </label>

              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                  {uploadedImages.map((src, i) => (
                    <div key={`${src}-${i}`} className="relative group aspect-[4/3] rounded-md overflow-hidden bg-bg border border-bordercol">
                      <img
                        src={getImageUrl(src)}
                        alt={`upload-${i}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      {i === 0 && (
                        <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                          MAIN
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-2 right-2 w-7 h-7 bg-err/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-err"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 5: Review ===== */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-bordercol pb-4">
                <h2 className="font-display font-semibold text-xl text-textprimary">Review Your Listing</h2>
                <p className="text-sm text-textsecondary mt-1">Check everything before submitting.</p>
              </div>
              
              <div className="bg-bg border border-bordercol rounded-md divide-y divide-bordercol">
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Car</span>
                  <strong className="text-textprimary font-medium">{form.year} {form.make} {form.model}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Price</span>
                  <strong className="text-textprimary font-medium">GH₵{Number(form.price || 0).toLocaleString()}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Location</span>
                  <strong className="text-textprimary font-medium">{form.location}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Condition</span>
                  <strong className="text-textprimary font-medium">{form.condition.replace(/_/g, ' ')}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Transmission</span>
                  <strong className="text-textprimary font-medium">{form.transmission}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Mileage</span>
                  <strong className="text-textprimary font-medium">{form.mileage ? `${form.mileage} km` : 'Not specified'}</strong>
                </div>
                <div className="flex justify-between p-4">
                  <span className="text-textsecondary">Photos</span>
                  <strong className="text-textprimary font-medium">{uploadedImages.filter(u => !u.startsWith('blob:')).length} uploaded</strong>
                </div>
              </div>
              
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-md text-sm text-textprimary flex items-start gap-3">
                <ShieldAlert size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <p>
                  {isEdit
                    ? 'Your changes will be sent for review again. Until approved, the listing may be temporarily hidden.'
                    : 'Your listing will be in Pending status until approved by our moderation team (usually within 2 hours).'}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-10 pt-6 border-t border-bordercol">
            <div>
              {step > 1 && (
                <button 
                  className="px-5 py-2.5 bg-bg border border-bordercol text-textprimary font-medium rounded-md hover:bg-bordercol/30 transition-colors flex items-center gap-2"
                  onClick={() => setStep(s => s - 1)}
                >
                  <ChevronLeft size={18} /> Back
                </button>
              )}
            </div>
            
            {step < TOTAL_STEPS ? (
              <button
                className="px-6 py-2.5 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && (!form.make || !form.model || !form.year || !form.price || !form.location)}
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button
                className="px-8 py-2.5 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={handleSubmit}
                disabled={submitting || uploading}
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Saving...</>
                ) : (
                  <><Save size={18} /> {isEdit ? 'Save Changes' : 'Submit Listing'}</>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .form-input, .form-select {
          width: 100%;
          height: 2.75rem; /* h-11 */
          padding-left: 0.75rem;
          padding-right: 0.75rem;
          border-width: 1px;
          border-color: var(--color-bordercol);
          border-radius: 0.375rem; /* rounded-md */
          background-color: var(--color-surface);
          font-size: 0.875rem; /* text-sm */
          transition-property: box-shadow, border-color;
          transition-duration: 150ms;
        }
        .form-input:focus, .form-select:focus {
          outline: 2px solid transparent;
          outline-offset: 2px;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 1px var(--color-primary);
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default SellCar;
