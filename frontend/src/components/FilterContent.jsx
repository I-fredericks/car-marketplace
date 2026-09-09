import { Filter } from 'lucide-react';

const MAKES = ['Toyota', 'Honda', 'Mercedes', 'Hyundai', 'Nissan', 'Ford', 'Kia', 'BMW', 'Volkswagen'];
const LOCATIONS = ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Sunyani'];
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
const CONDITIONS = ['BRAND_NEW', 'FOREIGN_USED', 'LOCALLY_USED'];

// Module-level so the filter form keeps input focus: a component defined
// inside SearchResults' render remounts on every keystroke.
const FilterContent = ({ filters, setFilters, onApply, onClear }) => (
  <div className="flex flex-col gap-6">
    <div className="flex items-center justify-between">
      <h3 className="font-display font-semibold text-lg text-textprimary flex items-center gap-2">
        <Filter size={20} /> Filters
      </h3>
      <button onClick={onClear} className="text-sm font-medium text-textsecondary hover:text-primary transition-colors">
        Clear All
      </button>
    </div>

    <form onSubmit={onApply} className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-make" className="text-sm font-medium text-textsecondary">Make</label>
        <select id="filter-make" value={filters.make} onChange={(e) => setFilters({...filters, make: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Make</option>
          {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-model" className="text-sm font-medium text-textsecondary">Model</label>
        <input type="text" id="filter-model" placeholder="e.g. Camry" value={filters.model} onChange={(e) => setFilters({...filters, model: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-min-price" className="text-sm font-medium text-textsecondary">Price Range (GH₵)</label>
        <div className="flex gap-2">
          <input type="number" id="filter-min-price" placeholder="Min" value={filters.minPrice} onChange={(e) => setFilters({...filters, minPrice: e.target.value})} className="w-1/2 h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
          <input type="number" placeholder="Max" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: e.target.value})} className="w-1/2 h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-location" className="text-sm font-medium text-textsecondary">Location</label>
        <select id="filter-location" value={filters.location} onChange={(e) => setFilters({...filters, location: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Location</option>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-condition" className="text-sm font-medium text-textsecondary">Condition</label>
        <select id="filter-condition" value={filters.condition} onChange={(e) => setFilters({...filters, condition: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any Condition</option>
          {CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-transmission" className="text-sm font-medium text-textsecondary">Transmission</label>
        <select id="filter-transmission" value={filters.transmission} onChange={(e) => setFilters({...filters, transmission: e.target.value})} className="w-full h-10 px-3 border border-bordercol rounded-md bg-surface text-sm focus:outline-none focus:border-primary">
          <option value="">Any</option>
          {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={filters.verifiedOnly === 'true'} onChange={(e) => setFilters({...filters, verifiedOnly: e.target.checked ? 'true' : ''})} className="w-4 h-4 text-primary rounded border-bordercol focus:ring-primary" />
        <span className="text-sm font-medium text-textprimary">Verified Sellers Only</span>
      </label>

      {/* Structured condition facts (Jiji-style discovery filters) */}
      <div className="pt-2 border-t border-bordercol">
        <p className="text-xs font-bold text-textmuted uppercase tracking-wider mb-2">Condition facts</p>
        <div className="flex flex-col gap-2">
          {[
            { key: 'noKnownFaults', label: 'No known faults' },
            { key: 'firstOwner', label: 'First owner' },
            { key: 'registered', label: 'Registered (DVLA)' },
            { key: 'exchangePossible', label: 'Trade-in accepted' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters[key] === 'true'}
                onChange={(e) => setFilters({ ...filters, [key]: e.target.checked ? 'true' : '' })}
                className="w-4 h-4 text-primary rounded border-bordercol focus:ring-primary"
              />
              <span className="text-sm font-medium text-textprimary">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primarylight transition-colors mt-4">
        Apply Filters
      </button>
    </form>
  </div>
);

export default FilterContent;
