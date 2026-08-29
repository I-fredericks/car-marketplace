import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';
import './SellCar.css';

const TOTAL_STEPS = 5;

const FEATURES_LIST = [
  'Air Conditioning', 'Leather Seats', 'Reverse Camera', 'Sunroof',
  'Bluetooth', 'Apple CarPlay', 'Android Auto', 'Keyless Entry',
  'Parking Sensors', 'Cruise Control', 'Heated Seats', 'Navigation System',
  'Push Start', 'Alloy Wheels', 'Tinted Windows',
];

const SellCar = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]); // Array of URL strings
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    // Step 1 — Basic Info
    make: '', model: '', year: '', price: '', location: '', condition: 'FOREIGN_USED',
    // Step 2 — Specs
    mileage: '', transmission: 'AUTOMATIC', fuelType: 'PETROL',
    engineSize: '', bodyType: '', color: '', description: '',
    // Step 3 — Features
    features: [],
  });

  // Redirect if not logged in or not a seller
  if (!user) {
    return (
      <div className="sell-guard">
        <h2>Please <a href="/login">log in</a> to list a car.</h2>
      </div>
    );
  }
  if (user.role === 'BUYER') {
    return (
      <div className="sell-guard">
        <h2>You need a Seller account to list a car.</h2>
        <p>Go to your profile to upgrade your account.</p>
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

  // Upload photos to backend
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('images', file));
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedImages(prev => [...prev, ...data.urls]);
    } catch (err) {
      setError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        year: parseInt(form.year),
        price: parseFloat(form.price),
        mileage: form.mileage ? parseInt(form.mileage) : undefined,
        images: uploadedImages.map((url, i) => ({ url, isPrimary: i === 0 })),
      };
      const { data } = await api.post('/vehicles', payload);
      navigate(`/car/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sell-page">
      <div className="sell-container">
        <div className="sell-header">
          <h1>Sell Your Car</h1>
          <p>Fill in the details to create your listing</p>
        </div>

        {/* Step Progress Bar */}
        <div className="progress-bar">
          {['Basic Info', 'Specs', 'Features', 'Photos', 'Review'].map((label, i) => (
            <div key={label} className={`step-item ${step >= i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}>
              <div className="step-circle">{step > i + 1 ? '✓' : i + 1}</div>
              <span className="step-label">{label}</span>
              {i < TOTAL_STEPS - 1 && <div className={`step-line ${step > i + 1 ? 'filled' : ''}`} />}
            </div>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="sell-card">
          {/* ===== STEP 1: Basic Info ===== */}
          {step === 1 && (
            <div className="step-content">
              <h2>Step 1: Basic Information</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Make *</label>
                  <input value={form.make} onChange={e => update('make', e.target.value)} placeholder="e.g. Toyota" required />
                </div>
                <div className="form-group">
                  <label>Model *</label>
                  <input value={form.model} onChange={e => update('model', e.target.value)} placeholder="e.g. Camry" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Year *</label>
                  <input type="number" value={form.year} onChange={e => update('year', e.target.value)} placeholder="e.g. 2021" min="1990" max="2026" required />
                </div>
                <div className="form-group">
                  <label>Price (GH₵) *</label>
                  <input type="number" value={form.price} onChange={e => update('price', e.target.value)} placeholder="e.g. 185000" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Location *</label>
                  <select value={form.location} onChange={e => update('location', e.target.value)} required>
                    <option value="">Select Location</option>
                    {['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani', 'Ho'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Condition *</label>
                  <select value={form.condition} onChange={e => update('condition', e.target.value)}>
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
            <div className="step-content">
              <h2>Step 2: Vehicle Specifications</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Mileage (km)</label>
                  <input type="number" value={form.mileage} onChange={e => update('mileage', e.target.value)} placeholder="e.g. 42000" />
                </div>
                <div className="form-group">
                  <label>Transmission</label>
                  <select value={form.transmission} onChange={e => update('transmission', e.target.value)}>
                    <option value="AUTOMATIC">Automatic</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fuel Type</label>
                  <select value={form.fuelType} onChange={e => update('fuelType', e.target.value)}>
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ELECTRIC">Electric</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Engine Size</label>
                  <input value={form.engineSize} onChange={e => update('engineSize', e.target.value)} placeholder="e.g. 2.5L" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Body Type</label>
                  <select value={form.bodyType} onChange={e => update('bodyType', e.target.value)}>
                    <option value="">Select</option>
                    {['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe', 'Convertible', 'Wagon'].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input value={form.color} onChange={e => update('color', e.target.value)} placeholder="e.g. Pearl White" />
                </div>
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Describe the car's condition, history, any extras..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* ===== STEP 3: Features ===== */}
          {step === 3 && (
            <div className="step-content">
              <h2>Step 3: Features & Extras</h2>
              <p className="step-hint">Select all features your car has:</p>
              <div className="features-picker">
                {FEATURES_LIST.map(feat => (
                  <button
                    key={feat}
                    type="button"
                    className={form.features.includes(feat) ? 'feat-chip selected' : 'feat-chip'}
                    onClick={() => toggleFeature(feat)}
                  >
                    {form.features.includes(feat) ? '✓ ' : '+ '}{feat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP 4: Photos ===== */}
          {step === 4 && (
            <div className="step-content">
              <h2>Step 4: Upload Photos</h2>
              <p className="step-hint">Upload up to 15 photos. The first photo will be the main thumbnail.</p>

              <label className="upload-area">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <span>{uploading ? '⏳ Uploading...' : '📷 Click to Upload Photos'}</span>
              </label>

              {uploadedImages.length > 0 && (
                <div className="uploaded-previews">
                  {uploadedImages.map((url, i) => (
                    <div key={i} className="preview-item">
                      <img src={`http://localhost:5000${url}`} alt={`upload-${i}`} />
                      {i === 0 && <span className="primary-label">Main</span>}
                      <button onClick={() => removeImage(i)} className="remove-img">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 5: Review ===== */}
          {step === 5 && (
            <div className="step-content">
              <h2>Step 5: Review Your Listing</h2>
              <p className="step-hint">Check everything before submitting. Your listing will be reviewed by our team.</p>
              <div className="review-summary">
                <div className="review-row"><span>Car</span><strong>{form.year} {form.make} {form.model}</strong></div>
                <div className="review-row"><span>Price</span><strong>GH₵{Number(form.price || 0).toLocaleString()}</strong></div>
                <div className="review-row"><span>Location</span><strong>{form.location}</strong></div>
                <div className="review-row"><span>Condition</span><strong>{form.condition.replace('_', ' ')}</strong></div>
                <div className="review-row"><span>Transmission</span><strong>{form.transmission}</strong></div>
                <div className="review-row"><span>Fuel</span><strong>{form.fuelType}</strong></div>
                <div className="review-row"><span>Mileage</span><strong>{form.mileage ? `${form.mileage} km` : 'Not specified'}</strong></div>
                <div className="review-row"><span>Features</span><strong>{form.features.length > 0 ? form.features.join(', ') : 'None'}</strong></div>
                <div className="review-row"><span>Photos</span><strong>{uploadedImages.length} uploaded</strong></div>
              </div>
              <p className="review-note">📋 Your listing will be in <strong>Pending</strong> status until approved by our team.</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="step-nav">
            {step > 1 && (
              <button className="nav-btn back" onClick={() => setStep(s => s - 1)}>← Back</button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                className="nav-btn next"
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && (!form.make || !form.model || !form.year || !form.price || !form.location)}
              >
                Next →
              </button>
            ) : (
              <button
                className="nav-btn submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : '🚀 Submit Listing'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellCar;
