import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SurveyQuestionType = 'short_text' | 'long_text' | 'rating' | 'single_choice' | 'multi_choice' | 'yes_no';

@Entity({ name: 'survey_questions' })
@Index(['active', 'displayOrder'])
export class SurveyQuestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  key!: string;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'question_type', type: 'varchar', length: 30 })
  questionType!: SurveyQuestionType;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ name: 'options_json', type: 'jsonb', nullable: true })
  optionsJson!: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
