import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import VehicleCard from '../components/VehicleCard';

const base = {
  id: 1,
  title: '2021 Toyota Camry',
  price: 250000,
  location: 'Accra',
  condition: 'FOREIGN USED',
  specs: ['AUTOMATIC', 'PETROL', '45,000 km'],
  sellerName: 'Kwame',
  verified: true,
  imageUrl: 'http://example.com/car.jpg',
};

const renderCard = (props) => render(
  <MemoryRouter>
    <VehicleCard {...base} {...props} />
  </MemoryRouter>
);

describe('VehicleCard', () => {
  it('renders title, price and location', () => {
    renderCard();
    expect(screen.getByText('2021 Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText(/250,000/)).toBeInTheDocument();
    expect(screen.getByText(/Accra/)).toBeInTheDocument();
  });

  it('uses the title as the image alt text', () => {
    renderCard();
    expect(screen.getByAltText('2021 Toyota Camry')).toBeInTheDocument();
  });

  it('shows a placeholder when there is no image', () => {
    renderCard({ imageUrl: null });
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('links the card to the detail page', () => {
    renderCard();
    const links = screen.getAllByRole('link', { href: '/car/1' });
    expect(links.length).toBeGreaterThan(0);
  });
});
