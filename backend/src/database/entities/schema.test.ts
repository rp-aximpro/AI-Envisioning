import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { RequesterRole, WorkshopStatus } from './workshop.entity.js';

describe('database schema constants', () => {
  it('keeps canonical workshop statuses stable', () => {
    expect(Object.values(WorkshopStatus)).toEqual([
      'pending_review',
      'planned',
      'executed',
      'follow_up',
      'completed',
      'declined',
    ]);
  });

  it('keeps requester roles stable', () => {
    expect(Object.values(RequesterRole)).toEqual(['ae', 'cst']);
  });
});
