import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddCountries1790700000000 implements MigrationInterface {
  name = 'AddCountries1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE countries (
        code varchar(2) PRIMARY KEY,
        name varchar(100) NOT NULL UNIQUE,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT countries_code_uppercase CHECK (code = upper(code)),
        CONSTRAINT countries_name_not_empty CHECK (length(trim(name)) > 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS countries');
  }
}
