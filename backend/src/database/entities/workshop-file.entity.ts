import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'workshop_files' })
@Index(['workshopId', 'createdAt'])
export class WorkshopFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workshop_id', type: 'uuid' })
  workshopId!: string;

  @Column({ type: 'varchar', length: 40 })
  category!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'object_key', type: 'varchar', length: 600, unique: true })
  objectKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'uploaded_by_email', type: 'varchar', length: 320 })
  uploadedByEmail!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
