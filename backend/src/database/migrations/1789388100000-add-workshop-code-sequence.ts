import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddWorkshopCodeSequence1789388100000 implements MigrationInterface {
  name = 'AddWorkshopCodeSequence1789388100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SEQUENCE workshop_code_sequence START WITH 1 INCREMENT BY 1');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SEQUENCE IF EXISTS workshop_code_sequence');
  }
}
