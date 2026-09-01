import { IsString, MaxLength } from "class-validator";

export class CreateTagDto {
  @IsString() @MaxLength(80) name!: string;
}

export class AssignTagDto {
  @IsString() @MaxLength(80) name!: string;
}
