import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddAdminReview1790700000002 implements MigrationInterface {
  name = 'AddAdminReview1790700000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        absolute_expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX admin_sessions_active_lookup_idx ON admin_sessions (token_hash, revoked_at, expires_at, absolute_expires_at)');
    await queryRunner.query(`
      CREATE TABLE admin_login_attempts (
        key_hash varchar(64) PRIMARY KEY,
        attempt_count integer NOT NULL,
        window_started_at timestamptz NOT NULL,
        CONSTRAINT admin_login_attempts_count_positive CHECK (attempt_count > 0)
      )
    `);
    await queryRunner.query('CREATE INDEX admin_login_attempts_window_idx ON admin_login_attempts (window_started_at)');
    await queryRunner.query(`
      ALTER TABLE workshops
      ADD COLUMN approved_funding_amount numeric(14, 2) NULL,
      ADD CONSTRAINT workshops_approved_funding_nonnegative CHECK (approved_funding_amount IS NULL OR approved_funding_amount >= 0)
    `);
    await queryRunner.query(`
      CREATE TABLE workshop_status_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        from_status workshop_status_enum NOT NULL,
        to_status workshop_status_enum NOT NULL,
        changed_by_type varchar(20) NOT NULL,
        changed_by_admin_id uuid NULL REFERENCES admin_users(id) ON DELETE SET NULL,
        changed_by_email varchar(320) NULL,
        reason text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT workshop_status_history_actor_type CHECK (changed_by_type IN ('admin', 'system'))
      )
    `);
    await queryRunner.query('CREATE INDEX workshop_status_history_workshop_created_idx ON workshop_status_history (workshop_id, created_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS workshop_status_history_workshop_created_idx');
    await queryRunner.query('DROP TABLE IF EXISTS workshop_status_history');
    await queryRunner.query('ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_approved_funding_nonnegative');
    await queryRunner.query('ALTER TABLE workshops DROP COLUMN IF EXISTS approved_funding_amount');
    await queryRunner.query('DROP INDEX IF EXISTS admin_sessions_active_lookup_idx');
    await queryRunner.query('DROP INDEX IF EXISTS admin_login_attempts_window_idx');
    await queryRunner.query('DROP TABLE IF EXISTS admin_login_attempts');
    await queryRunner.query('DROP TABLE IF EXISTS admin_sessions');
  }
}
