import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddOtpChallenges1789387900000 implements MigrationInterface {
  name = 'AddOtpChallenges1789387900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TYPE otp_purpose_enum AS ENUM ('create_workshop', 'track_workshop')");
    await queryRunner.query(`
      CREATE TABLE otp_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL,
        purpose otp_purpose_enum NOT NULL,
        workshop_id uuid NULL REFERENCES workshops(id) ON DELETE SET NULL,
        code_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        attempt_count integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL,
        consumed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        request_ip varchar(64) NULL,
        CONSTRAINT otp_challenges_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT otp_challenges_attempt_count_nonnegative CHECK (attempt_count >= 0),
        CONSTRAINT otp_challenges_max_attempts_positive CHECK (max_attempts > 0)
      )
    `);
    await queryRunner.query('CREATE INDEX otp_challenges_active_lookup_idx ON otp_challenges (email, purpose, workshop_id, consumed_at)');
    await queryRunner.query('CREATE INDEX otp_challenges_expires_at_idx ON otp_challenges (expires_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS otp_challenges_expires_at_idx');
    await queryRunner.query('DROP INDEX IF EXISTS otp_challenges_active_lookup_idx');
    await queryRunner.query('DROP TABLE IF EXISTS otp_challenges');
    await queryRunner.query('DROP TYPE IF EXISTS otp_purpose_enum');
  }
}
