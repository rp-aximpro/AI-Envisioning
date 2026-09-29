import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'workshop_leads' })
@Index(['workshopId', 'createdAt'])
export class WorkshopLead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId!: string;

  @Column({ name: 'lead_reference', type: 'varchar', length: 150, nullable: true })
  leadReference!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by_email', type: 'varchar', length: 320 })
  createdByEmail!: string;
}
