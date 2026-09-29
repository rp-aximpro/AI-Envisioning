import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';

describe('App', () => {
  it('renders the project shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /AI Envisioning Workshops/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a workshop/i })).toBeInTheDocument();
  });
});
