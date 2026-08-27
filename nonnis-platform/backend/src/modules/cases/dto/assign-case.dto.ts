import { IsUUID, ValidateIf } from "class-validator";

/** Assign, reassign, or unassign (assignedUserId: null) the discharge professional. */
export class AssignCaseDto {
  @ValidateIf((o: AssignCaseDto) => o.assignedUserId !== null && o.assignedUserId !== undefined)
  @IsUUID()
  assignedUserId?: string | null;
}
