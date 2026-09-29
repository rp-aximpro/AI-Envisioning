import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddRepeatableSurveys1790700000004 implements MigrationInterface {
  name = 'AddRepeatableSurveys1790700000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE survey_questions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar(100) NOT NULL UNIQUE,
        label text NOT NULL,
        question_type varchar(30) NOT NULL,
        required boolean NOT NULL DEFAULT false,
        display_order integer NOT NULL,
        active boolean NOT NULL DEFAULT true,
        options_json jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT survey_questions_type_check CHECK (question_type IN ('short_text', 'long_text', 'rating', 'single_choice', 'multi_choice', 'yes_no')),
        CONSTRAINT survey_questions_options_check CHECK (
          (question_type IN ('single_choice', 'multi_choice') AND options_json IS NOT NULL AND jsonb_typeof(options_json) = 'array')
          OR (question_type NOT IN ('single_choice', 'multi_choice') AND options_json IS NULL)
        )
      )
    `);
    await queryRunner.query('CREATE INDEX survey_questions_active_order_idx ON survey_questions (active, display_order)');
    await queryRunner.query(`
      CREATE TABLE survey_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        submitted_by_email varchar(320) NOT NULL,
        respondent_name varchar(150) NULL,
        respondent_company varchar(200) NULL,
        submitted_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX survey_submissions_workshop_submitted_idx ON survey_submissions (workshop_id, submitted_at)');
    await queryRunner.query(`
      CREATE TABLE survey_answers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        submission_id uuid NOT NULL REFERENCES survey_submissions(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES survey_questions(id) ON DELETE RESTRICT,
        answer_json jsonb NULL,
        question_key_snapshot varchar(100) NOT NULL,
        question_label_snapshot text NOT NULL,
        question_type_snapshot varchar(30) NOT NULL,
        options_json_snapshot jsonb NULL,
        display_order_snapshot integer NOT NULL,
        CONSTRAINT survey_answers_submission_question_unique UNIQUE (submission_id, question_id)
      )
    `);
    await queryRunner.query(`
      INSERT INTO survey_questions (key, label, question_type, required, display_order, active, options_json)
      VALUES
        ('overall_rating', 'How would you rate this workshop overall?', 'rating', true, 1, true, NULL),
        ('most_valuable', 'What was most valuable about the workshop?', 'long_text', false, 2, true, NULL),
        ('follow_up_needed', 'Would you like a follow-up conversation?', 'yes_no', true, 3, true, NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS survey_answers');
    await queryRunner.query('DROP INDEX IF EXISTS survey_submissions_workshop_submitted_idx');
    await queryRunner.query('DROP TABLE IF EXISTS survey_submissions');
    await queryRunner.query('DROP INDEX IF EXISTS survey_questions_active_order_idx');
    await queryRunner.query('DROP TABLE IF EXISTS survey_questions');
  }
}
