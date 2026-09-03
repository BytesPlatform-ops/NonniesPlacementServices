import { Module } from "@nestjs/common";
import { PrivateFileStorageService } from "./private-file-storage.service";

/** Shared private object storage, usable by any feature module. */
@Module({
  providers: [PrivateFileStorageService],
  exports: [PrivateFileStorageService],
})
export class StorageModule {}
