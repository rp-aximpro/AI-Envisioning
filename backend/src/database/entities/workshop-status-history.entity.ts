import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { WorkshopStatus } from './workshop.entity.js';

@Entity({ name: 'workshop_status_history' })
@Index(['workshopId', 'createdAt'])
export class WorkshopStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId!: string;

  @Column({ name: 'from_status', type: 'enum', enum: WorkshopStatus })
  fromStatus!: WorkshopStatus;

  @Column({ name: 'to_status', type: 'enum', enum: WorkshopStatus })
  toStatus!: WorkshopStatus;

  @Column({ name: 'changed_by_type', type: 'varchar', length: 20 })
  changedByType!: string;

  @Column({ name: 'changed_by_admin_id', type: 'uuid', nullable: true })
  changedByAdminId!: string | null;

  @Column({ name: 'changed_by_email', type: 'varchar', length: 320, nullable: true })
  changedByEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
