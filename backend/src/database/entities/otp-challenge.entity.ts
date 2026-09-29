import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum OtpPurpose {
  CreateWorkshop = 'create_workshop',
  TrackWorkshop = 'track_workshop',
}

@Entity({ name: 'otp_challenges' })
@Index(['email', 'purpose', 'workshopId', 'consumedAt'])
export class OtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Column({ name: 'workshop_id', type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash!: string;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'max_attempts', type: 'integer' })
  maxAttempts!: number;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'request_ip', type: 'varchar', length: 64, nullable: true })
  requestIp!: string | null;
}
