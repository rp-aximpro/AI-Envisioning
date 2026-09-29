import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema1789387800000 implements MigrationInterface {
  name = 'InitialSchema1789387800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query("CREATE TYPE requester_role_enum AS ENUM ('ae', 'cst')");
    await queryRunner.query(
      "CREATE TYPE workshop_status_enum AS ENUM ('pending_review', 'planned', 'executed', 'follow_up', 'completed', 'declined')",
    );

    await queryRunner.query(`
      CREATE TABLE allowed_domains (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        domain varchar(253) NOT NULL,
        display_name varchar(150) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT allowed_domains_domain_unique UNIQUE (domain),
        CONSTRAINT allowed_domains_domain_lowercase CHECK (domain = lower(domain)),
        CONSTRAINT allowed_domains_domain_format CHECK (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL,
        password_hash text NOT NULL,
        display_name varchar(150) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz NULL,
        CONSTRAINT admin_users_email_unique UNIQUE (email),
        CONSTRAINT admin_users_email_lowercase CHECK (email = lower(email))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE workshops (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workshop_code varchar(32) NOT NULL,
        tracking_token varchar(192) NOT NULL,
        creator_name varchar(150) NOT NULL,
        creator_email varchar(320) NOT NULL,
        creator_domain varchar(253) NOT NULL,
        requester_role requester_role_enum NOT NULL,
        customer_name varchar(200) NOT NULL,
        country_code varchar(2) NOT NULL,
        location varchar(300) NOT NULL,
        timezone varchar(100) NOT NULL,
        planned_start_at timestamptz NOT NULL,
        duration_minutes integer NOT NULL,
        estimated_attendees integer NOT NULL,
        execution_support_required boolean NOT NULL,
        execution_support_details text NULL,
        funding_required boolean NOT NULL,
        requested_funding_amount numeric(14, 2) NULL,
        currency_code varchar(3) NOT NULL,
        description text NOT NULL,
        status workshop_status_enum NOT NULL DEFAULT 'pending_review',
        decline_reason text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        approved_at timestamptz NULL,
        declined_at timestamptz NULL,
        completed_at timestamptz NULL,
        CONSTRAINT workshops_workshop_code_unique UNIQUE (workshop_code),
        CONSTRAINT workshops_tracking_token_unique UNIQUE (tracking_token),
        CONSTRAINT workshops_creator_email_lowercase CHECK (creator_email = lower(creator_email)),
        CONSTRAINT workshops_creator_domain_lowercase CHECK (creator_domain = lower(creator_domain)),
        CONSTRAINT workshops_country_code_uppercase CHECK (country_code = upper(country_code)),
        CONSTRAINT workshops_currency_code_uppercase CHECK (currency_code = upper(currency_code)),
        CONSTRAINT workshops_duration_minutes_range CHECK (duration_minutes BETWEEN 15 AND 1440),
        CONSTRAINT workshops_estimated_attendees_range CHECK (estimated_attendees BETWEEN 1 AND 10000),
        CONSTRAINT workshops_requested_funding_nonnegative CHECK (requested_funding_amount IS NULL OR requested_funding_amount >= 0)
      )
    `);

    await queryRunner.query('CREATE INDEX workshops_status_idx ON workshops (status)');
    await queryRunner.query('CREATE INDEX workshops_country_code_idx ON workshops (country_code)');
    await queryRunner.query('CREATE INDEX workshops_creator_email_idx ON workshops (creator_email)');
    await queryRunner.query('CREATE INDEX workshops_creator_domain_idx ON workshops (creator_domain)');
    await queryRunner.query('CREATE INDEX workshops_planned_start_at_idx ON workshops (planned_start_at)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS workshops_planned_start_at_idx');
    await queryRunner.query('DROP INDEX IF EXISTS workshops_creator_domain_idx');
    await queryRunner.query('DROP INDEX IF EXISTS workshops_creator_email_idx');
    await queryRunner.query('DROP INDEX IF EXISTS workshops_country_code_idx');
    await queryRunner.query('DROP INDEX IF EXISTS workshops_status_idx');
    await queryRunner.query('DROP TABLE IF EXISTS workshops');
    await queryRunner.query('DROP TABLE IF EXISTS admin_users');
    await queryRunner.query('DROP TABLE IF EXISTS allowed_domains');
    await queryRunner.query('DROP TYPE IF EXISTS workshop_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS requester_role_enum');
  }
}
