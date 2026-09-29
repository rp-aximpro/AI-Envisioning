import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'workshop_opportunities' })
@Index(['workshopId', 'createdAt'])
export class WorkshopOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId!: string;

  @Column({ name: 'opportunity_reference', type: 'varchar', length: 150, nullable: true })
  opportunityReference!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'pipeline_value', type: 'numeric', precision: 14, scale: 2 })
  pipelineValue!: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3 })
  currencyCode!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stage!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by_email', type: 'varchar', length: 320 })
  createdByEmail!: string;
}
