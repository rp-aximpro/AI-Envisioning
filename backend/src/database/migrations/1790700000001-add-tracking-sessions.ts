import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddTrackingSessions1790700000001 implements MigrationInterface {
  name = 'AddTrackingSessions1790700000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tracking_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_id uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        email varchar(320) NOT NULL,
        domain varchar(253) NOT NULL,
        token_hash varchar(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT tracking_sessions_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT tracking_sessions_domain_lowercase CHECK (domain = lower(domain))
      )
    `);
    await queryRunner.query('CREATE INDEX tracking_sessions_active_lookup_idx ON tracking_sessions (token_hash, revoked_at, expires_at, workshop_id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS tracking_sessions_active_lookup_idx');
    await queryRunner.query('DROP TABLE IF EXISTS tracking_sessions');
  }
}
