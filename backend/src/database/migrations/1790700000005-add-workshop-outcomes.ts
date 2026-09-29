import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddWorkshopOutcomes1790700000005 implements MigrationInterface {
  name = 'AddWorkshopOutcomes1790700000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workshops
        ADD COLUMN survey_completed_at timestamptz NULL,
        ADD COLUMN survey_completed_by_email varchar(320) NULL,
        ADD COLUMN completion_notes text NULL,
        ADD COLUMN actual_funding_amount numeric(14, 2) NULL,
        ADD CONSTRAINT workshops_actual_funding_nonnegative CHECK (actual_funding_amount IS NULL OR actual_funding_amount >= 0)
    `);
    await queryRunner.query(`
      CREATE TABLE workshop_leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        lead_reference varchar(150) NULL,
        description text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by_email varchar(320) NOT NULL,
        CONSTRAINT workshop_leads_has_details CHECK (lead_reference IS NOT NULL OR description IS NOT NULL)
      )
    `);
    await queryRunner.query('CREATE INDEX workshop_leads_workshop_created_idx ON workshop_leads (workshop_id, created_at)');
    await queryRunner.query(`
      CREATE TABLE workshop_opportunities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        opportunity_reference varchar(150) NULL,
        name varchar(200) NOT NULL,
        pipeline_value numeric(14, 2) NOT NULL CHECK (pipeline_value >= 0),
        currency_code varchar(3) NOT NULL,
        stage varchar(100) NULL,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by_email varchar(320) NOT NULL
      )
    `);
    await queryRunner.query('CREATE INDEX workshop_opportunities_workshop_created_idx ON workshop_opportunities (workshop_id, created_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS workshop_opportunities_workshop_created_idx');
    await queryRunner.query('DROP TABLE IF EXISTS workshop_opportunities');
    await queryRunner.query('DROP INDEX IF EXISTS workshop_leads_workshop_created_idx');
    await queryRunner.query('DROP TABLE IF EXISTS workshop_leads');
    await queryRunner.query('ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_actual_funding_nonnegative');
    await queryRunner.query(`
      ALTER TABLE workshops
        DROP COLUMN IF EXISTS actual_funding_amount,
        DROP COLUMN IF EXISTS completion_notes,
        DROP COLUMN IF EXISTS survey_completed_by_email,
        DROP COLUMN IF EXISTS survey_completed_at
    `);
  }
}
