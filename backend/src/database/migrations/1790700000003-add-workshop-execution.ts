import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddWorkshopExecution1790700000003 implements MigrationInterface {
  name = 'AddWorkshopExecution1790700000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workshops
      ADD COLUMN proof_override_by_admin_id uuid NULL REFERENCES admin_users(id) ON DELETE SET NULL,
      ADD COLUMN proof_override_by_email varchar(320) NULL,
      ADD COLUMN proof_override_reason text NULL,
      ADD COLUMN proof_override_at timestamptz NULL
    `);
    await queryRunner.query(`
      ALTER TABLE workshop_status_history
      DROP CONSTRAINT workshop_status_history_actor_type,
      ADD CONSTRAINT workshop_status_history_actor_type CHECK (changed_by_type IN ('admin', 'system', 'requester'))
    `);
    await queryRunner.query(`
      CREATE TABLE workshop_execution (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL UNIQUE REFERENCES workshops(id) ON DELETE CASCADE,
        actual_attendees integer NOT NULL CHECK (actual_attendees >= 0),
        notes text NOT NULL DEFAULT '',
        submitted_by_email varchar(320) NOT NULL,
        submitted_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE workshop_files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        category varchar(40) NOT NULL,
        original_filename varchar(255) NOT NULL,
        object_key varchar(600) NOT NULL UNIQUE,
        mime_type varchar(100) NOT NULL,
        size_bytes bigint NOT NULL CHECK (size_bytes > 0),
        uploaded_by_email varchar(320) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX workshop_files_workshop_created_idx ON workshop_files (workshop_id, created_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS workshop_files_workshop_created_idx');
    await queryRunner.query('DROP TABLE IF EXISTS workshop_files');
    await queryRunner.query('DROP TABLE IF EXISTS workshop_execution');
    await queryRunner.query(`
      ALTER TABLE workshops
      DROP COLUMN IF EXISTS proof_override_at,
      DROP COLUMN IF EXISTS proof_override_reason,
      DROP COLUMN IF EXISTS proof_override_by_email,
      DROP COLUMN IF EXISTS proof_override_by_admin_id
    `);
    await queryRunner.query(`
      ALTER TABLE workshop_status_history
      DROP CONSTRAINT workshop_status_history_actor_type,
      ADD CONSTRAINT workshop_status_history_actor_type CHECK (changed_by_type IN ('admin', 'system'))
    `);
  }
}
