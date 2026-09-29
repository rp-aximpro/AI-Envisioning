import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddRequesterSessions1789388000000 implements MigrationInterface {
  name = 'AddRequesterSessions1789388000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE requester_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL,
        domain varchar(253) NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT requester_sessions_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT requester_sessions_domain_lowercase CHECK (domain = lower(domain)),
        CONSTRAINT requester_sessions_token_hash_unique UNIQUE (token_hash)
      )
    `);
    await queryRunner.query('CREATE INDEX requester_sessions_active_lookup_idx ON requester_sessions (token_hash, revoked_at, expires_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS requester_sessions_active_lookup_idx');
    await queryRunner.query('DROP TABLE IF EXISTS requester_sessions');
  }
}
