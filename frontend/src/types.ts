export interface RequesterSession {
  domain: string;
  email: string;
}

export interface CreatedWorkshop {
  confirmationEmail: string;
  emailDeliveryMode: 'sent' | 'logged' | 'failed';
  id: string;
  qrCodeDataUrl: string;
  status: 'pending_review';
  trackingUrl: string;
  workshopCode: string;
}

export interface WorkshopOptions {
  countries: Array<{ code: string; name: string }>;
  programCurrency: string;
}

export interface WorkshopTracking {
  actualFundingAmount: string | null;
  approvedFundingAmount: string | null;
  countryCode: string;
  countryName: string;
  completedAt: string | null;
  completionNotes: string | null;
  createdAt: string;
  customerName: string;
  creatorEmail: string;
  creatorName: string;
  currencyCode: string;
  declineReason: string | null;
  description: string;
  durationMinutes: number;
  estimatedAttendees: number;
  execution: WorkshopExecution | null;
  files: WorkshopFile[];
  proofOverride: { email: string; reason: string; recordedAt: string } | null;
  executionSupportDetails: string | null;
  executionSupportRequired: boolean;
  fundingRequired: boolean;
  location: string;
  leadCount: number;
  leads: WorkshopLead[];
  opportunityCount: number;
  opportunities: WorkshopOpportunity[];
  plannedStartAt: string;
  requestedFundingAmount: string | null;
  requesterRole: 'ae' | 'cst';
  status: 'pending_review' | 'planned' | 'executed' | 'follow_up' | 'completed' | 'declined';
  surveyCompletedAt: string | null;
  timezone: string;
  timeline: Array<{ date: string | null; label: string; state: 'complete' | 'current' | 'upcoming' }>;
  totalPipelineValue: string;
  workshopCode: string;
}

export interface WorkshopLead {
  createdAt: string;
  createdByEmail: string;
  description: string | null;
  id: string;
  leadReference: string | null;
}

export interface WorkshopOpportunity {
  createdAt: string;
  createdByEmail: string;
  currencyCode: string;
  id: string;
  name: string;
  notes: string | null;
  opportunityReference: string | null;
  pipelineValue: string;
  stage: string | null;
}

export interface WorkshopExecution {
  actualAttendees: number;
  notes: string;
  submittedAt: string;
  submittedByEmail: string;
}

export interface WorkshopFile {
  createdAt: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
  uploadedByEmail: string;
}

export type SurveyQuestionType = 'short_text' | 'long_text' | 'rating' | 'single_choice' | 'multi_choice' | 'yes_no';

export interface SurveyQuestion {
  displayOrder: number;
  id: string;
  key: string;
  label: string;
  options: string[] | null;
  questionType: SurveyQuestionType;
  required: boolean;
}

export interface WorkshopSurvey {
  isCompleted: boolean;
  questions: SurveyQuestion[];
  submissionCount: number;
}

export interface AdminIdentity {
  adminId: string;
  displayName: string;
  email: string;
}

export type WorkshopStatus = WorkshopTracking['status'];

export interface AdminWorkshopListItem {
  countryCode: string;
  countryName: string;
  createdAt: string;
  creatorEmail: string;
  creatorName: string;
  currencyCode: string;
  customerName: string;
  fundingRequired: boolean;
  id: string;
  plannedStartAt: string;
  requestedFundingAmount: string | null;
  requesterRole: 'ae' | 'cst';
  status: WorkshopStatus;
  workshopCode: string;
}

export interface AdminWorkshopPage {
  items: AdminWorkshopListItem[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}

export interface AdminWorkshopDetail extends Omit<WorkshopTracking, 'timeline' | 'actualFundingAmount' | 'approvedFundingAmount' | 'completedAt' | 'completionNotes' | 'leadCount' | 'leads' | 'opportunityCount' | 'opportunities' | 'surveyCompletedAt' | 'totalPipelineValue'> {
  approvedAt: string | null;
  approvedFundingAmount: string | null;
  completedAt: string | null;
  creatorDomain: string;
  declinedAt: string | null;
  statusHistory: Array<{
    changedByEmail: string | null;
    createdAt: string;
    fromStatus: WorkshopStatus;
    reason: string | null;
    toStatus: WorkshopStatus;
  }>;
  updatedAt: string;
}

export interface AdminReviewResult {
  emailDeliveryMode: 'sent' | 'logged' | 'failed';
  workshop: AdminWorkshopDetail;
}
