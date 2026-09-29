import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ExpandRequesterRoles1790700000006 implements MigrationInterface {
  name = 'ExpandRequesterRoles1790700000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TYPE requester_role_enum RENAME VALUE 'ae' TO 'AE'");
    await queryRunner.query("ALTER TYPE requester_role_enum RENAME VALUE 'cst' TO 'CST'");
    await queryRunner.query("ALTER TYPE requester_role_enum ADD VALUE 'FPM'");
    await queryRunner.query("ALTER TYPE requester_role_enum ADD VALUE 'WSG'");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TYPE requester_role_enum_previous AS ENUM ('ae', 'cst')");
    await queryRunner.query(`
      ALTER TABLE workshops
        ALTER COLUMN requester_role TYPE requester_role_enum_previous
        USING (
          CASE requester_role::text
            WHEN 'AE' THEN 'ae'
            WHEN 'FPM' THEN 'ae'
            WHEN 'CST' THEN 'cst'
            WHEN 'WSG' THEN 'cst'
          END
        )::requester_role_enum_previous
    `);
    await queryRunner.query('DROP TYPE requester_role_enum');
    await queryRunner.query('ALTER TYPE requester_role_enum_previous RENAME TO requester_role_enum');
  }
}
