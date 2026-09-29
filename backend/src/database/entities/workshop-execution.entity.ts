import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Workshop } from './workshop.entity.js';

@Entity({ name: 'workshop_execution' })
export class WorkshopExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid', unique: true })
  workshopId!: string;

  @OneToOne(() => Workshop)
  @JoinColumn({ name: 'workshop_id' })
  workshop!: Workshop;

  @Column({ name: 'actual_attendees', type: 'integer' })
  actualAttendees!: number;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ name: 'submitted_by_email', type: 'varchar', length: 320 })
  submittedByEmail!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
