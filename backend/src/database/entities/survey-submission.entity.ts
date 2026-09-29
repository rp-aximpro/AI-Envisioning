import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'survey_submissions' })
@Index(['workshopId', 'submittedAt'])
export class SurveySubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId!: string;

  @Column({ name: 'submitted_by_email', type: 'varchar', length: 320 })
  submittedByEmail!: string;

  @Column({ name: 'respondent_name', type: 'varchar', length: 150, nullable: true })
  respondentName!: string | null;

  @Column({ name: 'respondent_company', type: 'varchar', length: 200, nullable: true })
  respondentCompany!: string | null;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;
}
