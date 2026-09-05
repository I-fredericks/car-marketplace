import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import FilterContent from '../components/FilterContent';

const emptyFilters = {
  make: '', model: '', minPrice: '', maxPrice: '', location: '',
  transmission: '', condition: '', verifiedOnly: '',
};

describe('FilterContent', () => {
  it('associates every filter control with its label', () => {
    render(
      <FilterContent
        filters={emptyFilters}
        setFilters={() => {}}
        onApply={() => {}}
        onClear={() => {}}
      />
    );
    for (const label of ['Make', 'Model', 'Price Range (GH₵)', 'Location', 'Condition', 'Transmission']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('updates filters through the form controls', () => {
    const setFilters = vi.fn();
    render(
      <FilterContent
        filters={emptyFilters}
        setFilters={setFilters}
        onApply={() => {}}
        onClear={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Toyota' } });
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ make: 'Toyota' }));
  });

  it('submits the form via the Apply Filters button', () => {
    const onApply = vi.fn((e) => e.preventDefault());
    render(
      <FilterContent
        filters={emptyFilters}
        setFilters={() => {}}
        onApply={onApply}
        onClear={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
