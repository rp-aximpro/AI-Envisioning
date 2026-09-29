import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RequesterRole {
  Ae = 'ae',
  Cst = 'cst',
}

export enum WorkshopStatus {
  PendingReview = 'pending_review',
  Planned = 'planned',
  Executed = 'executed',
  FollowUp = 'follow_up',
  Completed = 'completed',
  Declined = 'declined',
}

@Entity({ name: 'workshops' })
export class Workshop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'workshop_code', type: 'varchar', length: 32 })
  workshopCode!: string;

  @Index({ unique: true })
  @Column({ name: 'tracking_token', type: 'varchar', length: 192 })
  trackingToken!: string;

  @Column({ name: 'creator_name', type: 'varchar', length: 150 })
  creatorName!: string;

  @Index()
  @Column({ name: 'creator_email', type: 'varchar', length: 320 })
  creatorEmail!: string;

  @Index()
  @Column({ name: 'creator_domain', type: 'varchar', length: 253 })
  creatorDomain!: string;

  @Column({ name: 'requester_role', type: 'enum', enum: RequesterRole })
  requesterRole!: RequesterRole;

  @Column({ name: 'customer_name', type: 'varchar', length: 200 })
  customerName!: string;

  @Index()
  @Column({ name: 'country_code', type: 'varchar', length: 2 })
  countryCode!: string;

  @Column({ type: 'varchar', length: 300 })
  location!: string;

  @Column({ type: 'varchar', length: 100 })
  timezone!: string;

  @Index()
  @Column({ name: 'planned_start_at', type: 'timestamptz' })
  plannedStartAt!: Date;

  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes!: number;

  @Column({ name: 'estimated_attendees', type: 'integer' })
  estimatedAttendees!: number;

  @Column({ name: 'execution_support_required', type: 'boolean' })
  executionSupportRequired!: boolean;

  @Column({ name: 'execution_support_details', type: 'text', nullable: true })
  executionSupportDetails!: string | null;

  @Column({ name: 'funding_required', type: 'boolean' })
  fundingRequired!: boolean;

  @Column({
    name: 'requested_funding_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  requestedFundingAmount!: string | null;

  @Column({
    name: 'approved_funding_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  approvedFundingAmount!: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 3 })
  currencyCode!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({ type: 'enum', enum: WorkshopStatus, default: WorkshopStatus.PendingReview })
  status!: WorkshopStatus;

  @Column({ name: 'decline_reason', type: 'text', nullable: true })
  declineReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'declined_at', type: 'timestamptz', nullable: true })
  declinedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'survey_completed_at', type: 'timestamptz', nullable: true })
  surveyCompletedAt!: Date | null;

  @Column({ name: 'survey_completed_by_email', type: 'varchar', length: 320, nullable: true })
  surveyCompletedByEmail!: string | null;

  @Column({ name: 'completion_notes', type: 'text', nullable: true })
  completionNotes!: string | null;

  @Column({ name: 'actual_funding_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  actualFundingAmount!: string | null;

  @Column({ name: 'proof_override_by_admin_id', type: 'uuid', nullable: true })
  proofOverrideByAdminId!: string | null;

  @Column({ name: 'proof_override_by_email', type: 'varchar', length: 320, nullable: true })
  proofOverrideByEmail!: string | null;

  @Column({ name: 'proof_override_reason', type: 'text', nullable: true })
  proofOverrideReason!: string | null;

  @Column({ name: 'proof_override_at', type: 'timestamptz', nullable: true })
  proofOverrideAt!: Date | null;
}
